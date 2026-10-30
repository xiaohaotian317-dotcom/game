import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,requestCast,step,STEP} from '../dist/src/simulation.mjs';
for(const hero of ['lightning','shadow'])for(const face of [-1,1])test(hero+' overlap hits but targets fully behind do not, facing '+face,()=>{
  for(const [offset,hit] of [[0,true],[-30,true],[-70,false],[70,true]]){
    const w=createWorld(hero),p=w.player,t=w.targets[0];w.targets=[t];p.x=700;p.face=face;t.x=p.x+offset*face;t.y=p.y;t.spawnX=t.x;
    requestCast(w,'attack',p.x+face*300,p.y-40);for(let i=0;i<30;i++)step(w,STEP);
    assert.equal(t.hp<240,hit,'offset '+offset);
  }
});
test('body overlap still respects an actual intervening solid wall',()=>{const w=createWorld('lightning'),p=w.player,t=w.targets[0];w.targets=[t];p.x=700;t.x=730;t.y=p.y;w.obstacles=[{id:'test-wall',x:712,y:p.y-100,w:4,h:100,actor:false}];requestCast(w,'attack',1000,p.y-40);for(let i=0;i<30;i++)step(w,STEP);assert.equal(t.hp,240);});
