import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {LanRuntime,hostAddress,lanAddresses} from '../desktop/lan-runtime.mjs';
import {DuelLink} from '../dist/src/duel-net.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const make=()=>new LanRuntime({root,uiPort:0,hostBind:'127.0.0.1',testMode:true});
async function request(app,route,body,token,origin=app.uiOrigin){return fetch(app.uiOrigin+'/api/duel/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...(token?{'X-Duel-Token':token}:{})},body:JSON.stringify(body)});}

test('LAN address entry accepts private IPv4 and rejects external URLs, credentials and paths',()=>{
 assert.equal(hostAddress('192.168.1.8'),'http://192.168.1.8:44174');
 assert.equal(hostAddress('http://10.0.0.2:55000/'),'http://10.0.0.2:55000');
 assert.equal(hostAddress('localhost:44174'),'http://127.0.0.1:44174');
 for(const value of ['8.8.8.8','https://192.168.1.8','192.168.1.8/secret','http://user:pass@10.0.0.2','http://10.0.0.2?x=1','172.32.0.2'])assert.throws(()=>hostAddress(value),value);
});
test('connection hints list physical private IPv4 first and exclude IPv6/internal/public adapters',()=>{
 const rows=lanAddresses({'vEthernet':[{family:'IPv4',internal:false,address:'172.18.0.1'}],'Wi-Fi':[{family:'IPv4',internal:false,address:'192.168.1.10'},{family:'IPv6',internal:false,address:'fe80::1'}],loopback:[{family:'IPv4',internal:true,address:'127.0.0.1'}],outside:[{family:'IPv4',internal:false,address:'8.8.8.8'}]});
 assert.deepEqual(rows.map(r=>r.ip),['192.168.1.10','172.18.0.1']);
});
test('two desktop runtimes use local assets and one LAN host for room readiness/selection',async()=>{
 const host=make(),guest=make();await host.start();await guest.start();try{
  assert.equal((await fetch(host.uiOrigin+'/index.html')).status,200);
  assert.equal((await fetch(guest.uiOrigin+'/lobby.html')).status,200);
  assert.equal((await request(guest,'rooms',{})).status,503);
  await host.host({port:0});assert.equal(host.state().mode,'host');
  await guest.connect({address:host.state().target});assert.equal(guest.state().mode,'guest');
  const h=await (await request(host,'rooms',{code:'LAN123',name:'房主'})).json();
  const g=await (await request(guest,'join',{code:'LAN123',name:'好友'})).json();assert.equal(g.room.seat,1);
  assert.equal((await request(host,'rooms/LAN123/action',{type:'start'},h.token)).status,409);
  await request(guest,'rooms/LAN123/action',{type:'ready',ready:true},g.token);
  const start=await (await request(host,'rooms/LAN123/action',{type:'start'},h.token)).json();assert.equal(start.room.phase,'selecting');
  assert.equal((await request(guest,'rooms',{code:'XSS1'},null,'https://outside.example')).status,403);
  assert.ok((await fetch(guest.uiOrigin+'/desktop.html')).headers.get('content-security-policy').includes("connect-src 'self'"));
  await host.reset();const lost=await request(guest,'rooms/LAN123/sync',{},g.token);assert.equal(lost.status,503);assert.match((await lost.json()).error,/连接不到房主/);
 }finally{await guest.close();await host.close();}
});
test('client rejects incompatible hosts without making an unrelated connection',async()=>{
 const wrong=http.createServer((_q,r)=>r.end(JSON.stringify({protocol:'other-app',build:'other'})));await new Promise(r=>wrong.listen(0,'127.0.0.1',r));
 const client=make();await client.start();try{await assert.rejects(()=>client.connect({address:'127.0.0.1:'+wrong.address().port}),/版本不一致/);assert.equal(client.state().mode,'offline');}finally{await client.close();await new Promise(r=>wrong.close(r));}
});
test('LAN peer negotiation never configures an external STUN/TURN server',()=>{
 const previous=globalThis.RTCPeerConnection;let options;
 globalThis.RTCPeerConnection=class{constructor(o){options=o;}};
 try{new DuelLink({lanMode:true}).peer();assert.deepEqual(options.iceServers,[]);}finally{if(previous===undefined)delete globalThis.RTCPeerConnection;else globalThis.RTCPeerConnection=previous;}
});
