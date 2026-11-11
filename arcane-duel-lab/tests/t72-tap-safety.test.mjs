import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createTapSafetyProvider,sanitizeTapSafetyResult} from '../mobile/tap-safety-provider.mjs';
import {TapSafety,complianceState} from '../dist/src/tap-safety.mjs';
const allowed=(revision=1)=>({available:true,configured:true,initialized:true,complianceCode:500,complianceAllowed:true,complianceRevision:revision});

test('status remains inert and explicit privacy is required for every initialization/update/certification action',async()=>{
 const calls=[],plugin=new Proxy({status:async()=>({configured:true,initialized:false})},{get:(o,k)=>o[k]||((args)=>{calls.push([k,args]);return Promise.resolve({});})});
 const provider=createTapSafetyProvider(plugin);assert.deepEqual(await provider.status(),{configured:true,initialized:false});assert.deepEqual(calls,[]);
 for(const method of ['initialize','checkForceUpdate','openUpdate','startCompliance']){await assert.rejects(provider[method](),{code:'privacyRequired'});await assert.rejects(provider[method]({privacyAccepted:'true'}),{code:'privacyRequired'});}assert.deepEqual(calls,[]);
 await provider.openUpdate({privacyAccepted:true});assert.deepEqual(calls,[['openUpdate',{privacyAccepted:true}]]);
});
test('local certification never calls Tap login; account mode is a separate explicit action and never accepts a client identity',async()=>{
 const calls=[],provider=createTapSafetyProvider({startCompliance:async args=>{calls.push(['native',args]);return allowed();}},{login:async args=>calls.push(['login',args])});
 await provider.startCompliance({privacyAccepted:true,userIdentifier:'injected',openId:'injected'});assert.deepEqual(calls,[['native',{privacyAccepted:true,identityMode:'local'}]]);
 calls.length=0;await provider.startCompliance({privacyAccepted:true,identityMode:'tap'});assert.deepEqual(calls,[['login',{privacyAccepted:true}],['native',{privacyAccepted:true,identityMode:'tap'}]]);
 await assert.rejects(provider.startCompliance({privacyAccepted:true,identityMode:'fake'}),{code:'invalidIdentityMode'});
});
test('SDK and user identifiers, age, raw messages and unrecognized fields never leave the provider boundary',()=>{
 assert.deepEqual(sanitizeTapSafetyResult({...allowed(),openId:'private',userIdentifier:'private',ageRange:18,realName:'private',extra:{name:'private'},errorMessage:'private',reason:'accountChanged',requested:'true'}),{available:true,configured:true,initialized:true,complianceAllowed:true,complianceCode:500,complianceRevision:1,reason:'accountChanged',label:'账号已变化，请重新认证'});
});
test('only a current genuine positive SDK result allows play; every restriction, cancel, error and unknown callback blocks',()=>{
 assert.equal(complianceState(allowed()).allowed,true);
 for(const raw of [{...allowed(),complianceAllowed:false},{...allowed(),available:false},{...allowed(),initialized:false},{complianceCode:500},... [1000,1001,1030,1050,1100,1200,9002,777].map(code=>({...allowed(),complianceCode:code})),{...allowed(),reason:'accountChanged'}])assert.equal(complianceState(raw).allowed,false,JSON.stringify(raw));
 assert.equal(complianceState({...allowed(),complianceCode:1100}).phase,'ageRestricted');
});
test('continuous native restrictions immediately revoke admission and delayed older responses cannot restore it',async()=>{
 let listener;const provider=createTapSafetyProvider({addListener:async(_name,fn)=>{listener=fn;return {remove:async()=>{}};},startCompliance:async()=>allowed(2)}),safety=new TapSafety(provider),states=[];safety.onChange(state=>states.push(state.allowed));
 assert.equal((await safety.startCompliance({privacyAccepted:true})).allowed,true);listener({...allowed(3),complianceCode:1050});assert.equal(safety.snapshot().allowed,false);listener(allowed(2));assert.equal(safety.snapshot().allowed,false);assert.deepEqual(states,[false,false,true,false]);await safety.dispose();
});
test('a restriction arriving while startup is pending wins over its late positive response',async()=>{
 let listener,resolve;const provider={subscribe:async fn=>{listener=fn;return {remove:async()=>{}};},startCompliance:()=>new Promise(r=>resolve=r)},safety=new TapSafety(provider);
 const pending=safety.startCompliance({privacyAccepted:true});await new Promise(r=>setImmediate(r));listener({...allowed(4),complianceCode:1030});resolve(allowed(3));assert.equal((await pending).allowed,false);await safety.dispose();
});
test('listener failure prevents starting certification; transport errors never become allowed or successful update checks',async()=>{
 let starts=0;const failed=new TapSafety(createTapSafetyProvider({startCompliance:async()=>{starts++;return allowed();}}));await assert.rejects(failed.startCompliance({privacyAccepted:true}),/监听/);assert.equal(starts,0);
 const provider=createTapSafetyProvider({openUpdate:async()=>{throw Object.assign(Error('raw secret'),{code:'tapClientMissing'});}});assert.deepEqual(await provider.openUpdate({privacyAccepted:true}),{available:false,complianceAllowed:false,reason:'tapClientMissing',label:'请先从TapTap官方渠道安装TapTap客户端，再回来更新'});
});
test('exit and dispose revoke local admission, stop future events, and remove the listener',async()=>{
 let listener,removed=0;const safety=new TapSafety(createTapSafetyProvider({addListener:async(_n,fn)=>{listener=fn;return {remove:async()=>{removed++;}};},startCompliance:async()=>allowed(1),exitCompliance:async()=>allowed(1)}));await safety.startCompliance({privacyAccepted:true});assert.equal((await safety.exitCompliance()).allowed,false);assert.equal(safety.snapshot().phase,'exited');await safety.dispose();listener(allowed(10));assert.equal(safety.snapshot().allowed,false);assert.equal(removed,1);
});

test('disposing an allowed session revokes admission even if exit was not explicitly called',async()=>{
 const safety=new TapSafety({subscribe:async()=>({remove:async()=>{}}),startCompliance:async()=>allowed(1)});await safety.startCompliance({privacyAccepted:true});assert.equal(safety.snapshot().allowed,true);await safety.dispose();assert.equal(safety.snapshot().allowed,false);
});

test('real Java receipt gate distinguishes production from test without weakening completion or replay checks',t=>{
 const root=fileURLToPath(new URL('../',import.meta.url)),jdkBase=path.resolve(root,'../.runtime-tools/android/jdk');
 const portable=existsSync(jdkBase)?path.join(jdkBase,readdirSync(jdkBase).find(name=>name.startsWith('jdk-'))||''):'';
 const jdk=process.env.JAVA_HOME||portable,extension=process.platform==='win32'?'.exe':'',javac=path.join(jdk,'bin','javac'+extension),java=path.join(jdk,'bin','java'+extension);
 if(!existsSync(javac)||!existsSync(java)){t.skip('A local JDK is required for the real Java gate test');return;}
 const scratch=mkdtempSync(path.join(tmpdir(),'arcane-t72-receipts-')),harness=path.join(scratch,'TapSafetyReceiptHarness.java');
 try{
  writeFileSync(harness,`import com.xiaohaotian.arcaneduel.AdReceiptGate;
public class TapSafetyReceiptHarness {
 static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 static AdReceiptGate ready(boolean test){AdReceiptGate g=new AdReceiptGate("reward-revive",true,test);g.loaded("synthetic-sdk-request");g.shown();g.verify(true);return g;}
 static void rejected(AdReceiptGate gate,boolean close){AdReceiptGate.Result r=gate.finish(close,"not-complete");check(!r.completed&&r.receipt.isEmpty(),"No receipt for an incomplete viewing");check(gate.finish(true,"")==null,"Finalization must be single-use");}
 public static void main(String[] args){
  AdReceiptGate test=ready(true),production=ready(false);
  AdReceiptGate.Result a=test.finish(true,""),b=production.finish(true,"");
  check(a.completed&&b.completed,"Verified normal closes complete in both environments");
  check(a.receipt.matches("dirichlet-test:reward-revive:[0-9a-f]{24}:[0-9a-f-]{36}"),"Test receipt namespace");
  check(b.receipt.matches("dirichlet-production:reward-revive:[0-9a-f]{24}:[0-9a-f-]{36}"),"Production receipt namespace");
  check(!a.receipt.equals(b.receipt)&&!b.receipt.contains("synthetic-sdk-request"),"Receipts isolate environments and hide raw request IDs");
  check(test.finish(true,"")==null&&production.finish(true,"")==null,"Duplicate close cannot mint a second receipt");
  check(!ready(false).finish(true,"").receipt.equals(b.receipt),"Repeated SDK request IDs retain distinct native attempts");
  AdReceiptGate unverified=new AdReceiptGate("reward-revive",true,false);unverified.shown();rejected(unverified,true);
  rejected(ready(false),false);
  AdReceiptGate skipped=new AdReceiptGate("reward-revive",true,false);skipped.shown();skipped.skip();skipped.verify(true);rejected(skipped,true);
  AdReceiptGate invalid=ready(false);invalid.verify(false);rejected(invalid,true);
  AdReceiptGate interstitial=new AdReceiptGate("interstitial-result",false,false);interstitial.shown();interstitial.verify(true);rejected(interstitial,true);
  System.out.print("production/test receipt checks passed");
 }
}`, 'utf8');
  const compiled=spawnSync(javac,['-encoding','UTF-8','-d',scratch,path.join(root,'mobile/native/src/com/xiaohaotian/arcaneduel/AdReceiptGate.java'),harness],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(compiled.status,0,compiled.stderr||compiled.error?.message);
  const executed=spawnSync(java,['-cp',scratch,'TapSafetyReceiptHarness'],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(executed.status,0,executed.stderr||executed.error?.message);assert.equal(executed.stdout,'production/test receipt checks passed');
 }finally{
  assert.ok(path.resolve(scratch).startsWith(path.resolve(tmpdir())+path.sep+'arcane-t72-receipts-'));rmSync(scratch,{recursive:true,force:true});
 }
});
