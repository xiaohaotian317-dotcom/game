import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createGameServer,gameOrigin} from '../server/http-server.mjs';
import {localDatabase} from '../server/local-db.mjs';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
async function start(db=localDatabase(),publicOrigin){
 const server=createGameServer({root,db,publicOrigin});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 return {base:'http://127.0.0.1:'+server.address().port,async stop(){await new Promise(r=>server.close(r));db.close();}};
}
async function post(base,route,body,origin,token){return fetch(base+'/api/duel/'+route,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...(token?{'X-Duel-Token':token}:{})},body:JSON.stringify(body)});}

test('standalone serves extensionless pages/assets and health without exposing build directories',async()=>{
 const app=await start();try{
  for(const p of ['/','/lobby','/duel','/characters','/skills','/src/match-rules.mjs'])assert.equal((await fetch(app.base+p)).status,200,p);
  assert.deepEqual(await (await fetch(app.base+'/healthz')).json(),{status:'ok'});
  for(const p of ['/server/index.js','/client/index.html','/.openai/hosting.json','/absent'])assert.equal((await fetch(app.base+p)).status,404,p);
  const head=await fetch(app.base+'/lobby',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal((await fetch(app.base+'/lobby',{method:'POST'})).status,405);
 }finally{await app.stop();}
});
test('HTTPS reverse proxy origin permits two room clients while retaining cross-site protection',async()=>{
 const origin='https://game.example.test',app=await start(localDatabase(),origin);try{
  const response=await post(app.base,'rooms',{code:'HTTPS1',name:'主机 · 你好'},origin);assert.equal(response.status,200);
  const host=await response.json();assert.equal(host.room.slots[0].name,'主机 · 你好');
  const guest=await (await post(app.base,'join',{code:'HTTPS1',name:'挑战者'},origin)).json();assert.equal(guest.room.seat,1);
  assert.equal((await post(app.base,'rooms/HTTPS1/action',{type:'ready',ready:true},origin,guest.token)).status,200);
  const started=await (await post(app.base,'rooms/HTTPS1/action',{type:'start'},origin,host.token)).json();assert.equal(started.room.phase,'selecting');
  assert.equal((await post(app.base,'rooms',{code:'EVIL1'},'https://other.example')).status,403);
  assert.equal((await post(app.base,'rooms',{code:'EVIL2'},'http://game.example.test')).status,403);
 }finally{await app.stop();}
});
test('standalone rooms survive database/service restart with original member token',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'arcane-db-test-')),filename=path.join(dir,'rooms.sqlite');
 let app=await start(localDatabase(filename));try{
  const host=await (await post(app.base,'rooms',{code:'SAVE01',name:'持久房间'})).json();await app.stop();app=null;
  app=await start(localDatabase(filename));
  const r=await fetch(app.base+'/api/duel/rooms/SAVE01',{headers:{'X-Duel-Token':host.token}});assert.equal(r.status,200);assert.equal((await r.json()).room.slots[0].name,'持久房间');
 }finally{if(app)await app.stop();await rm(dir,{recursive:true,force:true});}
});
test('public origin configuration rejects paths, credentials and unsupported schemes',()=>{
 assert.equal(gameOrigin('https://game.example.test:8443/'),'https://game.example.test:8443');
 for(const value of ['https://game.example.test/path','https://user:pass@game.example.test','file:///etc/passwd','https://game.example.test/?x=1'])assert.throws(()=>gameOrigin(value));
});
