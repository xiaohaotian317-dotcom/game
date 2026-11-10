import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';

assert(process.argv.includes('--authorized-game-only-reset'),'Explicit reset invocation required');
const root=path.resolve(import.meta.dirname,'..'),privateDir=path.join(root,'mobile/.private');
const serial=(await fs.readFile(path.join(privateDir,'device-serial.txt'),'utf8')).trim();
const adb=path.resolve(root,'../.runtime-tools/android/sdk/platform-tools/adb.exe');
const run=promisify(execFile),pkg='com.xiaohaotian.arcaneduel';
const report={scope:'User-authorized second fresh-start reset of this phone game only, after version 0.1.7 installation. No other app, computer or cloud data touched. No ads requested.',checks:[],passed:false};
async function call(args,options={}){try{return (await run(adb,['-s',serial,...args],{windowsHide:true,timeout:20000,maxBuffer:20e6,encoding:'utf8',...options})).stdout;}catch{throw Error('Game-only USB operation failed: '+args[0]);}}
try{
 const backupPath=(await fs.readFile(path.join(privateDir,'vivo-t49-backup-path.txt'),'utf8')).trim();
 assert(path.resolve(backupPath).startsWith(privateDir+path.sep));
 assert(Date.now()-(await fs.stat(backupPath)).mtimeMs<600000,'Fresh backup required within ten minutes');
 const raw=await fs.readFile(backupPath,'utf8'),backup=JSON.parse(raw);
 assert(backup.local?.['arcane-solo-growth-v1'],'Existing game progress must have a private backup');
 report.backupSha256=createHash('sha256').update(raw).digest('hex');
 assert.equal((await call(['get-state'])).trim(),'device');
 const version=await call(['shell','dumpsys','package',pkg]);
 report.installedVersion=version.match(/versionName=(\S+)/)?.[1];
 assert.equal(report.installedVersion,'0.1.7');
 await call(['shell','am','force-stop',pkg]);
 assert.equal((await call(['shell','pm','clear',pkg])).trim(),'Success');
 report.checks.push('Fresh private backup checked; Android confirmed clearing only this game data');
 const start=call(['shell','am','start','-n',pkg+'/.MainActivity']);
 for(let i=0;i<8;i++){
  const frame=await call(['exec-out','screencap','-p'],{encoding:'buffer'});
  await fs.writeFile(path.join(privateDir,'t56-cold-start-'+i+'.png'),frame);
  await new Promise(r=>setTimeout(r,120));
 }
 await start;
 const pid=(await call(['shell','pidof',pkg])).trim();
 assert(/^\d+(?: \d+)*$/.test(pid));
 report.checks.push('Installed release restarted successfully; private cold-start frames captured for visual review');
 report.initialProfileInspected=false;
 report.reason='Release WebView debugging is disabled; reset is confirmed by the OS, not by injecting or reading a test profile.';
 report.passed=true;
}catch(e){report.failure=e.message;}
report.finishedAt=new Date().toISOString();
await fs.writeFile(path.join(root,'validation/t56-vivo-reset-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;
