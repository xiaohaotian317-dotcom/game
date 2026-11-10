import test from 'node:test';
import assert from 'node:assert/strict';
import {DuelLink} from '../dist/src/duel-net.mjs';
import {RoomService,handleDuelRequest} from '../server/rooms.mjs';
import {localDatabase} from '../server/local-db.mjs';
import {DUEL_RULESET} from '../dist/src/duel-skill-data.mjs';

async function fixture(code){
 const db=localDatabase(':memory:');let now=Date.now();const service=new RoomService(db,{clock:()=>now}),host=await service.create({code,hero:'fire'}),guest=await service.join({code,hero:'frost'});
 await service.action(code,guest.token,{type:'ready',ready:true});await service.action(code,host.token,{type:'start'});await service.action(code,host.token,{type:'lock',ready:true});let room=(await service.action(code,guest.token,{type:'lock',ready:true})).room;
 const seen=[],errors=[],payloads=[],prior=globalThis.arcaneMobile;
 globalThis.arcaneMobile={bridge:{request:async options=>{const body=JSON.parse(options.body);payloads.push(body);const response=await handleDuelRequest(new Request('http://127.0.0.1'+options.path,{method:options.method,headers:{'Content-Type':'application/json','X-Duel-Token':options.token},body:options.body}),db);return {status:response.status,data:await response.json()};}}};
 const link=new DuelLink({lanMode:true,onRoom:r=>seen.push(r),onError:e=>errors.push(e)});link.session={code,token:host.token,seat:0};link.room={...room,seat:0};link.latestState={ruleset:DUEL_RULESET,epoch:room.epoch,roundSerial:room.roundSerial};link.input={epoch:room.epoch,roundSerial:room.roundSerial};
 return {db,service,host,guest,link,seen,errors,payloads,get room(){return room;},async win(){now+=3001;room=(await service.action(code,host.token,{type:'round',epoch:room.epoch,roundSerial:room.roundSerial,winner:0,hp:[180,0]})).room;},async poll(){link.running=true;try{await link.poll();}finally{link.running=false;clearTimeout(link.timer);}},close(){link.stop();if(prior===undefined)delete globalThis.arcaneMobile;else globalThis.arcaneMobile=prior;db.close();}};
}
test('a real Node room externally advanced to 3:0 is recovered by one snapshot-free sync and reaches finished',async()=>{
 const f=await fixture('REC471');try{
  for(let i=0;i<3;i++)await f.win();assert.equal(f.room.phase,'finished');assert.equal(f.link.room.roundSerial,1);
  await f.poll();assert.equal(f.link.room.phase,'finished');assert.deepEqual(f.link.room.score,[3,0]);assert.equal(f.link.room.winner,0);assert.equal(f.seen.at(-1).phase,'finished');
  assert.equal(f.payloads.length,2);assert.ok(f.payloads[0].snapshot);assert.equal(f.payloads[1].snapshot,undefined);assert.equal(f.payloads[1].resume,true);assert.ok(f.payloads[1].seq>f.payloads[0].seq);assert.equal(f.link.latestState,null);assert.equal(f.link.input,null);assert.deepEqual(f.errors,[null]);
 }finally{f.close();}
});
test('a real Node room next-round countdown recovers and can then publish a fresh authoritative snapshot normally',async()=>{
 const f=await fixture('REC472');try{await f.win();await f.poll();assert.equal(f.link.room.phase,'countdown');assert.equal(f.link.room.roundSerial,2);assert.deepEqual(f.link.room.score,[1,0]);
  f.link.latestState={ruleset:DUEL_RULESET,epoch:f.room.epoch,roundSerial:2};await f.poll();assert.equal(f.payloads.length,3);assert.equal(f.payloads[2].snapshot.roundSerial,2);assert.equal(f.payloads[2].resume,undefined);assert.deepEqual(f.errors,[null,null]);
 }finally{f.close();}
});
test('incompatible-ruleset 409 retains its status/data and never triggers snapshot-free recovery',async()=>{
 const f=await fixture('REC473');try{const bad={...f.link.latestState,ruleset:'incompatible-client'};f.link.latestState=bad;
  await assert.rejects(()=>f.link.request('rooms/REC473/sync',{epoch:f.room.epoch,seq:1,snapshot:bad}),error=>error.status===409&&/版本不一致/.test(error.data.error));f.payloads.length=0;
  await f.poll();assert.equal(f.payloads.length,1);assert.equal(f.link.latestState,bad);assert.equal(f.seen.length,0);assert.match(f.errors[0],/版本不一致/);assert.equal(f.link.room.roundSerial,1);
 }finally{f.close();}
});
test('failed recovery is bounded to one attempt and does not recursively retry or overwrite a newer snapshot',async()=>{
 const f=await fixture('REC474');try{await f.win();const bridge=globalThis.arcaneMobile.bridge,original=bridge.request;let count=0;
  const newer={ruleset:DUEL_RULESET,epoch:f.room.epoch,roundSerial:2};bridge.request=async options=>{count++;if(count===1){f.link.latestState=newer;return original(options);}return {status:503,data:{error:'临时不可用'}};};
  await f.poll();assert.equal(count,2);assert.equal(f.link.latestState,newer);assert.equal(f.errors.length,1);assert.equal(f.errors[0],'临时不可用');assert.equal(f.seen.length,0);
 }finally{f.close();}
});
