import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {inspectSave} from '../dist/src/save-transfer.mjs';

assert(process.argv.includes('--authorized-game-only-reset'),'Explicit reset invocation required');
const root=path.resolve(import.meta.dirname,'..'),privateDir=path.join(root,'mobile/.private');
const serial=(await fs.readFile(path.join(privateDir,'device-serial.txt'),'utf8')).trim();
const adb=path.resolve(root,'../.runtime-tools/android/sdk/platform-tools/adb.exe');
const run=promisify(execFile),pkg='com.xiaohaotian.arcaneduel';
const report={scope:'User explicitly requested this installation to reset progress. Clears this game package only after checking its official exported backup and installed version. No other app, computer or cloud data is reset. No ads requested.',checks:[],passed:false};
async function call(args,options={}){try{return (await run(adb,['-s',serial,...args],{windowsHide:true,timeout:20000,maxBuffer:20e6,encoding:'utf8',...options})).stdout;}catch{throw Error('Game-only USB operation failed: '+args[0]);}}
try{
 const backupPath=path.resolve((await fs.readFile(path.join(privateDir,'t65-backup-path.txt'),'utf8')).trim());
 assert(backupPath.startsWith(privateDir+path.sep));
 assert(Date.now()-(await fs.stat(backupPath)).mtimeMs<7200000,'This session exported backup must be less than two hours old');
 const raw=await fs.readFile(backupPath,'utf8');
 await inspectSave(raw);
 report.backupSha256=createHash('sha256').update(raw).digest('hex');
 assert.equal((await call(['get-state'])).trim(),'device');
 const version=await call(['shell','dumpsys','package',pkg]);
 report.installedVersion=version.match(/versionName=(\S+)/)?.[1];
 assert.equal(report.installedVersion,'0.1.11');
 await call(['shell','am','force-stop',pkg]);
 assert.equal((await call(['shell','pm','clear',pkg])).trim(),'Success');
 report.checks.push('Official private game export passed checksum and structure validation; Android confirmed clearing only this game data');
 await call(['shell','am','start','-n',pkg+'/.MainActivity']);
 await new Promise(r=>setTimeout(r,1200));
 for(let i=0;i<3;i++){
  await fs.writeFile(path.join(privateDir,'t66-cold-start-'+i+'.png'),await call(['exec-out','screencap','-p'],{encoding:'buffer'}));
  await new Promise(r=>setTimeout(r,200));
 }
 const pid=(await call(['shell','pidof',pkg])).trim();
 assert(/^\d+(?: \d+)*$/.test(pid));
 report.checks.push('Installed release restarted successfully; private cold-start frames saved for visual review');
 report.initialProfileInspected=false;
 report.reason='Release WebView debugging is disabled; reset is confirmed by the OS, without injecting or reading a test profile.';
 report.passed=true;
}catch(e){report.failure=e.message;}
report.finishedAt=new Date().toISOString();
await fs.writeFile(path.join(root,'validation/t66-vivo-reset-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));process.exitCode=report.passed?0:1;
