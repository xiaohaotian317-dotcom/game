import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {TapDuelLink,tapBattleAvailable} from '../dist/src/tap-duel-link.mjs';
import {DUEL_RULESET,defaultDuelLoadout} from '../dist/src/duel-skill-data.mjs';
import {createTowerProvider} from '../mobile/tower-provider.mjs';
import {claimTowerWeeklyReward} from '../dist/src/tower-weekly-rewards.mjs';
import {freshSolo,loadSolo,saveSolo} from '../dist/src/campaign-profile.mjs';

const copy=value=>structuredClone(value);
const memory=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
const slot=hero=>({name:hero,hero,loadout:defaultDuelLoadout(hero),ready:true,locked:true,returned:false});
function fixture(){
 let time=100000;const errors=[],states=[],room={protocol:'arcane-tap-v1',build:'android1-crossplay-v3',ruleset:DUEL_RULESET,winScore:3,code:'audit-room',hostId:'host',guestId:'guest',phase:'active',epoch:'audit-epoch',revision:1,roundSerial:1,round:1,startAt:90000,serverTime:time,seen:[time,time],score:[0,0],slots:[slot('fire'),slot('frost')]};
 const bridge={async sendCustom(){},async properties(){},async leave(){}};
 const link=new TapDuelLink({onError:e=>errors.push(e),onRoom:r=>states.push(copy(r))},{bridge,storage:memory(),manualTick:true,clock:()=>time,now:()=>time});
 link.playerId='host';link.session={code:room.code,seat:0,playerId:'host',hostId:'host',build:room.build};link.room={...copy(room),seat:0};link.hostRoom=copy(room);link.running=true;link.connected=true;link.frameReady=true;link.frameSyncId=11;link.sdkFrameId=10;link.input={epoch:room.epoch,roundSerial:1,seq:1,input:{move:1},actions:[]};
 return {link,errors,states,get time(){return time;},set time(value){time=value;}};
}

test('a native battle-service failure immediately clears frame credit and reaches bounded room closure',async()=>{
 const f=fixture();try{let statusCalls=0;f.link.onStatus=()=>statusCalls++;
  await f.link._event({type:'serviceError'});
  assert.equal(tapBattleAvailable(f.link),false);assert.equal(f.link.connected,false);assert.equal(f.link.frameReady,false);assert.equal(f.link.input,null);assert.equal(f.link.frameInFlight,0);assert.equal(statusCalls,1);
  await assert.rejects(f.link.action({type:'ready',ready:true}),/连接已中断/);
  f.time+=30001;await f.link.tick();assert.equal(f.link.room.phase,'closed');assert.equal(f.link.room.reason,'hostUnavailable');
 }finally{f.link.stop();}
});

test('stopping frame sync freezes the active battle despite live custom-channel heartbeats',async()=>{
 const f=fixture();try{
  await f.link._event({type:'frameStop',roomId:f.link.room.code,frameSyncId:11});
  assert.equal(tapBattleAvailable(f.link),false);assert.equal(f.link.connected,false);assert.equal(f.link.input,null);
  // The SDK may still deliver room-control pings. They cannot reopen the
  // battle channel or prevent the 30-second closed-room transition.
  for(let i=0;i<3;i++){
   f.time+=1000;
   await f.link._event({type:'custom',playerId:'guest',data:JSON.stringify({v:1,protocol:'arcane-tap-v1',build:f.link.build,ruleset:DUEL_RULESET,k:'room-heartbeat'})});
   assert.equal(tapBattleAvailable(f.link),false);
  }
  f.time+=30001;await f.link.tick();assert.equal(f.link.room.phase,'closed');
 }finally{f.link.stop();}
});

test('expected frame stop after a finished match does not disconnect the room',async()=>{
 const f=fixture();try{f.link.room.phase='finished';f.link.hostRoom.phase='finished';await f.link._event({type:'frameStop',roomId:f.link.room.code,frameSyncId:11});assert.equal(f.link.connected,true);assert.equal(f.link.frameReady,false);assert.equal(f.link.disconnectAt,null);assert.equal(f.errors.length,0);}finally{f.link.stop();}
});

test('wrong-room and stale sync stops are inert, and migrated owner cannot reopen authority',async()=>{
 const f=fixture();try{
  await f.link._event({type:'frameStop',roomId:'different-room',frameSyncId:11});assert.equal(tapBattleAvailable(f.link),true);
  await f.link._event({type:'frameStop',roomId:f.link.room.code,frameSyncId:10});assert.equal(tapBattleAvailable(f.link),true);
  await f.link._event({type:'serviceError'});
  await f.link._event({type:'frameStart',room:{id:f.link.room.code,ownerId:'guest'},frameSyncId:12});
  assert.equal(tapBattleAvailable(f.link),false);assert.equal(f.link.session.hostId,'host');assert.equal(f.link.session.seat,0);
 }finally{f.link.stop();}
});

test('an original-owner frame restart can restore transport, while leaving input cleared',async()=>{
 const f=fixture();try{await f.link._event({type:'frameStop',roomId:f.link.room.code,frameSyncId:11});await f.link._event({type:'frameStart',room:{id:f.link.room.code,ownerId:'host'},frameSyncId:12});assert.equal(tapBattleAvailable(f.link),true);assert.equal(f.link.frameSyncId,12);assert.equal(f.link.input,null);assert.equal(f.link.sdkFrameId,-1);assert.equal(f.link.disconnectAt,null);}finally{f.link.stop();}
});

test('the actual duel view pauses its Worker synchronously on channel loss and refuses prediction',()=>{
 const source=readFileSync(new URL('../dist/src/duel-app.mjs',import.meta.url),'utf8');
 const network=source.slice(source.indexOf('function networkStatus(){'),source.indexOf('async function loadBattle('));
 const playable=source.match(/function playable\(\)\{return [^\n]+\}/)?.[0];assert.ok(playable);
 const elements=new Map(),messages=[];let clears=0;
 const context={tapMode:true,bridge:{},room:{phase:'active',startAt:0},link:{rtt:5,transport:'tap',connected:false,frameReady:false,clockOffset:0},match:{},nativeBackground:false,pausedForConnection:false,reporting:false,tapBattleAvailable,safetyAllowsPlay:()=>true,clearControls:()=>clears++,worker:{postMessage:message=>messages.push(message)},$:selector=>{if(!elements.has(selector))elements.set(selector,{});return elements.get(selector);}};
 vm.runInNewContext(network+playable+';networkStatus();this.canPlay=playable();',context);
 assert.equal(context.pausedForConnection,true);assert.equal(context.canPlay,false);assert.equal(clears,1);assert.equal(messages.length,1);assert.equal(messages[0].kind,'pause');assert.equal(messages[0].value,true);assert.match(elements.get('#network-state').textContent,/恢复/);
 // Keyboard LAN remains governed by its existing heartbeat rules.
 context.tapMode=false;context.pausedForConnection=false;vm.runInNewContext('this.canPlay=playable();',context);assert.equal(context.canPlay,true);
 // A Worker created during an unavailable Tap countdown starts paused.
 assert.match(source,/kind:'reset',paused:nativeBackground\|\|!safetyAllowsPlay\(\)\|\|tapMode&&!tapBattleAvailable\(link\)/);
});

test('the actual mobile weekly provider keeps ranking but cannot issue a non-atomic prize',async()=>{
 let nativeWrites=0;const provider=createTowerProvider({
  status:async()=>({available:true,connected:true,weeklyRewards:true,weeklyClaimAtomic:true}),
  getHistoricalRank:async({periodToken})=>({available:true,accountId:'audit-account',periodToken,ended:true,rank:1}),
  loadWeeklyLedger:async()=>({available:true,accountId:'audit-account',revision:'',ledger:{version:1,claims:[]},atomicCompareAndSwap:false}),
  writeWeeklyLedger:async()=>{nativeWrites++;return {written:true};},
  leaderboard:async()=>({available:true,connected:true,entries:[]})
 });
 const status=await provider.status();assert.equal(status.weeklyRewards,false);assert.equal(status.weeklyClaimAtomic,false);assert.equal((await provider.getLeaderboard()).available,true);
 const write=await provider.writeWeeklyLedger({expectedRevision:'',ledger:{version:1,claims:[]}});assert.equal(write.reason,'atomicClaimUnavailable');assert.equal(nativeWrites,0);
 const storage=memory();assert.ok(saveSolo(storage,freshSolo()));const before=copy(loadSolo(storage));
 await assert.rejects(claimTowerWeeklyReward({storage,provider,periodToken:'audit-ended-period',nonceFactory:()=> 'audit-claim-0000000001',locks:null}));
 const after=loadSolo(storage);assert.deepEqual(after.bag,before.bag);assert.equal(after.coins,before.coins);assert.equal(after.tickets,before.tickets);assert.equal(after.towerWeekly.receipts.length,0);assert.equal(nativeWrites,0);
});

test('capability audit: revision preflight plus readback cannot make a non-CAS archive atomic',async()=>{
 // Deterministic in-memory model of two SDK uploads, not a real cloud test.
 // Both native preflights read revision r0 before either upload. A confirms
 // its own upload and grants; B then overwrites it and also confirms/grants.
 let revision='r0',ledger={version:1,claims:[]},initialReads=0,preflights=0;
 let releaseInitial,releasePreflights,releaseB;
 const initialBarrier=new Promise(resolve=>releaseInitial=resolve),preflightBarrier=new Promise(resolve=>releasePreflights=resolve),aGranted=new Promise(resolve=>releaseB=resolve);
 const model=id=>{let reads=0;return {
  async getHistoricalRank({periodToken}){return {accountId:'audit-model-account',periodToken,ended:true,rank:1};},
  async loadWeeklyLedger(){reads++;if(reads===1){const state={accountId:'audit-model-account',revision,ledger:copy(ledger)};if(++initialReads===2)releaseInitial();await initialBarrier;return state;}return {accountId:'audit-model-account',revision,ledger:copy(ledger)};},
  async writeWeeklyLedger(request){assert.equal(request.expectedRevision,revision);if(++preflights===2)releasePreflights();await preflightBarrier;if(id==='b')await aGranted;revision='r-'+id;ledger=copy(request.ledger);return {written:true,accountId:'audit-model-account',revision,ledger:copy(ledger)};}
 };};
 const a=memory(),b=memory();saveSolo(a,freshSolo());saveSolo(b,freshSolo());
 const first=claimTowerWeeklyReward({storage:a,provider:model('a'),periodToken:'audit-ended-period',nonceFactory:()=> 'audit-device-a-0000001',locks:null}).then(result=>{releaseB();return result;});
 const second=claimTowerWeeklyReward({storage:b,provider:model('b'),periodToken:'audit-ended-period',nonceFactory:()=> 'audit-device-b-0000001',locks:null});
 const results=await Promise.all([first,second]);assert.deepEqual(results.map(result=>result.status),['granted','granted']);assert.equal(ledger.claims.length,1);assert.equal(loadSolo(a).bag.find(item=>item.type==='heroChoice').count,1);assert.equal(loadSolo(b).bag.find(item=>item.type==='heroChoice').count,1);
});
