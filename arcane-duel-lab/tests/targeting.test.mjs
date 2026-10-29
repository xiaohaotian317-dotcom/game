import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,requestCast} from '../dist/src/simulation.mjs';
import {groundTarget} from '../dist/src/targeting.mjs';
const advance=(w,s)=>{for(let t=0;t<s-STEP/2;t+=STEP)step(w,STEP);};
function stacked(hero='fire'){
  const w=createWorld(hero);w.targets=[];w.mirror.enabled=false;w.spring.enabled=false;w.floor=600;
  w.platforms=[{id:'ground',x:0,y:600,w:1440,active:true,type:'stone'},{id:'second',x:400,y:400,w:400,active:true,type:'stone'},{id:'third',x:400,y:200,w:400,active:true,type:'stone'}];
  Object.assign(w.player,{x:220,y:600,prevY:600,grounded:true});return w;
}
test('the cursor selects the next standing deck below, never the nearest deck above',()=>{
  const w=stacked();for(const [cursorY,expected] of [[100,200],[200,200],[210,400],[300,400],[410,600],[500,600],[660,600]])assert.equal(groundTarget(w,600,cursorY).y,expected);
  assert.equal(groundTarget(w,805,300).y,600);w.platforms[1].active=false;assert.equal(groundTarget(w,600,300).y,600);
  w.platforms[0].active=false;assert.equal(groundTarget(w,805,300),null);
});
test('meteor can independently target either gap in a three-level arena',()=>{
  for(const [cursorY,y,id] of [[300,400,'second'],[500,600,'ground']]){
    const w=stacked();requestCast(w,'r',600,cursorY);advance(w,.99);const m=w.effects.find(e=>e.kind==='meteor');assert.equal(m.x,600);assert.equal(m.y,y);assert.equal(m.anchor.platformId,id);assert.equal(m.triggered,false);advance(w,.05);assert.equal(m.triggered,true);
  }
});
test('eruption and ancient tree use the same below-cursor grounding at every layer',()=>{
  for(const [hero,key,kind] of [['fire','q','eruption'],['nature','r','tree']])for(const [x,cursorY,y] of [[600,300,400],[600,500,600],[805,300,600],[5,300,600]]){
    const w=stacked(hero);requestCast(w,key,x,cursorY);advance(w,.7);const object=kind==='tree'?w.trees[0]:w.effects.find(e=>e.kind===kind);assert.ok(object);assert.equal(object.x,x);assert.equal(object.y,y);assert.ok(w.platforms.some(b=>b.active&&x>=b.x&&x<=b.x+b.w&&b.y===object.y));
  }
});
test('target lock survives aim movement and follows the chosen moving platform',()=>{
  const w=stacked();requestCast(w,'r',600,300);w.platforms[1].y=430;step(w,STEP,{aim:{x:900,y:500}});advance(w,.3);const m=w.effects.find(e=>e.kind==='meteor');assert.equal(m.x,600);assert.equal(m.y,430);advance(w,.75);assert.equal(m.triggered,true);assert.equal(m.y,430);
});
test('an ancient tree remains attached to its support and disperses when that support breaks',()=>{
  const w=stacked('nature');requestCast(w,'r',600,300);advance(w,.8);const t=w.trees[0],branch=w.platforms.find(p=>p.id===t.id+'-a'),oldY=branch.y;w.platforms[1].y+=25;advance(w,.02);assert.equal(t.y,425);assert.equal(branch.y,oldY+25);
  w.platforms[1].active=false;advance(w,.02);assert.equal(w.trees.length,0);assert.ok(!w.platforms.some(b=>b.id.startsWith(t.id)));
});
