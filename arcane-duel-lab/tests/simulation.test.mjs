import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,FLOOR,requestCast,damage,hitPlayer,repair,toggleMirror,actionState} from '../dist/src/simulation.mjs';
function advance(w,seconds,input={}){for(let t=0;t<seconds-STEP/2;t+=STEP)step(w,STEP,input);}
test('locomotion accelerates, brakes and stays on solid ground',()=>{
  const w=createWorld();advance(w,.7,{move:1});assert.ok(w.player.x>390);assert.ok(w.player.vx>300);
  const x=w.player.x;advance(w,.4);assert.ok(w.player.x>x);assert.ok(w.player.vx<1);assert.equal(w.player.y,FLOOR);
});
test('double jump supports a new airborne impulse but forbids a third jump',()=>{
  const w=createWorld();step(w,STEP,{jump:true});advance(w,.2);step(w,STEP,{jump:true});assert.equal(w.player.jumps,2);
  advance(w,.08);const vy=w.player.vy;step(w,STEP,{jump:true});assert.equal(w.player.jumps,2);assert.ok(w.player.vy>vy);
  advance(w,1.8);assert.equal(w.player.grounded,true);assert.equal(w.player.jumps,0);
});
test('one-way platforms catch falling actors and support downward traversal',()=>{
  const w=createWorld(),p=w.player;p.x=210;p.y=510;p.vy=160;p.grounded=false;p.jumps=2;
  advance(w,.18);assert.equal(p.y,548);assert.equal(p.platformId,'left');
  step(w,STEP,{jump:true,drop:true});advance(w,.3);assert.ok(p.y>548);advance(w,.5);assert.equal(p.y,FLOOR);
});
test('jump input shortly before landing is buffered into the next jump',()=>{
  const w=createWorld(),p=w.player;p.y=FLOOR-15;p.vy=400;p.grounded=false;p.jumps=2;p.coyote=0;
  step(w,STEP,{jump:true});advance(w,.08);assert.ok(p.vy<0);assert.equal(p.jumps,1);
});
test('skills release after windup, rather than on key press',()=>{
  const w=createWorld();requestCast(w,'attack',790,630);assert.equal(w.projectiles.length,0);
  advance(w,.1);assert.equal(w.projectiles.length,0);advance(w,.06);assert.equal(w.projectiles.length,1);
});
test('fire attacks deal damage and burning persists after projectile impact',()=>{
  const w=createWorld(),t=w.targets[0];w.player.x=620;requestCast(w,'attack',t.x,t.y-60);advance(w,.5);
  assert.ok(t.hp<240);assert.ok(t.burnUntil>w.time);const hp=t.hp;advance(w,1.6);assert.ok(t.hp<hp);
});
test('refreshing burn extends its duration without multiplying tick rate',()=>{
  const w=createWorld(),t=w.targets[0];damage(w,t,1,{fire:true});const firstTick=t.nextBurn;advance(w,.3);
  damage(w,t,1,{fire:true});assert.equal(t.nextBurn,firstTick);while(w.time<.76)step(w,STEP);assert.equal(t.hp,234);
});
test('fire leap opens one recast, stomp consumes it and preserves cooldown',()=>{
  const w=createWorld();requestCast(w,'e',790,600);advance(w,.4);assert.equal(w.player.grounded,false);assert.ok(w.player.recast);
  const cd=w.player.cooldowns.e;assert.equal(requestCast(w,'e',790,600),true);advance(w,.08);
  assert.equal(w.player.recast,null);assert.ok(w.player.cooldowns.e<cd);assert.ok(w.player.cooldowns.e>4);
  advance(w,1);assert.ok(w.effects.some(e=>e.kind==='fireZone'));assert.equal(w.player.stomp,false);
});
test('expired recast cannot bypass cooldown',()=>{
  const w=createWorld();requestCast(w,'e');advance(w,1.7);assert.equal(w.player.recast,null);assert.equal(requestCast(w,'e'),false);
});
test('eruption damages terrain, bridge rebuild restores collision',()=>{
  const w=createWorld(),bridge=w.platforms.find(p=>p.id==='bridge');
  w.aim={x:680,y:387};requestCast(w,'r');advance(w,2);assert.ok(bridge.hp<90);
  w.player.cooldowns.q=0;requestCast(w,'q',680,387);advance(w,1.3);assert.equal(bridge.active,false);
  repair(w);assert.equal(bridge.active,true);assert.equal(bridge.hp,90);
});
test('summon creates one fox; command reuses the same fox and consumes recast',()=>{
  const w=createWorld('nature');requestCast(w,'e');advance(w,.55);const fox=w.fox;assert.ok(fox);
  requestCast(w,'e',1100,400);advance(w,.15);assert.equal(w.fox,fox);assert.equal(w.player.recast,null);assert.ok(fox.vx>400);assert.ok(fox.vy<0);
});
test('fox hits restore health and healing cannot exceed maximum',()=>{
  const w=createWorld('nature');w.player.hp=116;requestCast(w,'e');advance(w,.55);
  w.fox.x=w.targets[0].x-12;w.fox.y=FLOOR;w.fox.vy=0;advance(w,.05);assert.ok(w.player.hp>116);assert.ok(w.player.hp<=120);
  advance(w,3);assert.ok(w.player.hp<=120);
});
test('root spell follows its platform and binds a nearby target',()=>{
  const w=createWorld('nature');w.player.x=620;requestCast(w,'q',900,FLOOR);advance(w,.9);
  assert.ok(w.targets[0].rootUntil>w.time);assert.ok(w.targets[0].hp<240);
});
test('ancient tree grows two standable platforms, heals and expires cleanly',()=>{
  const w=createWorld('nature');w.player.hp=90;requestCast(w,'r',220,FLOOR);advance(w,1.5);
  assert.equal(w.trees.length,1);assert.equal(w.platforms.filter(p=>p.type==='root'&&p.active).length,2);assert.ok(w.player.hp>90);
  advance(w,9);assert.equal(w.trees.length,0);assert.equal(w.platforms.filter(p=>p.type==='root').length,0);
});
test('dash has brief invulnerability; subsequent hits interrupt casting',()=>{
  const w=createWorld();step(w,STEP,{dash:true,move:1});assert.equal(hitPlayer(w,10,0),false);
  advance(w,.25);requestCast(w,'q');assert.ok(w.player.cast);assert.equal(hitPlayer(w,10,0),true);
  assert.equal(w.player.cast,null);assert.equal(actionState(w),'受击');assert.equal(w.player.hp,110);
});
test('spring launches player and mirror orientation can be changed',()=>{
  const w=createWorld();w.player.x=w.spring.x;advance(w,.2);assert.ok(w.player.vy<-700);
  const angle=w.mirror.angle;toggleMirror(w);assert.equal(w.mirror.angle,-angle);
});
