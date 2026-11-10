import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchInputState,assistAim,dragAim,skillAimKind} from '../dist/src/mobile-controls.mjs';

const world=()=>({width:2400,height:800,time:1,camera:{x:0,y:0,viewWidth:1000,viewHeight:800},player:{x:400,y:650,w:22,h:100,hp:180,face:1},targets:[],platforms:[{id:'ground',x:0,y:650,w:2400,active:true}],obstacles:[]});

test('joystick, held attack and skill have independent pointer ownership',()=>{
  const s=new TouchInputState();s.press(1,'joystick',{x:80,y:330});s.move(1,{x:115,y:365});s.press(2,'attack',{x:880,y:350});s.press(3,'q',{x:640,y:350});
  assert.deepEqual(s.read(),{move:1,attack:true,down:true,artifact:false,aim:null});
  assert.deepEqual(s.release(3,{aim:{x:620,y:650}}),{action:'q',aim:{x:620,y:650}});
  s.release(1);assert.equal(s.read().attack,true);assert.equal(s.read().move,0);assert.equal(s.read().down,false);
  s.release(2);assert.equal(s.read().attack,false);
});

test('a second finger cannot steal a held control and duplicate pointer ids do not change roles',()=>{
  const s=new TouchInputState();s.press(10,'attack',{x:1,y:1});s.press(11,'attack',{x:2,y:2});s.press(10,'joystick',{x:0,y:0});
  assert.equal(s.pointers.size,1);assert.equal(s.pointerFor('attack').id,10);assert.equal(s.pointerFor('joystick'),null);
  assert.equal(s.release(11),null);assert.equal(s.read().attack,true);
});

test('tap casts exactly on release and a second tap is available for derived skills',()=>{
  const s=new TouchInputState();
  for(const id of [1,2]){assert.equal(s.press(id,'e',{x:300,y:250}),null);assert.deepEqual(s.release(id,{aim:{x:660,y:500}}),{action:'e',aim:{x:660,y:500}});assert.equal(s.release(id),null);}
});

test('moving into the cancel area or receiving pointercancel never casts',()=>{
  const s=new TouchInputState();s.press(1,'r',{x:300,y:200});s.move(1,{x:150,y:100},{canceled:true,aim:{x:50,y:650}});
  assert.equal(s.release(1),null);s.press(2,'q',{x:200,y:300});assert.equal(s.release(2,{cancel:true}),null);assert.equal(s.activeSkill,null);
});

test('a finger may leave the cancel area and aim again before releasing',()=>{
  const s=new TouchInputState();s.press(1,'r',{x:300,y:200});s.move(1,{x:150,y:100},{canceled:true});s.move(1,{x:400,y:180},{canceled:false,aim:{x:800,y:650}});
  assert.equal(s.activeSkill.dragged,true);assert.deepEqual(s.release(1),{action:'r',aim:{x:800,y:650}});
});

test('reset clears artifact hold, down, attack, pending skill and stale aim',()=>{
  const s=new TouchInputState();assert.deepEqual(s.press(1,'artifact'),{action:'artifact-use'});s.press(2,'attack');s.press(3,'joystick');s.move(3,{x:20,y:60});s.press(4,'r');s.move(4,{x:100,y:10},{aim:{x:1200,y:100}});s.reset();
  assert.deepEqual(s.read(),{move:0,attack:false,down:false,artifact:false,aim:null});assert.equal(s.release(4),null);
});

test('tap assist prefers a visible forward live target and ignores dead, hidden, offscreen and far targets',()=>{
  const w=world();w.targets=[{x:350,y:650,h:100,w:10,hp:100},{x:600,y:650,h:100,hp:0},{x:520,y:650,h:100,hp:100,hidden:true},{x:1100,y:650,h:100,hp:100},{x:650,y:650,h:100,hp:100}];
  assert.deepEqual(assistAim(w,{frontOnly:true}),{x:650,y:602});
  w.targets=[{x:250,y:650,h:100,w:10,hp:100}];assert.ok(assistAim(w,{frontOnly:true}).x>400);
});

test('basic assist respects obstacles while targeted skills can select behind terrain',()=>{
  const w=world();w.obstacles=[{x:490,y:450,w:30,h:200}];w.targets=[{x:560,y:650,h:100,hp:100}];
  assert.notDeepEqual(assistAim(w,{terrain:true}),{x:560,y:602});
  assert.deepEqual(assistAim(w,{terrain:false}),{x:560,y:602});
});

test('ground-target assist chooses support below target feet rather than the top deck',()=>{
  const w=world();w.platforms.push({id:'upper',x:500,y:300,w:400,active:true},{id:'middle',x:500,y:480,w:400,active:true});w.targets=[{x:600,y:480,h:90,hp:100}];
  assert.deepEqual(assistAim(w,{kind:'ground',terrain:false}),{x:600,y:480});
});

test('drag targeting follows camera coordinates, clamps world bounds, and does not mutate world',()=>{
  const w=world();w.camera.x=900;w.player.x=1300;const before=JSON.stringify(w);
  assert.deepEqual(dragAim(w,{x:100,y:100},{x:200,y:100},{range:500}),{x:1800,y:602});
  assert.deepEqual(dragAim(w,{x:100,y:100},{x:100,y:0},{range:1000}),{x:1300,y:0});
  assert.deepEqual(dragAim(w,{x:100,y:100},{x:100,y:200},{kind:'ground',range:200}),{x:1300,y:650});
  assert.equal(JSON.stringify(w),before);
});

test('skill metadata distinguishes self shields, aimed meteor and alternate directional skills',()=>{
  assert.equal(skillAimKind('frost','e'),'self');assert.equal(skillAimKind('frost','q'),'ground');assert.equal(skillAimKind('fire','r'),'ground');assert.equal(skillAimKind('fire','e'),'direction');
  assert.equal(skillAimKind('star','q',{id:'star-0-1'}),'direction');assert.equal(skillAimKind('lightning','r',{id:'lightning-2-1'}),'self');assert.equal(skillAimKind('star','q',{kind:'self'}),'self');
});

test('invalid pointer samples and unavailable world do not produce NaN inputs',()=>{
  const s=new TouchInputState();assert.equal(s.press(1,'joystick',{x:NaN,y:1}),null);assert.equal(s.pointers.size,0);
  s.press(2,'joystick',{x:20,y:20});assert.equal(s.move(2,{x:Infinity,y:20}),false);assert.equal(s.read().move,0);
  assert.equal(assistAim(null),null);assert.equal(dragAim(null,{x:0,y:0},{x:1,y:1}),null);
});
