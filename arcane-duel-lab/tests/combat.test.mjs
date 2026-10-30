import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,STEP,HEROES,requestCast,hitSummon} from '../dist/src/simulation.mjs';
import {firstTerrainHit} from '../dist/src/collision.mjs';
import {updateCamera,worldPoint} from '../dist/src/camera.mjs';
import {Renderer} from '../dist/src/renderer.mjs';
const advance=(w,s,input={})=>{for(let t=0;t<s-STEP/2;t+=STEP)step(w,STEP,input);};
function shot(w,x,y,vx,owner='player',kind='fireball'){w.projectiles.push({id:999,kind,x,y,px:x,py:y,vx,vy:0,age:0,life:3,damage:18,r:8,owner,fire:kind==='fireball'});}
test('held normal attacks keep a 50 percent longer interval without slowing projectile travel',()=>{
  for(const hero of ['fire','nature']){const w=createWorld(hero);w.targets=[];w.mirror.enabled=false;const times=[];for(let i=0;i<480;i++){step(w,STEP,{attack:true,aim:{x:1300,y:610}});if(w.events.some(e=>e.type==='attack'))times.push(w.time);w.events=[];}
    assert.ok(times.length>=5);for(let i=1;i<times.length;i++)assert.ok(Math.abs(times[i]-times[i-1]-HEROES[hero].skills.attack.cd)<STEP*1.1);const s=w.projectiles[0];if(s)assert.ok(Math.abs(s.vx)>650);
  }
});
test('a very fast projectile stops at the first thin wall before damaging a target behind it',()=>{
  for(const owner of ['player','enemy']){const w=createWorld();w.mirror.enabled=false;w.obstacles=[{id:'wall',x:650,y:550,w:9,h:150}];w.targets[0].x=720;w.player.x=720;shot(w,600,640,18000,owner);step(w,STEP);assert.equal(w.projectiles.length,0);assert.equal(w.targets[0].hp,240);assert.equal(w.player.hp,w.player.maxHp);assert.ok(w.effects.some(e=>e.kind==='chips'&&e.x<650));}
});
test('stone decks block both fire and nature bolts while a broken bridge no longer blocks',()=>{
  for(const kind of ['fireball','seed']){const w=createWorld();w.mirror.enabled=false;shot(w,700,350,0,'player',kind);w.projectiles[0].vy=6000;step(w,STEP);assert.equal(w.projectiles.length,0);}
  const w=createWorld();w.platforms.find(b=>b.id==='bridge').active=false;assert.equal(firstTerrainHit(w,700,350,700,420),null);
});
test('near targets still receive the hit before a farther wall',()=>{
  const w=createWorld();w.mirror.enabled=false;w.obstacles=[{x:850,y:550,w:12,h:150}];shot(w,740,640,18000);step(w,STEP);assert.equal(w.targets[0].hp,222);
});
test('meteor passes upper roofs and lands on the selected lower deck in one second',()=>{
  const w=createWorld();w.targets=[];requestCast(w,'r',700,600);advance(w,.99);const m=w.effects.find(e=>e.kind==='meteor');assert.ok(m);assert.equal(m.y,704);assert.equal(m.triggered,false);advance(w,.05);assert.ok(m.triggered);assert.ok(w.effects.some(e=>e.kind==='fireZone'));assert.ok(w.shake>0);assert.equal(w.platforms.find(b=>b.id==='bridge').hp,90);
});
test('the root skill can bind an enemy across a wall while basics remain blocked',()=>{
  const w=createWorld('nature');w.player.x=620;w.obstacles=[{x:700,y:550,w:20,h:154}];requestCast(w,'q',900,704);advance(w,1);assert.ok(w.targets[0].hp<240);assert.ok(w.targets[0].rootUntil>w.time);assert.equal(w.effects.find(e=>e.kind==='roots').to,900);
});
test('the stag has its own health, intercepts enemy attacks and disappears on death',()=>{
  const w=createWorld('nature');requestCast(w,'e');advance(w,.5);const f=w.fox;assert.equal(f.hp,80);f.x=500;f.y=704;f.vx=0;f.vy=0;w.player.x=560;shot(w,450,645,6000,'enemy','enemy');step(w,STEP);assert.equal(f.hp,62);assert.equal(w.player.hp,w.player.maxHp);
  f.invuln=0;assert.equal(hitSummon(w,100,450),true);assert.equal(w.fox,null);assert.ok(w.effects.some(e=>e.kind==='stagDeath'));
});
test('the stag pursues a target behind it and jumps over solid cover',()=>{
  const w=createWorld('nature');w.targets=w.targets.slice(0,1);requestCast(w,'e');advance(w,.5);Object.assign(w.fox,{x:700,y:704,vx:0,vy:0,grounded:true});w.targets[0].x=450;w.targets[0].spawnX=450;w.obstacles=[{id:'cover',x:580,y:604,w:50,h:100,actor:true}];advance(w,2);assert.ok(w.fox.x<580);assert.ok(w.targets[0].hp<240);
});
test('both heroes can run the side courts and hop the covers without skills',()=>{
  for(const scene of ['moon','lava','garden'])for(const hero of ['fire','nature']){const w=createWorld(hero,scene);w.targets=[];w.mechanisms={cooldown:0,flash:0};w.spring.enabled=false;const b=w.obstacles[0];Object.assign(w.player,{x:300,y:w.floor,vx:0,vy:0,grounded:true,platformId:'ground'});advance(w,1.2,{move:1,jump:false});assert.ok(w.player.x<=b.x-w.player.w+.1);step(w,STEP,{jump:true,move:1});advance(w,.7,{move:1});assert.ok(w.player.x>b.x+b.w);assert.equal(w.width,2304);}
});
test('camera clamps to both ends and aiming remains aligned in follow and overview',()=>{
  const w=createWorld('fire','moon');w.player.x=w.width-35;updateCamera(w,5);assert.ok(Math.abs(w.camera.x-864)<.01);assert.ok(Math.abs(worldPoint(w,1,.5).x-w.width)<.01);w.player.x=35;updateCamera(w,5);assert.ok(w.camera.x<.01);w.camera.overview=true;updateCamera(w,.1);assert.equal(worldPoint(w,.5,.5).x,1152);
});
test('a jump or spell pressed during impact pause is buffered instead of lost',()=>{
  const w=createWorld();w.hitstop=.07;step(w,STEP,{jump:true,cast:'q'});advance(w,.1);assert.ok(w.player.vy<0);assert.equal(w.player.cast.key,'q');
});
test('real spell rendering uses finite coordinates throughout windup, impact and aftermath',()=>{
  globalThis.matchMedia=()=>({matches:false});
  const json=p=>JSON.parse(readFileSync(new URL('../dist/assets/'+p,import.meta.url)));
  const grad={addColorStop(){}};
  const ctx=new Proxy({createLinearGradient(...v){assert.ok(v.every(Number.isFinite),'linear '+v);return grad;},createRadialGradient(...v){assert.ok(v.every(Number.isFinite),'radial '+v);return grad;}},{get(o,k){return k in o?o[k]:(...v)=>{};}});
  const canvas={getContext:()=>ctx},assets={bounds:json('rig-bounds.json'),coreBounds:json('core-bounds-v2.json'),combatBounds:json('combat/bounds-v2.json'),sceneBounds:json('scenes/prop-bounds-v1.json')};
  for(const hero of ['fire','nature'])for(const key of ['attack','q','e','r']){const w=createWorld(hero),r=new Renderer(canvas,assets);requestCast(w,key,790,704);for(let i=0;i<420;i++){step(w,STEP);r.hero(w,1,i<3?[0,-.0002,STEP][i]:STEP);for(const e of w.effects)r.combat.effect(w,e);for(const s of w.projectiles)r.combat.projectile(w,s);if(w.fox)r.combat.stag(w);for(const t of w.trees)r.combat.tree(w,t);}}
});
