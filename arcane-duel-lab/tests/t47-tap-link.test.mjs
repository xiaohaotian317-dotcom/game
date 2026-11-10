import test from 'node:test';
import assert from 'node:assert/strict';
import {TapDuelLink} from '../dist/src/tap-duel-link.mjs';
import {createDuel,duelSnapshot} from '../dist/src/duel-simulation.mjs';
import {DUEL_RULESET,defaultDuelLoadout} from '../dist/src/duel-skill-data.mjs';
import {utf8Bytes} from '../dist/src/tap-frame-codec.mjs';
const copy=v=>JSON.parse(JSON.stringify(v)),turn=()=>new Promise(r=>setImmediate(r));
const memory=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
class FakeSDK{
 constructor(){this.time=100000;this.clients=[];this.custom=[];this.controls=[];this.frames=[];this.frameInputs=[];this.room=null;this.tickId=0;this.syncId=1;this.holdFrames=false;this.frameResolvers=[];}
 client(id){
  const sdk=this,listeners=new Set(),bridge={id,listeners,configured:true,privacy:true,loggedIn:true,active:false,
   async status(){return {configured:this.configured,privacyAccepted:this.privacy,loggedIn:this.loggedIn,playerId:id};},async login(){this.loggedIn=true;return {openId:id};},async connect(){return {playerId:id};},
   async addListener(name,callback){assert.equal(name,'battle');listeners.add(callback);return {remove:()=>listeners.delete(callback)};},
   async create(body){sdk.room={id:'98765432101234',ownerId:id,properties:body.properties,players:[{id,properties:body.player.properties}]};return {room:copy(sdk.room)};},
   async join({roomId,player}){assert.equal(roomId,sdk.room.id);if(!sdk.room.players.some(p=>p.id===id)){const p={id,properties:player.properties};sdk.room.players.push(p);sdk.emit({type:'entered',roomId,player:p});}return {room:copy(sdk.room)};},
   async properties({scope,properties}){assert.equal(scope,'room');assert.ok(utf8Bytes(properties)<=1536);sdk.controls.push({id,method:'properties',at:sdk.time});sdk.room.properties=properties;sdk.emit({type:'roomProperties',roomId:sdk.room.id,properties});return {};},
   async sendCustom({data}){assert.ok(utf8Bytes(data)<=2048);sdk.controls.push({id,method:'sendCustom',at:sdk.time});sdk.custom.push({id,data,at:sdk.time});sdk.emit({type:'custom',playerId:id,data});return {};},
   async startFrame(){sdk.clients.forEach(c=>c.active=true);sdk.emit({type:'frameStart',room:copy(sdk.room),frameSyncId:sdk.syncId});return {};},
   async sendFrame({data,frameId,frameSyncId}){assert.ok(utf8Bytes(data)<=1000);assert.equal(frameId,sdk.tickId);assert.equal(frameSyncId,sdk.syncId);assert.ok(this.active);sdk.frames.push({id,data,tick:frameId,at:sdk.time});sdk.frameInputs.push({playerId:id,data,serverTime:sdk.time});if(sdk.holdFrames)await new Promise(r=>sdk.frameResolvers.push(r));return {};},
   async stopFrame(){sdk.clients.forEach(c=>c.active=false);sdk.emit({type:'frameStop',roomId:sdk.room.id,frameSyncId:sdk.syncId});return {};},async leave(){return {};},async disconnect(){return {};}
  };sdk.clients.push(bridge);return bridge;
 }
 emit(event){for(const client of this.clients)for(const listener of client.listeners)listener(copy(event));}
 async tick(links,ms=1000/30){this.time+=ms;this.tickId++;for(const link of links)await link.tick();if(this.clients.some(c=>c.active))this.emit({type:'frame',id:this.tickId,frameSyncId:this.syncId,roomId:this.room.id,inputs:this.frameInputs.splice(0)});for(let i=0;i<3;i++)await turn();}
 async wait(promise,links){let done=false,result,failure;promise.then(v=>{done=true;result=v;},e=>{done=true;failure=e;});for(let i=0;i<200&&!done;i++)await this.tick(links,50);assert.ok(done,'fake endpoint operation settled');if(failure)throw failure;return result;}
}
async function pair(t){const sdk=new FakeSDK(),received=[],inputs=[],errors=[];const options=bridge=>({bridge,storage:memory(),clock:()=>sdk.time,now:()=>sdk.time,manualTick:true,random:()=>.4});const host=new TapDuelLink({onInput:p=>inputs.push(p),onError:e=>errors.push(e)},options(sdk.client('host'))),guest=new TapDuelLink({onState:s=>received.push(s),onError:e=>errors.push(e)},options(sdk.client('guest')));t.after(()=>{host.stop();guest.stop();});await host.enter('create',{name:'房主',hero:'lightning'});await sdk.wait(guest.enter('join',{code:host.room.code,name:'好友',hero:'shadow'}),[host,guest]);return {sdk,host,guest,links:[host,guest],received,inputs,errors};}
async function start(p){const {sdk,host,guest,links}=p;await sdk.wait(guest.action({type:'ready',ready:true}),links);await sdk.wait(host.action({type:'start'}),links);await sdk.wait(host.action({type:'lock',ready:true}),links);await sdk.wait(guest.action({type:'lock',ready:true}),links);}
test('Tap unavailable or unconsented SDK never pretends that internet play is configured',async()=>{
 const sdk=new FakeSDK(),bridge=sdk.client('one');bridge.configured=false;const link=new TapDuelLink({}, {bridge,storage:memory(),manualTick:true});await assert.rejects(link.enter('create',{}),e=>e.code==='notConfigured');assert.equal(sdk.room,null);bridge.configured=true;bridge.privacy=false;await assert.rejects(link.enter('create',{}),e=>e.code==='privacyRequired');assert.equal(sdk.room,null);link.stop();
});
test('two fake SDK endpoints enforce ready/hero/loadout/countdown/first-three and return',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;assert.equal(host.room.slots[1].name,'好友');assert.equal(guest.room.seat,1);await assert.rejects(host.action({type:'start'}),/玩家还未准备/);
 await sdk.wait(guest.action({type:'ready',ready:true}),links);await sdk.wait(host.action({type:'start'}),links);assert.equal(host.room.scene,'lava');assert.equal(guest.room.phase,'selecting');
 await sdk.wait(guest.action({type:'hero',hero:'star'}),links);assert.equal(host.room.slots[1].hero,'star');const alt={q:'star-0-1',e:'star-1-1',r:'star-2-1'};await sdk.wait(guest.action({type:'loadout',loadout:alt}),links);assert.deepEqual(host.room.slots[1].loadout,alt);
 await sdk.wait(host.action({type:'lock',ready:true}),links);await sdk.wait(guest.action({type:'lock',ready:true}),links);assert.equal(host.room.phase,'countdown');assert.equal(host.room.startAt-host.room.serverTime,3000);await assert.rejects(host.action({type:'round',epoch:host.room.epoch,roundSerial:1,hp:[180,0],winner:0}),/倒计时/);
 for(let i=0;i<3;i++){sdk.time=host.room.startAt+1;await sdk.tick(links);await sdk.wait(host.action({type:'round',epoch:host.room.epoch,roundSerial:host.room.roundSerial,hp:[180,0],winner:0}),links);assert.equal(guest.room.score[0],i+1);}
 assert.equal(guest.room.phase,'finished');assert.equal(guest.room.winner,0);await sdk.wait(guest.action({type:'return'}),links);await sdk.wait(host.action({type:'return'}),links);assert.equal(guest.room.phase,'waiting');assert.equal(guest.room.slots[1].ready,false);
});
test('battle input and full compressed authority state travel only over bounded frame channel',async t=>{
 const p=await pair(t),{sdk,host,guest,links,received,inputs}=p;await start(p);sdk.time=host.room.startAt+1;await sdk.tick(links);
 const before=sdk.custom.length,match=createDuel(host.room.slots.map(s=>s.hero),host.room.scene,host.room.slots.map(s=>s.loadout)),snapshot=duelSnapshot(match,{epoch:host.room.epoch,roundSerial:host.room.roundSerial,seq:55});
 const packet={epoch:host.room.epoch,roundSerial:host.room.roundSerial,seq:10,input:{move:1,attack:true,aim:{x:600,y:400}},actions:[{id:12,type:'r'}]};guest.setInput(packet);host.setInput({...packet,seq:11});host.setState(snapshot);
 for(let i=0;i<25&&received.length===0;i++)await sdk.tick(links,34);
 assert.equal(inputs.at(-1).seq,10);assert.equal(received.at(-1).seq,55);assert.equal(received.at(-1).ruleset,DUEL_RULESET);assert.deepEqual(received.at(-1).worlds.map(w=>w.duelSkills.loadout),host.room.slots.map(s=>s.loadout));
 for(const item of sdk.custom.slice(before))assert.ok(!['input','state','snapshot'].includes(JSON.parse(item.data).k));
 const counts=new Map();for(const frame of sdk.frames){const key=frame.id+':'+frame.tick;counts.set(key,(counts.get(key)||0)+1);}assert.ok([...counts.values()].every(n=>n<=5));assert.ok(sdk.frames.every(f=>utf8Bytes(f.data)<=1000));assert.ok(host.snapshots.pendingSnapshots<=2);
});
test('Tap never promotes SDK migrated owner to an ongoing battle authority',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;await start(p);sdk.emit({type:'left',roomId:guest.room.code,playerId:'host',ownerId:'guest'});await turn();assert.equal(guest.connected,false);assert.equal(guest.session.seat,1);assert.equal(guest.session.hostId,'host');await assert.rejects(guest.action({type:'ready',ready:true}),/等待原房主/);sdk.time+=30001;await sdk.tick(links);assert.equal(guest.room.phase,'closed');
});
test('mismatched build and stale epoch room updates cannot start or rewind a match',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;await start(p);const current=copy(guest.room),stale={...current,epoch:'old-epoch',revision:current.revision-1,phase:'waiting'};sdk.emit({type:'roomProperties',roomId:guest.room.code,properties:JSON.stringify(stale)});await turn();assert.equal(guest.room.epoch,current.epoch);
 const other=new TapDuelLink({}, {bridge:sdk.client('old'),storage:memory(),build:'wrong-build',clock:()=>sdk.time,now:()=>sdk.time,manualTick:true});await assert.rejects(other.enter('join',{code:host.room.code}),e=>e.code==='versionMismatch');other.stop();assert.equal(host.room.slots[1].hero,'shadow');
});
test('Tap controls are bounded to twelve per second and never carry combat data',async t=>{
 const p=await pair(t),{sdk,host,links}=p;const tasks=Array.from({length:25},(_,i)=>host._sendControl({k:'test-control',i}));await sdk.wait(Promise.all(tasks),links);
 const packets=sdk.controls.filter(p=>p.id==='host');for(const packet of packets){const count=packets.filter(p=>p.at>packet.at-1000&&p.at<=packet.at).length;assert.ok(count<=12);}
 assert.ok(sdk.custom.every(p=>utf8Bytes(p.data)<=2048));
});
test('host reload cannot silently recreate an active battle or transfer its authority',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;await start(p);const bridge=host.tap,storage=host.storage;host.stop();const restored=new TapDuelLink({}, {bridge,storage,clock:()=>sdk.time,now:()=>sdk.time,manualTick:true});t.after(()=>restored.stop());assert.equal(await sdk.wait(restored.resume(),[restored,guest]),true);assert.equal(restored.room.phase,'closed');assert.equal(restored.room.reason,'authorityLost');assert.equal(guest.room.phase,'closed');
});
test('a closed-room hook may stop the link without hanging the host leave action',async t=>{
 const p=await pair(t),{sdk,host,links}=p;host.onRoom=room=>{if(room.phase==='closed')host.stop({forget:true});};await sdk.wait(host.action({type:'leave'}),links);assert.equal(host.running,false);assert.equal(host.session,null);
});
test('each real SDK frame drives exactly one input even when maintenance timers are coarse',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;await start(p);const packet={epoch:host.room.epoch,roundSerial:host.room.roundSerial,seq:1,input:{move:1,attack:false,aim:{x:800,y:300}},actions:[]};host.setInput(packet);guest.setInput(packet);const before=sdk.frames.length;
 // Frame callbacks remain30Hz while maintenance is deliberately run only every200ms.
 for(let frame=0;frame<120;frame++){sdk.time+=1000/30;sdk.tickId++;if(frame%6===0)for(const link of links)await link.tick();sdk.emit({type:'frame',id:sdk.tickId,frameSyncId:sdk.syncId,roomId:host.room.code,inputs:sdk.frameInputs.splice(0)});await turn();}
 const sent=sdk.frames.slice(before);assert.equal(sent.filter(f=>f.id==='host'&&JSON.parse(f.data).k==='i').length,120);assert.equal(sent.filter(f=>f.id==='guest'&&JSON.parse(f.data).k==='i').length,120);
 const count=sent.length;sdk.emit({type:'frame',id:sdk.tickId,frameSyncId:sdk.syncId,inputs:[]});sdk.emit({type:'frame',id:sdk.tickId-1,frameSyncId:sdk.syncId,inputs:[]});await turn();assert.equal(sdk.frames.length-before,count);
});
test('stopped/old sync frames and delayed acknowledgements cannot replay input or grow the send queue',async t=>{
 const p=await pair(t),{sdk,host,guest,links}=p;await start(p);host.setInput({epoch:host.room.epoch,roundSerial:1,seq:1,input:{move:1,aim:{x:800,y:300}},actions:[]});sdk.holdFrames=true;
 for(let i=0;i<20;i++)await sdk.tick(links);assert.equal(host.frameInFlight,5);const before=sdk.frames.length;assert.equal(before,5);
 sdk.emit({type:'frameStop',frameSyncId:sdk.syncId,roomId:host.room.code});sdk.emit({type:'frame',id:999,frameSyncId:sdk.syncId,inputs:[]});await turn();assert.equal(sdk.frames.length,before);assert.equal(host.frameInFlight,0);
 sdk.syncId++;sdk.clients.forEach(c=>c.active=true);sdk.emit({type:'frameStart',room:copy(sdk.room),frameSyncId:sdk.syncId});sdk.emit({type:'frame',id:1000,frameSyncId:sdk.syncId-1,inputs:[]});await turn();assert.equal(sdk.frames.length,before);
 sdk.holdFrames=false;for(const resolve of sdk.frameResolvers.splice(0))resolve();await turn();assert.equal(host.frameInFlight,0);await sdk.tick(links);assert.equal(sdk.frames.length,before+1);assert.equal(host.frameInFlight,0);
});
