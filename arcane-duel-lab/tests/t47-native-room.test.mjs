import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {RoomService} from '../server/rooms.mjs';
import {localDatabase} from '../server/local-db.mjs';
import {DUEL_RULESET,defaultDuelLoadout,duelSkillChoices} from '../dist/src/duel-skill-data.mjs';
import {MAX_HEALTH,WIN_SCORE} from '../dist/src/match-rules.mjs';
import {LAN_BUILD,hostAddress} from '../desktop/lan-runtime.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),native=path.join(root,'mobile/native'),cache=path.join(native,'.cache'),classes=path.join(cache,'classes');
const jdkBase=path.resolve(root,'../.runtime-tools/android/jdk'),jdk=process.env.JAVA_HOME||(existsSync(jdkBase)?path.join(jdkBase,readdirSync(jdkBase).find(v=>v.startsWith('jdk-'))||''):''),java=path.join(jdk,'bin/java.exe');
const dependencies=[path.join(cache,'json.jar'),path.join(cache,'nanohttpd.jar')];
const available=existsSync(java)&&dependencies.every(existsSync);
let harness;
function lineClient(args=[]){
 const child=spawn(java,['-cp',[classes,...dependencies].join(path.delimiter),'com.xiaohaotian.arcaneduel.NativeRoomHarness',...args],{stdio:['pipe','pipe','pipe'],windowsHide:true});
 const waiters=[];const lines=createInterface({input:child.stdout});let stderr='';child.stderr.on('data',v=>stderr+=v);
 lines.on('line',text=>{const waiter=waiters.shift();if(waiter)waiter.resolve(JSON.parse(text));});
 child.on('exit',code=>{for(const item of waiters.splice(0))item.reject(Error(`JVM exited ${code}: ${stderr}`));});
 const next=()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Native harness timed out')),8000);waiters.push({resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});});
 return {child,next,call(data){const promise=next();child.stdin.write(JSON.stringify(data)+'\n');return promise;},close(){child.stdin.end();}};
}
before(()=>{
 if(!available)return;mkdirSync(classes,{recursive:true});
 const dir=path.join(native,'src/com/xiaohaotian/arcaneduel'),result=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',classes,'-cp',dependencies.join(path.delimiter),...['LanRoomService','LanHttpServer','LanAddress'].map(v=>path.join(dir,v+'.java')),path.join(native,'testing/NativeRoomHarness.java')],{encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);harness=lineClient();
});
after(()=>harness?.close());
const nativeTest=(name,fn)=>test(name,{skip:available?false:'Requires local JDK21 and official json/NanoHTTPD jars; see mobile/native/README.md'},fn);
const request=(code,token,body,time,method='POST')=>harness.call({method,path:'/api/duel/rooms/'+code+(method==='GET'?'':'/action'),token,body,time});
async function session(code){
 const host=await harness.call({path:'/api/duel/rooms',body:{code,name:'<主机>\u0001',hero:'lightning'},time:100000});assert.equal(host.status,200);
 const guest=await harness.call({path:'/api/duel/join',body:{code,hero:'shadow'},time:100000});assert.equal(guest.status,200);
 return {host:host.data.token,guest:guest.data.token,room:guest.data.room};
}
async function ready(code,s){await request(code,s.guest,{type:'ready',ready:true});await request(code,s.host,{type:'start'});await request(code,s.host,{type:'lock',ready:true});return (await request(code,s.guest,{type:'lock',ready:true})).data.room;}

test('native build discriminator, hero health and skill choices stay aligned with shared core',()=>{
 const java=readFileSync(path.join(native,'src/com/xiaohaotian/arcaneduel/LanRoomService.java'),'utf8');assert.ok(java.includes(`RULESET = "${DUEL_RULESET}"`));assert.ok(java.includes(`BUILD = "${LAN_BUILD}"`));assert.equal(WIN_SCORE,3);
 assert.deepEqual(MAX_HEALTH,{fire:180,nature:180,frost:165,lightning:180,shadow:165,star:173});
 for(const hero of Object.keys(MAX_HEALTH)){assert.deepEqual(defaultDuelLoadout(hero),{q:`${hero}-0-0`,e:`${hero}-1-0`,r:`${hero}-2-0`});assert.deepEqual(duelSkillChoices(hero).map(v=>v.id).sort(),[0,1,2].flatMap(row=>[`${hero}-${row}-0`,`${hero}-${row}-1`]).sort());}
});
nativeTest('native private IPv4 address normalization agrees with desktop',async()=>{
 for(const address of ['192.168.1.2','10.1.2.3:44174','localhost:44444','http://172.16.1.3/','169.254.2.3:10000','127.0.0.1'])assert.equal((await harness.call({address})).address,hostAddress(address));
 for(const address of ['https://192.168.1.2','8.8.8.8','evil.test','192.168.1.2/path','192.168.1.2?x=1','http://x:y@192.168.1.2','192.168.1.2:0','192.168.1.999','172.32.1.3','[::1]'])assert.ok((await harness.call({address})).error,address);
});
nativeTest('native room lifecycle matches Node authority, two seats, readiness, loadouts and first-to-three',async()=>{
 const code='NAT471',s=await session(code),db=localDatabase();let time=100000;
 const node=new RoomService(db,{clock:()=>time,random:()=>0.45}),nh=await node.create({code,name:'<主机>\u0001',hero:'lightning'}),ng=await node.join({code,hero:'shadow'});
 const normalize=room=>({...room,epoch:'epoch',scene:room.scene===null?null:'random-scene'});
 const nodeTokens=[nh.token,ng.token],nativeTokens=[s.host,s.guest];
 const action=async(seat,body)=>{const n=await node.action(code,nodeTokens[seat],body),a=await request(code,nativeTokens[seat],body,time);assert.equal(a.status,200);assert.deepEqual(normalize(a.data.room),normalize(n.room));return a.data.room;};
 assert.equal((await request(code,s.host,{type:'start'})).status,409);assert.equal((await request(code,s.guest,{type:'start'})).status,403);
 await action(1,{type:'ready',ready:true});await action(0,{type:'start'});await action(0,{type:'hero',hero:'star'});await action(0,{type:'loadout',loadout:{q:'star-0-1',e:'star-1-1',r:'star-2-1'}});
 assert.equal((await request(code,s.host,{type:'loadout',loadout:{q:'fire-0-0',e:'star-1-1',r:'star-2-1'}})).status,400);
 await action(0,{type:'lock',ready:true});let room=await action(1,{type:'lock',ready:true});
 for(const winner of [0,1,0,1,0]){time+=3001;const nativeRound={type:'round',epoch:room.epoch,roundSerial:room.roundSerial,winner,hp:winner===0?[173,0]:[0,165]},nodeRoom=await node.row(code),epoch=JSON.parse(nodeRoom.data).epoch;
   const expected=await node.action(code,nh.token,{...nativeRound,epoch}),actual=await request(code,s.host,nativeRound,time);assert.equal(actual.status,200);assert.deepEqual(normalize(actual.data.room),normalize(expected.room));room=actual.data.room;
 }
 assert.equal(room.phase,'finished');assert.deepEqual(room.score,[3,2]);await action(0,{type:'return'});room=await action(1,{type:'return'});assert.equal(room.phase,'waiting');db.close();
});
nativeTest('native relay ignores stale/foreign authority and validates epochs, payload size and disconnect claim',async()=>{
 const code='NAT472',s=await session(code);let room=await ready(code,s),epoch=room.epoch;
 const sync=(seat,body,time=100001)=>harness.call({path:`/api/duel/rooms/${code}/sync`,token:seat===0?s.host:s.guest,body,time});
 assert.equal((await sync(1,{epoch,seq:2,input:{move:1}})).status,200);await sync(1,{epoch,seq:1,input:{move:-1},snapshot:{fake:true}});
 let res=await sync(0,{resume:true});assert.equal(res.data.input.move,1);assert.equal(res.data.snapshot,null);
 assert.equal((await sync(0,{epoch,seq:4,snapshot:{ruleset:'bad',epoch,roundSerial:1}})).status,409);
 assert.equal((await sync(0,{epoch,seq:4,snapshot:{epoch,roundSerial:0}})).status,409);
 const snapshot={epoch,roundSerial:1,ruleset:DUEL_RULESET,worlds:[]};await sync(0,{epoch,seq:4,snapshot});
 res=await sync(1,{});assert.deepEqual(res.data.snapshot,snapshot);assert.equal((await sync(0,{resume:true})).data.relaySeq,4);
 assert.equal((await sync(1,{epoch,seq:9,input:{pad:'x'.repeat(12001)}})).status,400);
 assert.equal((await request(code,s.host,{type:'forfeit'},100002)).status,409);res=await request(code,s.host,{type:'forfeit'},130003);assert.equal(res.data.room.reason,'disconnect');
 assert.equal((await request(code,'fake',{},130004,'GET')).status,403);
});
nativeTest('native real HTTP host handles desktop clients, origin restrictions, payload cap and concurrent joins',async()=>{
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
 const srv=lineClient(['--server',String(port)]);assert.deepEqual(await srv.next(),{started:true});
 try{const base=`http://127.0.0.1:${port}`,json=async(url,body,headers={})=>{const r=await fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:typeof body==='string'?body:JSON.stringify(body)});const text=await r.text();assert.ok(text.startsWith('{'),`Native ${url} ${r.status}: ${text.slice(0,180)}`);return {status:r.status,data:JSON.parse(text)};};
   assert.equal((await (await fetch(base+'/lan-info')).json()).build,LAN_BUILD);
   const created=await json('/api/duel/rooms',{code:'NAT473',hero:'frost'});assert.equal(created.status,200);assert.equal(created.data.room.slots[0].hero,'frost');
   const joins=await Promise.all([json('/api/duel/join',{code:'NAT473'}),json('/api/duel/join',{code:'NAT473'})]);assert.deepEqual(joins.map(v=>v.status).sort(),[200,409]);
   assert.equal((await json('/api/duel/rooms','{')).status,400);assert.equal((await json('/api/duel/rooms',{}, {Origin:'https://elsewhere.invalid'})).status,403);
   for(let i=0;i<6;i++){
     assert.equal((await json('/api/duel/rooms',{padding:'x'.repeat(220001)})).status,413);
     assert.equal((await json('/api/duel/rooms',{}, {Origin:'https://elsewhere.invalid'})).status,403);
     assert.equal((await json('/api/duel/rooms',{code:'AFT47'+i})).status,200,'rejected body must not poison the next connection');
   }
 }finally{srv.close();}
});
