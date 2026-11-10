import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeTapInput,decodeTapInput,encodeTapSnapshot,TapSnapshotAssembler,LatestTapSnapshots,utf8Bytes,TAP_FRAME_BYTES} from '../dist/src/tap-frame-codec.mjs';

const input={epoch:'测验-epoch',roundSerial:2,seq:1700000000000000,input:{move:1,attack:true,down:false,drop:false,aim:{x:2100.1234,y:700.5},view:{x:3,y:-20,width:1680,height:800}},actions:Array.from({length:24},(_,i)=>({id:1700000000000000+i,type:['attack','jump','dash','interact','q','e','r'][i%7]}))};
test('Tap input preserves all actions in one <=1000 UTF-8 byte frame',()=>{
 const raw=encodeTapInput(input);assert.ok(utf8Bytes(raw)<=TAP_FRAME_BYTES);const packet=decodeTapInput(raw);assert.deepEqual(packet.actions,input.actions);assert.equal(packet.seq,input.seq);assert.equal(packet.input.aim.x,2100.1);assert.equal(packet.input.attack,true);assert.equal(packet.input.view.width,1680);
 assert.equal(decodeTapInput(raw+'x'),null);assert.equal(decodeTapInput(JSON.stringify({...JSON.parse(raw),p:[3,0,0,0,0,0]})),null);assert.equal(decodeTapInput('x'.repeat(1001)),null);
});
test('Tap snapshot deflate packets reassemble out of order, once, with exact state',async()=>{
 const snapshot={epoch:'epoch',roundSerial:3,seq:400,worlds:[{hero:'fire',effects:Array.from({length:200},(_,i)=>({id:i,x:i*1.31,life:i*.391,name:'fire'}))},{hero:'star'}]};
 const parts=await encodeTapSnapshot(snapshot);assert.ok(parts.length>1);assert.ok(parts.every(p=>utf8Bytes(p)<=1000));const assembler=new TapSnapshotAssembler();assembler.reset('epoch',3);let result;
 for(const part of [...parts].reverse()){const value=await assembler.push(part);if(value)result=value;}
 assert.deepEqual(result,snapshot);assert.equal(await assembler.push(parts[0]),null);assert.equal(assembler.pending.size,0);
});
test('Tap snapshot rejects wrong context, expired partials and reset during decompression',async()=>{
 let clock=0;const assembler=new TapSnapshotAssembler({now:()=>clock,ttl:100});assembler.reset('e',1);const parts=await encodeTapSnapshot({epoch:'e',roundSerial:1,seq:10,data:Array.from({length:500},(_,i)=>i*12345).join(':')});
 await assembler.push(parts[0]);clock=101;for(const p of parts.slice(1))assert.equal(await assembler.push(p),null);assert.equal(assembler.lastSequence,-1);
 assembler.reset('other',1);for(const p of parts)assert.equal(await assembler.push(p),null);
 assembler.reset('e',1);const complete=await encodeTapSnapshot({epoch:'e',roundSerial:1,seq:11,value:1});const pending=assembler.push(complete[0]);assembler.reset('e',2);assert.equal(await pending,null);assert.equal(assembler.lastSequence,-1);
});
test('Tap reassembly and sender queues remain bounded under incomplete or superseded snapshots',async()=>{
 const assembler=new TapSnapshotAssembler({maxPending:2});assembler.reset('e',1);
 for(let seq=0;seq<12;seq++){const parts=await encodeTapSnapshot({epoch:'e',roundSerial:1,seq,data:Array.from({length:500},(_,i)=>i*(seq+13)).join('-')});await assembler.push(parts[0]);assert.ok(assembler.pending.size<=2);}
 const queue=new LatestTapSnapshots();queue.offer(['a','b','c','d','e','f']);for(let i=0;i<100;i++)queue.offer(['latest-'+i]);assert.equal(queue.pendingSnapshots,2);assert.deepEqual(queue.take(5),['a','b','c','d','e']);assert.deepEqual(queue.take(5),['f','latest-99']);assert.equal(queue.pendingSnapshots,0);
});
test('Tap malformed/compression bomb metadata cannot produce a snapshot',async()=>{
 const assembler=new TapSnapshotAssembler();assembler.reset('e',1);
 for(const value of [{n:999,i:0,z:2,b:'AAAA'},{n:1,i:0,z:180001,b:'AAAA'},{n:1,i:0,z:2,b:'!!!!'},{n:1,i:0,z:2,b:'AAAA'}])assert.equal(await assembler.push(JSON.stringify({v:1,k:'s',e:'e',r:1,q:1,c:'d',...value})),null);
 assert.equal(assembler.lastSequence,-1);assert.ok(assembler.pending.size<=2);
});
test('failed fragments retry only for the newest state, twice, without growing a replay queue',async()=>{
 const queue=new LatestTapSnapshots(),parts=await encodeTapSnapshot({epoch:'e',roundSerial:1,seq:1,data:'x'.repeat(5000)});queue.offer(parts);const failed=queue.take(1);assert.equal(queue.requeue(failed),true);assert.deepEqual(queue.take(1),failed);assert.equal(queue.requeue(failed),true);queue.take(1);assert.equal(queue.requeue(failed),false);
 const newer=await encodeTapSnapshot({epoch:'e',roundSerial:1,seq:2,data:'y'.repeat(5000)});queue.offer(newer);assert.equal(queue.requeue(failed),false);assert.ok(queue.pendingSnapshots<=2);assert.ok(queue.retryCounts.size<=256);
});
