import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,loadSolo,saveSolo,normalizeSolo,addItem} from '../dist/src/campaign-profile.mjs';
import {SOLO_KEY} from '../dist/src/campaign-growth-data.mjs';
import {MAX_WEEKLY_CLAIMS,weeklyTowerRewardItems,normalizeTowerWeekly,mergeTowerWeekly,mergeTowerWeeklyForImport} from '../dist/src/tower-weekly-state.mjs';
import {claimTowerWeeklyReward} from '../dist/src/tower-weekly-rewards.mjs';

const ACCOUNT='tap-account-digest-a',PERIOD='server-history-token:opaque-41',NONCE='claim-0000000000000001';
const clone=value=>structuredClone(value);
const record=(periodToken=PERIOD,nonce=NONCE,rank=1,accountId=ACCOUNT)=>({accountId,periodToken,nonce,rank,rewards:weeklyTowerRewardItems(rank)});
const entry=claim=>{const {accountId,...rest}=claim;return rest;};
function memory(map=new Map()){
 return {map,writes:0,failAt:0,getItem:key=>map.get(key)??null,setItem(key,value){this.writes++;if(this.writes===this.failAt)throw Error('simulated disk full');map.set(key,value);}};
}
function fixture(rank=1){
 const storage=memory();assert.ok(saveSolo(storage,freshSolo()));
 const state={accountId:ACCOUNT,rank,ended:true,revision:'',ledger:{version:1,claims:[]},reads:0,writes:0,rankRequests:[],writeRequests:[],beforeWrite:null,afterWrite:null};
 const provider={
  async getHistoricalRank({periodToken}){state.rankRequests.push(periodToken);return {accountId:state.accountId,periodToken,ended:state.ended,rank:state.rank};},
  async loadWeeklyLedger(){state.reads++;return clone({accountId:state.accountId,revision:state.revision,ledger:state.ledger});},
  async writeWeeklyLedger(request){state.writes++;state.writeRequests.push(clone(request));if(state.beforeWrite)await state.beforeWrite(request);if(request.expectedRevision!==state.revision)return {written:false,reason:'revisionConflict'};state.revision='sdk-file-id-'+state.writes;state.ledger=clone(request.ledger);if(state.afterWrite)await state.afterWrite();return clone({written:true,accountId:state.accountId,revision:state.revision,ledger:state.ledger});}
 };
 const claim=(options={})=>claimTowerWeeklyReward({storage,provider,periodToken:PERIOD,nonceFactory:()=>NONCE,locks:null,...options});
 return {storage,state,provider,claim};
}
const count=(p,type)=>p.bag.filter(i=>i.type===type).reduce((n,i)=>n+i.count,0);
const assets=p=>({coins:p.coins,tickets:p.tickets,bag:clone(p.bag),heroes:clone(p.heroes)});

test('weekly reward boundaries preserve the exact promised item counts and reject noninteger ranks',()=>{
 assert.deepEqual(weeklyTowerRewardItems(1),[{type:'heroChoice',count:1},{type:'stoneHigh',count:3},{type:'chestLarge',count:3}]);
 for(const rank of [2,10])assert.deepEqual(weeklyTowerRewardItems(rank),[{type:'stoneHigh',count:3},{type:'chestLarge',count:3}]);
 for(const rank of [11,50])assert.deepEqual(weeklyTowerRewardItems(rank),[{type:'stoneMedium',count:3},{type:'chestMedium',count:3}]);
 for(const rank of [0,-1,51,1.5,'1',null,NaN,Infinity])assert.deepEqual(weeklyTowerRewardItems(rank),[]);
});

test('new and legacy profiles normalize to no pending reward, and state data is separate from ranking authority',()=>{
 const old=freshSolo();delete old.towerWeekly;old.coins=456;const p=normalizeSolo(old);assert.deepEqual(p.towerWeekly,{version:1,pending:null,receipts:[],blocked:false});assert.equal(p.coins,456);
 assert.equal(normalizeTowerWeekly({version:1,pending:{...record(),rank:'1'},receipts:[]}).blocked,true);
 assert.equal(normalizeTowerWeekly({version:1,pending:record(),receipts:[record()]}).pending,null);
 assert.equal(normalizeTowerWeekly({version:1,receipts:[record(),{...record(),nonce:'claim-0000000000000002'}]}).blocked,true);
 assert.equal(normalizeTowerWeekly({version:2,receipts:[]}).blocked,true);
});

test('pending is saved without inventory changes before cloud write; items and receipt commit together only after read-back',async()=>{
 for(const rank of [1,2,10,11,50]){const {storage,state,claim}=fixture(rank),before=loadSolo(storage);state.beforeWrite=()=>{const saved=loadSolo(storage);assert.deepEqual(assets(saved),assets(before));assert.equal(saved.towerWeekly.pending.nonce,NONCE);assert.equal(saved.towerWeekly.receipts.length,0);};const result=await claim();assert.equal(result.status,'granted');assert.equal(result.recovered,false);assert.equal(result.profile.coins,before.coins,'coin boxes remain inventory items');assert.equal(result.profile.tickets,0);for(const item of weeklyTowerRewardItems(rank))assert.equal(count(result.profile,item.type)-count(before,item.type),item.count);assert.equal(result.profile.towerWeekly.pending,null);assert.deepEqual(result.profile.towerWeekly.receipts,[record(PERIOD,NONCE,rank)]);assert.equal(state.writes,1);assert.equal(state.reads,2);assert.equal(state.writeRequests[0].expectedRevision,'');assert.equal(state.rankRequests[0],PERIOD);}
});

test('duplicate clicks are serialized and cannot add another item bundle or claim',async()=>{
 const {storage,state,claim}=fixture();const results=await Promise.all([claim(),claim(),claim()]);assert.deepEqual(results.map(r=>r.status),['granted','alreadyClaimed','alreadyClaimed']);assert.equal(state.writes,1);assert.equal(count(loadSolo(storage),'heroChoice'),1);assert.equal(count(loadSolo(storage),'stoneHigh'),3);assert.equal(count(loadSolo(storage),'chestLarge'),3);assert.equal(state.ledger.claims.length,1);
});

test('a server claim already made without the matching local pending never grants items',async()=>{
 const {storage,state,claim}=fixture(),before=assets(loadSolo(storage));state.ledger.claims=[entry(record(PERIOD,'other-device-nonce-0000001'))];state.revision='historical-archive';const result=await claim();assert.equal(result.status,'alreadyClaimed');assert.deepEqual(assets(loadSolo(storage)),before);assert.equal(state.writes,0);assert.equal(loadSolo(storage).towerWeekly.receipts.length,1);
});

test('invalid rank, unfinished period, mismatched token and unavailable service never create pending or rewards',async()=>{
 for(const rank of [0,51,-1,1.1,'1',null,NaN,Infinity]){const f=fixture(rank),before=f.storage.getItem(SOLO_KEY);await assert.rejects(f.claim(),{code:'ineligible'});assert.equal(f.storage.getItem(SOLO_KEY),before);assert.equal(f.state.writes,0);}
 for(const [changes,code]of [[{ended:false},'periodOpen'],[{available:false},'cloudUnavailable'],[{periodToken:'different-service-period'},'periodMismatch'],[{accountId:''},'accountUnavailable']]){const f=fixture(),before=f.storage.getItem(SOLO_KEY);f.provider.getHistoricalRank=async()=>({accountId:ACCOUNT,periodToken:PERIOD,ended:true,rank:1,...changes});await assert.rejects(f.claim(),{code});assert.equal(f.storage.getItem(SOLO_KEY),before);}
 const f=fixture(),before=f.storage.getItem(SOLO_KEY);await assert.rejects(f.claim({provider:null}),{code:'cloudUnavailable'});assert.equal(f.storage.getItem(SOLO_KEY),before);
});

test('missing or corrupt formal Solo storage and malformed cloud ledgers fail closed',async()=>{
 for(const text of [null,'{broken','{"version":1}','{"version":2,"owned":[],"bag":[],"heroes":{}}']){const f=fixture();text===null?f.storage.map.delete(SOLO_KEY):f.storage.map.set(SOLO_KEY,text);await assert.rejects(f.claim(),{code:'localUnavailable'});assert.equal(f.state.writes,0);}
 for(const ledger of [{version:2,claims:[]},{version:1,claims:[{...entry(record()),rewards:[{type:'chestLarge',count:300}]}]},{version:1,claims:[entry(record()),entry(record())]}]){const f=fixture(),before=f.storage.getItem(SOLO_KEY);f.state.ledger=ledger;await assert.rejects(f.claim(),{code:'ledgerInvalid'});assert.equal(f.storage.getItem(SOLO_KEY),before);assert.equal(f.state.writes,0);}
 const f=fixture();f.state.revision=undefined;await assert.rejects(f.claim(),{code:'ledgerInvalid'});assert.equal(f.state.writes,0);
});

test('a failed pending write cannot make a cloud claim or change the formal inventory',async()=>{
 const {storage,state,claim}=fixture(),before=storage.getItem(SOLO_KEY);storage.failAt=storage.writes+1;await assert.rejects(claim(),{code:'localWriteFailed'});assert.equal(storage.getItem(SOLO_KEY),before);assert.equal(state.writes,0);assert.equal(state.ledger.claims.length,0);
});

test('a cloud exception leaves only durable pending and the same nonce resumes after restart',async()=>{
 const f=fixture(),before=assets(loadSolo(f.storage)),write=f.provider.writeWeeklyLedger;f.provider.writeWeeklyLedger=async()=>{throw Error('offline');};await assert.rejects(f.claim(),{code:'cloudUnavailable'});assert.deepEqual(assets(loadSolo(f.storage)),before);const pending=clone(loadSolo(f.storage).towerWeekly.pending);assert.equal(pending.nonce,NONCE);f.provider.writeWeeklyLedger=write;const restarted=memory(f.storage.map),result=await f.claim({storage:restarted,nonceFactory:()=>{throw Error('must reuse durable nonce');}});assert.equal(result.status,'granted');assert.equal(result.recovered,true);assert.equal(f.state.ledger.claims[0].nonce,pending.nonce);assert.equal(count(loadSolo(restarted),'heroChoice'),1);
});

test('cloud success followed by local failure recovers once without issuing another cloud write',async()=>{
 const f=fixture(),before=assets(loadSolo(f.storage));f.storage.failAt=f.storage.writes+2;await assert.rejects(f.claim(),{code:'localWriteFailed'});assert.equal(f.state.writes,1);assert.equal(f.state.ledger.claims[0].nonce,NONCE);assert.deepEqual(assets(loadSolo(f.storage)),before);assert.equal(loadSolo(f.storage).towerWeekly.pending.nonce,NONCE);assert.equal(loadSolo(f.storage).towerWeekly.receipts.length,0);f.storage.failAt=0;const result=await f.claim({storage:memory(f.storage.map)});assert.equal(result.recovered,true);assert.equal(result.status,'granted');assert.equal(f.state.writes,1);assert.equal(count(result.profile,'heroChoice'),1);assert.equal((await f.claim()).status,'alreadyClaimed');assert.equal(count(loadSolo(f.storage),'heroChoice'),1);
});

test('a timeout after the cloud committed and a read-back outage both preserve recoverable pending without awarding early',async()=>{
 for(const failure of ['writeResponse','readBack']){const f=fixture(),before=assets(loadSolo(f.storage)),write=f.provider.writeWeeklyLedger,read=f.provider.loadWeeklyLedger;if(failure==='writeResponse')f.provider.writeWeeklyLedger=async request=>{await write(request);throw Error('response lost');};else f.provider.loadWeeklyLedger=async()=>f.state.writes?{available:false}:read();await assert.rejects(f.claim(),{code:'cloudUnavailable'});assert.deepEqual(assets(loadSolo(f.storage)),before);assert.equal(f.state.ledger.claims.length,1);f.provider.writeWeeklyLedger=write;f.provider.loadWeeklyLedger=read;assert.equal((await f.claim()).status,'granted');assert.equal(f.state.writes,1);assert.equal(count(loadSolo(f.storage),'heroChoice'),1);}
});

test('revision conflicts fail without inventory changes, then retry preserves unrelated cloud claims',async()=>{
 const f=fixture(),before=assets(loadSolo(f.storage));let conflict=true;f.state.beforeWrite=()=>{if(conflict){conflict=false;f.state.revision='updated-by-another-device';f.state.ledger.claims.push(entry(record('other-ended-server-token','other-period-claim-0000001',20)));}};await assert.rejects(f.claim(),{code:'revisionConflict'});assert.deepEqual(assets(loadSolo(f.storage)),before);const result=await f.claim();assert.equal(result.status,'granted');assert.equal(f.state.ledger.claims.length,2);assert.ok(f.state.ledger.claims.some(c=>c.periodToken==='other-ended-server-token'));assert.equal(f.state.writeRequests[1].expectedRevision,'updated-by-another-device');
});

test('unconfirmed writes and account changes cannot grant, even with a saved pending nonce',async()=>{
 for(const mode of ['notWritten','noReadBackClaim','accountChanged']){const f=fixture(),before=assets(loadSolo(f.storage));if(mode==='notWritten')f.provider.writeWeeklyLedger=async()=>({written:false});if(mode==='noReadBackClaim')f.provider.writeWeeklyLedger=async()=>({written:true,accountId:ACCOUNT});if(mode==='accountChanged')f.state.afterWrite=()=>{f.state.accountId='tap-account-digest-b';};await assert.rejects(f.claim(),{code:mode==='noReadBackClaim'?'ledgerChanged':mode==='accountChanged'?'accountChanged':'cloudUnavailable'});assert.deepEqual(assets(loadSolo(f.storage)),before);assert.equal(loadSolo(f.storage).towerWeekly.pending.nonce,NONCE);}
});

test('intervening legitimate profile progress survives delivery, and an older open page preserves the pending journal',async()=>{
 const f=fixture(),stale=loadSolo(f.storage);f.state.beforeWrite=()=>{assert.ok(saveSolo(f.storage,stale));assert.equal(loadSolo(f.storage).towerWeekly.pending.nonce,NONCE);const current=loadSolo(f.storage);current.coins+=77;current.heroes.fire.exp+=88;addItem(current,{type:'xpSmall',count:2});assert.ok(saveSolo(f.storage,current));};const result=await f.claim();assert.equal(result.profile.coins,377);assert.equal(result.profile.heroes.fire.exp,88);assert.equal(count(result.profile,'xpSmall'),2);assert.equal(count(result.profile,'heroChoice'),1);
 const old=clone(stale);assert.ok(saveSolo(f.storage,old));assert.equal(loadSolo(f.storage).towerWeekly.receipts.length,1);assert.equal((await f.claim()).status,'alreadyClaimed');
});

test('each server period is independent and local week-shaped strings are not authority',async()=>{
 const f=fixture();assert.equal((await f.claim()).status,'granted');f.state.rank=50;const next='sdk-period-token-next:42';const result=await f.claim({periodToken:next,nonceFactory:()=>NONCE+'-next'});assert.equal(result.status,'granted');assert.equal(count(result.profile,'stoneHigh'),3);assert.equal(count(result.profile,'stoneMedium'),3);assert.equal(count(result.profile,'chestMedium'),5);assert.equal(result.profile.towerWeekly.receipts.length,2);assert.deepEqual(f.state.rankRequests,[PERIOD,next]);assert.deepEqual(f.state.ledger.claims.map(c=>c.periodToken),[PERIOD,next]);
 const offline=fixture();offline.provider.getHistoricalRank=async()=>({available:false});await assert.rejects(offline.claim({periodToken:'2026-11-09'}),{code:'cloudUnavailable'});assert.equal(count(loadSolo(offline.storage),'heroChoice'),0);
});

test('another account or period cannot take over a pending claim and an inconsistent new rank cannot change its rewards',async()=>{
 const f=fixture();f.provider.writeWeeklyLedger=async()=>({written:false});await assert.rejects(f.claim());const before=assets(loadSolo(f.storage));await assert.rejects(f.claim({periodToken:'next-server-period'}),{code:'pendingOtherPeriod'});f.state.accountId='tap-account-digest-b';await assert.rejects(f.claim(),{code:'pendingOtherPeriod'});f.state.accountId=ACCOUNT;f.state.rank=11;await assert.rejects(f.claim(),{code:'rankChanged'});assert.deepEqual(assets(loadSolo(f.storage)),before);
});

test('normal imports cannot replay exported pending, either on this device or a different device',async()=>{
 const f=fixture();f.storage.failAt=f.storage.writes+2;await assert.rejects(f.claim(),{code:'localWriteFailed'});const exportedPending=f.storage.getItem(SOLO_KEY);f.storage.failAt=0;await f.claim();const delivered=loadSolo(f.storage);
 for(const previous of [delivered,undefined]){const imported=normalizeSolo(JSON.parse(exportedPending));imported.towerWeekly=mergeTowerWeeklyForImport(imported.towerWeekly,previous?.towerWeekly);assert.equal(imported.towerWeekly.pending,null);const target=memory();target.setItem(SOLO_KEY,JSON.stringify(imported));const before=assets(loadSolo(target));const result=await f.claim({storage:target});assert.equal(result.status,'alreadyClaimed');assert.deepEqual(assets(loadSolo(target)),before);assert.equal(f.state.writes,1);}
});

test('claim records never expire out of the deduplication ledger and full capacity refuses a new award',async()=>{
 const claims=Array.from({length:MAX_WEEKLY_CLAIMS},(_,i)=>record('closed-period-'+i,'claim-record-'+String(i).padStart(16,'0'),20)),state=normalizeTowerWeekly({version:1,receipts:claims});assert.equal(state.blocked,false);assert.equal(mergeTowerWeekly(state,state).blocked,false);assert.equal(mergeTowerWeekly(state,state).receipts.length,MAX_WEEKLY_CLAIMS);
 const f=fixture(),p=loadSolo(f.storage);p.towerWeekly=state;assert.ok(saveSolo(f.storage,p));const before=assets(loadSolo(f.storage));await assert.rejects(f.claim(),{code:'ledgerFull'});assert.deepEqual(assets(loadSolo(f.storage)),before);assert.equal(f.state.writes,0);
 const cloud=fixture();cloud.state.ledger.claims=claims.map(entry);await assert.rejects(cloud.claim(),{code:'ledgerFull'});assert.equal(cloud.state.writes,0);
});

test('full inventory cannot silently truncate a reward or spend its claim, and a later retry delivers the exact count',async()=>{
 const f=fixture(),p=loadSolo(f.storage);addItem(p,{type:'stoneHigh',count:9998});assert.ok(saveSolo(f.storage,p));await assert.rejects(f.claim(),{code:'inventoryFull'});assert.equal(f.state.writes,0);assert.equal(loadSolo(f.storage).towerWeekly.pending,null);const freed=loadSolo(f.storage);freed.bag.find(i=>i.type==='stoneHigh').count=9996;assert.ok(saveSolo(f.storage,freed));const result=await f.claim();assert.equal(result.status,'granted');assert.equal(count(result.profile,'stoneHigh'),9999);
});
