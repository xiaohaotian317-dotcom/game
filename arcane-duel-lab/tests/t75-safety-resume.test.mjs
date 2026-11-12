import test from 'node:test';
import assert from 'node:assert/strict';
import {TapSafety} from '../dist/src/tap-safety.mjs';
import {createTapSafetyProvider} from '../mobile/tap-safety-provider.mjs';

const fresh=(privacyAccepted=true)=>({required:true,available:true,configured:true,initialized:false,privacyAccepted,complianceAllowed:false,complianceRevision:0,reason:'unchecked'});
const allowed=(revision=2)=>({...fresh(),initialized:true,complianceAllowed:true,complianceCode:500,complianceRevision:revision,reason:'allowed'});
function fixture({raw=fresh(),resume=async()=>allowed()}={}){
 let current=raw,listener;const calls=[];
 const plugin={status:async()=>current,addListener:async(_name,fn)=>{listener=fn;return{remove:async()=>{}};},resumeCompliance:async args=>{calls.push(args);return resume();}};
 return {safety:new TapSafety(createTapSafetyProvider(plugin)),calls,set:raw=>current=raw,emit:raw=>listener?.(raw)};
}
test('cold restart uses remembered native consent but remains blocked until a new official positive callback',async()=>{
 let finish;const f=fixture({resume:()=>new Promise(r=>finish=r)}),pending=f.safety.resumeCompliance();
 await new Promise(r=>setImmediate(r));assert.equal(f.safety.snapshot().allowed,false);assert.equal(f.safety.snapshot().phase,'checking');
 assert.equal(f.calls.length,1);assert.equal(f.calls[0],undefined,'Resume supplies no invented consent or identity to native');
 finish(allowed());assert.equal((await pending).allowed,true);
 const restarted=fixture();assert.equal(restarted.safety.snapshot().allowed,false,'A previous process result is never persisted as admission');
});
test('first use and withdrawn consent do not initialize or resume a native service',async()=>{
 for(const privacyAccepted of [false,undefined,'true']){const f=fixture({raw:{...fresh(),privacyAccepted}});assert.equal((await f.safety.resumeCompliance()).allowed,false);assert.equal(f.calls.length,0);}
 const f=fixture();f.set(fresh(false));assert.equal((await f.safety.resumeCompliance()).allowed,false);assert.equal(f.calls.length,0);
});
test('cancel, exit, account changes and SDK restrictions are not silently restarted',async()=>{
 for(const reason of ['cancelled','exited','accountChanged','switchAccount','periodRestricted','durationLimit','ageRestricted','serviceUnavailable']){
  const f=fixture({raw:{...fresh(),reason}});assert.equal((await f.safety.resumeCompliance()).allowed,false);assert.equal(f.calls.length,0,reason);
 }
 const pending=fixture({raw:{...fresh(),compliancePending:true}});await pending.safety.resumeCompliance();assert.equal(pending.calls.length,0);
 const active=fixture({raw:allowed()});assert.equal((await active.safety.resumeCompliance()).allowed,true);assert.equal(active.calls.length,0);
});
test('concurrent lifecycle checks coalesce into one official startup and do not prompt Tap login',async()=>{
 let finish;const f=fixture({resume:()=>new Promise(r=>finish=r)});const a=f.safety.resumeCompliance(),b=f.safety.resumeCompliance();
 await new Promise(r=>setImmediate(r));assert.equal(f.calls.length,1);finish(allowed());assert.equal((await a).allowed,true);assert.equal((await b).allowed,true);
});
test('a newer restriction beats a delayed positive resume result',async()=>{
 let finish;const f=fixture({resume:()=>new Promise(r=>finish=r)}),pending=f.safety.resumeCompliance();
 await new Promise(r=>setImmediate(r));f.emit({...allowed(4),complianceAllowed:false,complianceCode:1030,reason:'periodRestricted'});finish(allowed(3));
 assert.equal((await pending).allowed,false);assert.equal(f.safety.snapshot().phase,'periodRestricted');
});
test('resume failure or missing native capability never grants play or fabricates consent',async()=>{
 const failed=fixture({resume:async()=>{throw Object.assign(Error('private native message'),{code:'sdkFailed'});}});assert.equal((await failed.safety.resumeCompliance()).allowed,false);
 const missing=new TapSafety(createTapSafetyProvider({status:async()=>fresh(),addListener:async()=>({remove:async()=>{}})}));assert.equal((await missing.resumeCompliance()).allowed,false);
});
