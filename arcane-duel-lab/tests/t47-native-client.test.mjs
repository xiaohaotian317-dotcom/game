import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {existsSync,mkdirSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import {once} from 'node:events';
import {createGameServer} from '../server/http-server.mjs';
import {localDatabase} from '../server/local-db.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),native=path.join(root,'mobile/native'),cache=path.join(native,'.cache'),classes=path.join(cache,'client-classes');
const jdkRoot=path.resolve(root,'../.runtime-tools/android/jdk'),jdk=process.env.JAVA_HOME||(existsSync(jdkRoot)?path.join(jdkRoot,readdirSync(jdkRoot).find(n=>n.startsWith('jdk-'))||''):''),java=path.join(jdk,'bin/java.exe'),deps=[path.join(cache,'json.jar'),path.join(cache,'nanohttpd.jar')],available=existsSync(java)&&deps.every(existsSync);
const allProcesses=new Set();
function client(args=[]){
 const child=spawn(java,['-cp',[classes,...deps].join(path.delimiter),'com.xiaohaotian.arcaneduel.NativeClientHarness',...args],{stdio:['pipe','pipe','pipe'],windowsHide:true}),pending=new Map();let seq=0,errors='';allProcesses.add(child);
 child.stderr.on('data',d=>errors+=d);createInterface({input:child.stdout}).on('line',line=>{const value=JSON.parse(line),p=pending.get(value.id);if(p){pending.delete(value.id);clearTimeout(p.timer);p.resolve(value);}});
 child.on('exit',code=>{allProcesses.delete(child);for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Native client exited '+code+': '+errors));}pending.clear();});
 return {call(data){return new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Native client request timed out'));},10000);pending.set(id,{resolve,reject,timer});child.stdin.write(JSON.stringify({...data,id})+'\n');});},close(){child.stdin.end();},child};
}
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return 'http://127.0.0.1:'+server.address().port;}
async function stop(server){server.closeAllConnections?.();await new Promise(resolve=>server.close(resolve));}
let normal;
before(()=>{if(!available)return;mkdirSync(classes,{recursive:true});const directory=path.join(native,'src/com/xiaohaotian/arcaneduel'),result=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',classes,'-cp',deps.join(path.delimiter),...['LanRoomService','LanAddress','LanHttpClient','LanHttpServer'].map(n=>path.join(directory,n+'.java')),path.join(native,'testing/NativeClientHarness.java'),path.join(native,'testing/NativeRoomHarness.java')],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);normal=client();});
after(()=>{normal?.close();for(const process of allProcesses)process.stdin.end();});
const check=(name,fn)=>test(name,{skip:available?false:'Requires existing JDK / json / NanoHTTPD test caches'},fn);

async function playRoom(target,prefix){
 const request=async(path,body,token)=>{const r=await normal.call({target,path,method:body===undefined?'GET':'POST',body,token});assert.equal(r.ok,true,r.error);return r.response;};
 const host=await request('/api/duel/rooms',{code:prefix,name:'原生手机',hero:'lightning'},'');assert.equal(host.status,200);assert.equal(host.data.room.slots[0].name,'原生手机');
 const guest=await request('/api/duel/join',{code:prefix,name:'电脑版',hero:'shadow'},'');assert.equal(guest.status,200);
 assert.equal((await request(`/api/duel/rooms/${prefix}/action`,{type:'start'},host.data.token)).status,409);
 await request(`/api/duel/rooms/${prefix}/action`,{type:'ready',ready:true},guest.data.token);await request(`/api/duel/rooms/${prefix}/action`,{type:'start'},host.data.token);
 await request(`/api/duel/rooms/${prefix}/action`,{type:'lock',ready:true},host.data.token);const locked=await request(`/api/duel/rooms/${prefix}/action`,{type:'lock',ready:true},guest.data.token);assert.equal(locked.data.room.phase,'countdown');
 const epoch=locked.data.room.epoch;await request(`/api/duel/rooms/${prefix}/sync`,{epoch,seq:1,input:{move:1}},guest.data.token);const synced=await request(`/api/duel/rooms/${prefix}/sync`,{epoch},host.data.token);assert.equal(synced.data.input.move,1);
 assert.equal((await request(`/api/duel/rooms/${prefix}`,undefined,'fake')).status,403);
}
check('native Socket client interoperates with actual Node room HTTP, UTF-8 bodies, credentials and errors',async()=>{
 const db=localDatabase(),server=createGameServer({root:path.join(root,'dist'),db}),target=await listen(server);try{await playRoom(target,'SOC471');}finally{await stop(server);db.close();}
});
check('native Socket client interoperates with actual NanoHTTPD host and LAN build preflight',async()=>{
 const reserve=net.createServer(),target=await listen(reserve),port=new URL(target).port;await stop(reserve);
 const child=spawn(java,['-cp',[classes,...deps].join(path.delimiter),'com.xiaohaotian.arcaneduel.NativeRoomHarness','--server',port],{stdio:['pipe','pipe','pipe'],windowsHide:true});allProcesses.add(child);child.on('exit',()=>allProcesses.delete(child));
 const lines=createInterface({input:child.stdout});await once(lines,'line');try{
  const info=await normal.call({target,path:'/lan-info'});assert.equal(info.response.data.build,'android1-crossplay-v2');await playRoom(target,'SOC472');
 }finally{child.stdin.end();await once(child,'exit');}
});
check('native Socket client rejects public/ambiguous addresses, unsafe paths, methods, tokens and oversized requests before connecting',async()=>{
 for(const target of ['http://8.8.8.8:1','http://example.com','http://127.0.0.1@8.8.8.8','http://[::1]:1','https://127.0.0.1','http://127.0.0.1:1/x','http://127.0.0.1:1?x','http://2130706433:1','http://0x7f000001:1'])assert.equal((await normal.call({target})).ok,false,target);
 for(const overrides of [{path:'/healthz'},{path:'/api/duel/rooms/ABCD/action?x=1'},{path:'/api/duel/rooms/ABCD/action\r\nX: y'},{method:'DELETE'},{token:'bad\r\nInjected: yes'},{method:'POST',body:'x'.repeat(220001)}]){const r=await normal.call({target:'http://127.0.0.1:1',...overrides});assert.equal(r.ok,false);assert.equal(r.class,'IllegalArgumentException',r.error);}
});
async function rawResponse(raw,operation){
 const sockets=new Set(),server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.once('data',()=>{if(typeof raw==='function')raw(socket);else socket.end(raw);});socket.on('error',()=>{});}),target=await listen(server);
 try{return await operation(target);}finally{for(const socket of sockets)socket.destroy();await stop(server);}
}
check('native Socket HTTP correctly decodes content lengths, chunk extensions, trailers, interim responses and close-delimited JSON',async()=>{
 const body=Buffer.from(JSON.stringify({value:'局域网'}));
 for(const raw of [Buffer.concat([Buffer.from(`HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\n\r\n`),body]),Buffer.concat([Buffer.from('HTTP/1.1 100 Continue\r\n\r\nHTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n'+body.length.toString(16)+';name=value\r\n'),body,Buffer.from('\r\n0\r\nX-Checksum: done\r\n\r\n')]),Buffer.concat([Buffer.from('HTTP/1.0 200 OK\r\n\r\n'),body])]){
  await rawResponse(raw,async target=>{const r=await normal.call({target});assert.equal(r.ok,true,r.error);assert.deepEqual(r.response,{status:200,data:{value:'局域网'}});});
 }
});
check('native Socket HTTP rejects redirect, conflicting/invalid lengths, truncation, encoding, excessive headers and body bombs',async()=>{
 const bad=[
 'HTTP/1.1 302 Found\r\nLocation: http://8.8.8.8/\r\nContent-Length: 2\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Length: 2\r\nTransfer-Encoding: chunked\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Length: -2\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Length: 1000001\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\nContent-Length: 2\r\n\r\n{}',
 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nz\r\n{}\r\n0\r\n\r\n',
 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\nf4241\r\n',
 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n2\r\n{}XX0\r\n\r\n',
 'HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n0\r\nContent-Length: 2\r\n\r\n',
 'HTTP/1.1 200 OK\r\n'+Array.from({length:65},(_,i)=>`X-${i}: value\r\n`).join('')+'\r\n{}',
 'HTTP/1.1 200 OK\r\nX-Large: '+'x'.repeat(9000)+'\r\n\r\n{}',
 'HTTP/1.0 200 OK\r\n\r\n'+'x'.repeat(1000001)
 ];
 for(const raw of bad)await rawResponse(raw,async target=>{const r=await normal.call({target});assert.equal(r.ok,false,raw.slice(0,100));});
});
check('native Socket reset closes all in-flight requests and leaves the client reusable',async()=>{
 await rawResponse(()=>{},async target=>{const pending=[normal.call({target}),normal.call({target})];
  for(let i=0;i<20;i++){if((await normal.call({op:'stats'})).active===2)break;await new Promise(resolve=>setTimeout(resolve,5));}
  assert.equal((await normal.call({op:'stats'})).active,2);const started=Date.now();assert.equal((await normal.call({op:'cancel'})).active,0);const done=await Promise.all(pending);assert.ok(done.every(v=>!v.ok&&/取消/.test(v.error)));assert.ok(Date.now()-started<1000);
 });
 await rawResponse('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}',async target=>assert.equal((await normal.call({target})).ok,true));
});
check('native Socket client enforces bounded concurrent requests and a total I/O deadline',async()=>{
 const limited=client(['400','750','2']);try{await rawResponse(()=>{},async target=>{
  const first=limited.call({target}),second=limited.call({target});for(let i=0;i<20;i++){if((await limited.call({op:'stats'})).active===2)break;await new Promise(resolve=>setTimeout(resolve,2));}
  const extra=await limited.call({target});assert.equal(extra.ok,false);assert.match(extra.error,/繁忙/);const done=await Promise.all([first,second]);assert.ok(done.every(v=>!v.ok&&/超时/.test(v.error)));
 });
 // Bytes arriving before SO_TIMEOUT must still not extend the overall response deadline.
 await rawResponse(socket=>{socket.write('HTTP/1.1 200 OK\r\nContent-Length: 100\r\n\r\n{');const ticker=setInterval(()=>socket.write(' '),100);socket.on('close',()=>clearInterval(ticker));},async target=>{
  const started=Date.now(),r=await limited.call({target});assert.equal(r.ok,false);assert.match(r.error,/超时/);assert.ok(Date.now()-started<2000,'trickling response must not defeat the total I/O deadline');
 });}finally{limited.close();}
});
