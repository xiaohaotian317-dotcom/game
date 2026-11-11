import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=path.resolve(import.meta.dirname,'..'),variant=process.argv[2];
if(!['debug','release'].includes(variant))throw Error('Choose debug or release');
const serial=(await fs.readFile(path.join(root,'mobile/.private/device-serial.txt'),'utf8')).trim();
const adb=path.resolve(root,'../.runtime-tools/android/sdk/platform-tools/adb.exe'),run=promisify(execFile);
const apk=path.join(root,`mobile/android/app/build/outputs/apk/${variant}/app-${variant}.apk`);
const report={scope:'Same-key install of this game only. Does not clear app data or request ads.',variant,expectedVersion:'0.1.12',passed:false};
async function call(args,timeout=15000){try{return (await run(adb,['-s',serial,...args],{windowsHide:true,timeout,encoding:'utf8',maxBuffer:4e6})).stdout.trim();}catch(e){await fs.writeFile(path.join(root,'mobile/.private/t69-install-error.json'),JSON.stringify({code:e.code,killed:e.killed,stdout:e.stdout,stderr:e.stderr}));throw Error('Game-only USB '+args[0]+' operation failed or timed out');}}
try{
 await fs.stat(apk);
 if(await call(['get-state'])!=='device')throw Error('Phone is not connected');
 const remote='/data/local/tmp/arcane-duel-t69.apk';
 report.phase='transfer';await fs.writeFile(path.join(root,'validation/t69-vivo-'+variant+'-install.json'),JSON.stringify(report));
 await call(['push','-Z',apk,remote],90000);
 report.phase='package-install';await fs.writeFile(path.join(root,'validation/t69-vivo-'+variant+'-install.json'),JSON.stringify(report));
 const result=await call(['shell','pm','install','-r',remote],180000);
 await fs.writeFile(path.join(root,'mobile/.private/t69-'+variant+'-install.log'),result);
 if(!/Success/.test(result))throw Error('Phone did not confirm installation success');
 const state=await call(['shell','dumpsys','package','com.xiaohaotian.arcaneduel']);
 report.installedVersion=state.match(/versionName=(\S+)/)?.[1];
 if(report.installedVersion!==report.expectedVersion)throw Error('Installed version does not match');
 await call(['shell','rm','-f',remote]);
 await call(['shell','am','start','-n','com.xiaohaotian.arcaneduel/.MainActivity']);
 report.passed=true;
}catch(e){report.failure=e.message;}
report.finishedAt=new Date().toISOString();
await fs.writeFile(path.join(root,'validation/t69-vivo-'+variant+'-install.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;
