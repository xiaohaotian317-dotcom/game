import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,triggerMechanism,repair} from '../dist/src/simulation.mjs';
import {hammerPosition} from '../dist/src/scene-mechanics.mjs';
import {auditRoutes} from './route-audit.mjs';
function advance(w,seconds,input={}){for(let t=0;t<seconds-STEP/2;t+=STEP)step(w,STEP,input);}
function shot(w,x,y,vx=600){w.projectiles.push({id:999,kind:'fireball',x,y,px:x,py:y,vx,vy:0,age:0,life:2,damage:18,r:8,owner:'player',fire:true});}
test('each new scene starts the hero on the painted starting surface',()=>{
  for(const scene of ['moon','lava','garden'])for(const hero of ['fire','nature']){const w=createWorld(hero,scene),start=w.player.y;advance(w,.3);assert.ok(Math.abs(w.player.y-start)<.1);assert.equal(w.player.grounded,true);}
});
test('broken moon bridge removes support and repair restores it',()=>{
  const w=createWorld('fire','moon'),b=w.platforms.find(p=>p.id==='bridge');triggerMechanism(w,'bridge');triggerMechanism(w,'bridge');assert.equal(b.active,false);
  Object.assign(w.player,{x:b.x+b.w/2,y:b.y-10,vy:200,grounded:false,jumps:2});advance(w,.2);assert.ok(w.player.y>b.y+15);
  repair(w);Object.assign(w.player,{x:b.x+b.w/2,y:b.y-10,vy:100,grounded:false,jumps:2});advance(w,.15);assert.equal(w.player.platformId,'bridge');
});
test('moon elevator carries its rider both up and down',()=>{
  const w=createWorld('fire','moon'),l=w.mechanisms.lift;Object.assign(w.player,{x:l.x+64,y:l.y,prevY:l.y,grounded:true,platformId:'lift'});
  triggerMechanism(w,'lift');advance(w,1.5);assert.equal(l.y,l.high);assert.ok(Math.abs(w.player.y-l.y)<.1);
  triggerMechanism(w,'lift');advance(w,2);assert.equal(l.y,l.low);assert.ok(Math.abs(w.player.y-l.y)<.1);
});
test('a real projectile can hit the rune switch and change the elevator target',()=>{
  const w=createWorld('fire','moon'),l=w.mechanisms.lift;shot(w,l.switchX-40,l.switchY);advance(w,.1);assert.equal(l.target,l.high);assert.equal(w.projectiles.length,0);
});
test('lava warns before erupting, and valve routing makes the old lane safe',()=>{
  const w=createWorld('fire','lava'),m=w.mechanisms;Object.assign(w.player,{x:m.vents[0].x,y:w.floor});advance(w,.5);assert.equal(m.vents[0].mode,'warning');assert.equal(w.player.hp,w.player.maxHp);
  advance(w,.9);assert.equal(m.vents[0].mode,'fire');assert.ok(w.player.hp<w.player.maxHp);
  triggerMechanism(w,'valve');Object.assign(w.player,{x:m.vents[0].x,y:w.floor,hp:w.player.maxHp,invuln:0,vx:0});advance(w,.3);assert.equal(m.vents[0].mode,'rest');assert.equal(w.player.hp,w.player.maxHp);
});
test('hitting the hammer changes its momentum and produces a real swing',()=>{
  const w=createWorld('fire','lava'),h=w.mechanisms.hammer,p=hammerPosition(h);shot(w,p.x-40,p.y);advance(w,.05);assert.ok(h.velocity>1);
  const x=hammerPosition(h).x;advance(w,.35);assert.ok(Math.abs(hammerPosition(h).x-x)>20);
});
test('wind direction changes the movement of an airborne hero',()=>{
  const w=createWorld('nature','garden'),f=w.mechanisms.wind;Object.assign(w.player,{x:f.x+110,y:f.y+50,vx:0,vy:-100,grounded:false,jumps:2});advance(w,.1);assert.ok(w.player.vx>70);
  triggerMechanism(w,'wind');Object.assign(w.player,{x:f.x+110,y:f.y+50,vx:0,vy:-100,grounded:false,jumps:2});advance(w,.1);assert.ok(w.player.vx< -70);
});
test('vine growth enables support, then expiry removes it',()=>{
  const w=createWorld('nature','garden'),v=w.mechanisms.vine,b=w.platforms.find(p=>p.id==='vine');v.until=0;v.growth=0;b.active=false;
  triggerMechanism(w,'vine');advance(w,.7);assert.equal(b.active,true);
  Object.assign(w.player,{x:v.x+v.w/2,y:v.y-10,vy:100,grounded:false,jumps:2});advance(w,.15);assert.equal(w.player.platformId,'vine');
  advance(w,9);assert.equal(b.active,false);assert.ok(w.player.y>v.y);
});
test('landing on the lotus center launches the hero after the charge interval',()=>{
  const w=createWorld('fire','garden');Object.assign(w.player,{x:w.spring.x,y:500,vy:200,grounded:false,jumps:2});advance(w,.42);
  assert.ok(w.events.some(e=>e.type==='spring'));assert.ok(w.player.vy< -500);
});
for(const scene of ['moon','lava','garden'])for(const hero of ['fire','nature'])test(`${scene}: ${hero} can reach every standing surface with basic jumps only`,()=>{
  const options=scene==='moon'?{brokenBridge:true}:scene==='garden'?{noVine:true}:{};
  const report=auditRoutes(hero,scene,options);assert.deepEqual(report.unreachable,[]);
});
