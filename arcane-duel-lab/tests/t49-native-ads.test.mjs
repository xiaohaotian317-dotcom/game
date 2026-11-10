import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createAdsProvider} from '../mobile/ads-provider.mjs';
import {AdvertisingPlatform,AD_PLACEMENTS} from '../dist/src/advertising-platform.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),native=path.join(root,'mobile/native'),cache=path.join(native,'.cache/ads-classes'),jdkRoot=path.resolve(root,'../.runtime-tools/android/jdk'),jdk=process.env.JAVA_HOME||(existsSync(jdkRoot)?path.join(jdkRoot,readdirSync(jdkRoot).find(n=>n.startsWith('jdk-'))||''):''),java=path.join(jdk,'bin/java.exe'),canCompile=existsSync(java);
before(()=>{if(!canCompile)return;mkdirSync(cache,{recursive:true});const compile=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',cache,path.join(native,'src/com/xiaohaotian/arcaneduel/AdReceiptGate.java'),path.join(native,'testing/NativeAdsHarness.java')],{encoding:'utf8',windowsHide:true});assert.equal(compile.status,0,compile.stderr);});
function callbacks(...events){const run=spawnSync(java,['-cp',cache,'com.xiaohaotian.arcaneduel.NativeAdsHarness',...events],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout);}
const nativeTest=(name,fn)=>test(name,{skip:canCompile?false:'Requires the existing local JDK'},fn);

test('bundled non-aggregated Android AAR matches the official 5.3.2.0 download checksum',()=>{
 const bytes=readFileSync(path.join(native,'libs/dirichlet_ad_5.3.2.0.aar'));assert.equal(createHash('md5').update(bytes).digest('hex'),'ca0ebbe249fb08fde4d836e7d79ddd39');assert.ok(bytes.length>2e6&&bytes.length<3e6);
});
nativeTest('only shown, SDK-verified and normally closed reward ads receive a unique receipt',()=>{
 const first=callbacks('loaded','shown','verified','close'),second=callbacks('loaded','shown','verified','close');assert.equal(first.completed,true);assert.equal(first.shown,true);assert.equal(first.available,true);assert.match(first.receipt,/^dirichlet-test:reward-item:[0-9a-f]{24}:[0-9a-f-]{36}$/);assert.notEqual(first.receipt,second.receipt);assert.ok(!first.receipt.includes('private-value'));
});
nativeTest('premature close, video-complete alone, rejected verification, error, early skip and timeout never earn receipts',()=>{
 for(const events of [['loaded','shown','close'],['loaded','shown','video-complete','close'],['loaded','shown','denied','close'],['loaded','shown','verified','error','close'],['loaded','shown','skip','close'],['loaded','shown','skip','verified','close'],['loaded','shown','verified','timeout'],['loaded','verified','close'],['timeout']]){const value=callbacks(...events);assert.equal(value.completed,false,events.join(','));assert.equal(value.receipt,'');}
});
nativeTest('SDK-allowed skip after successful verification preserves earned eligibility until normal close',()=>{
 const valid=callbacks('loaded','shown','verified','skip','close');assert.equal(valid.completed,true);assert.ok(valid.receipt);for(const events of [['loaded','shown','verified','skip','timeout'],['loaded','shown','verified','skip','error','close'],['loaded','shown','verified','skip','denied','close']])assert.equal(callbacks(...events).completed,false,events.join(','));
});
nativeTest('late reward callbacks and repeated close cannot create or duplicate a receipt',()=>{
 const cancelled=callbacks('loaded','shown','close','verified','close');assert.equal(cancelled.completed,false);assert.equal(cancelled.ignoredFinishes,1);const completed=callbacks('loaded','shown','verified','close','verified','close');assert.equal(completed.completed,true);assert.equal(completed.ignoredFinishes,1);
});
test('status is inert; current user consent is required before provider initialization and reward presentation',async()=>{
 const calls=[],plugin={status:async()=>{calls.push('status');return {configured:true,privacyAccepted:false};},consent:async p=>calls.push(['consent',p]),showRewarded:async p=>{calls.push(['reward',p]);return {available:true,completed:true,receipt:'real-sdk-test-receipt'};}};
 const ads=new AdvertisingPlatform(createAdsProvider(plugin));await ads.status();assert.deepEqual(calls,['status']);await assert.rejects(()=>ads.showRewarded(AD_PLACEMENTS.coins),/隐私/);assert.deepEqual(calls,['status']);const result=await ads.showRewarded(AD_PLACEMENTS.coins,{privacyAccepted:true});assert.equal(result.completed,true);assert.deepEqual(calls.slice(1),[['consent',{privacyAccepted:true}],['reward',{placement:AD_PLACEMENTS.coins}]]);assert.equal((await ads.showRewarded(AD_PLACEMENTS.coins,{privacyAccepted:true})).completed,false,'a reused SDK receipt is rejected');
});
test('automatic interstitial cannot establish first consent and SDK failures cannot become rewards',async()=>{
 let initialized=0,shown=0,accepted=false;const plugin={status:async()=>({privacyAccepted:accepted}),consent:async()=>{initialized++;},showInterstitial:async()=>{shown++;return {shown:true,testMode:true};},showRewarded:async()=>({available:false,completed:false})},ads=new AdvertisingPlatform(createAdsProvider(plugin));
 assert.equal((await ads.showResultInterstitial({privacyAccepted:true})).shown,false);assert.equal(initialized,0);assert.equal(shown,0);accepted=true;assert.equal((await ads.showResultInterstitial({privacyAccepted:true})).shown,true);assert.equal(initialized,1);assert.equal(shown,1);assert.equal((await ads.showResultInterstitial({privacyAccepted:true,duel:true})).shown,false);assert.equal(shown,1);assert.equal((await ads.showRewarded(AD_PLACEMENTS.item,{privacyAccepted:true})).completed,false);
});
