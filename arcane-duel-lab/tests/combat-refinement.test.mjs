import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,requestCast,step,STEP} from '../dist/src/simulation.mjs';
import {KEY_LABELS,skillForCode,INTERACT_CODE,RECAST_WINDOWS} from '../dist/src/controls.mjs';
import {lightningPath,shadowSlashShape} from '../dist/src/vfx-geometry.mjs';
import {RosterPainter} from '../dist/src/roster-painter-v2.mjs';
function flat(hero){const w=createWorld(hero);w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.mirror.enabled=false;w.spring.enabled=false;Object.assign(w.player,{x:200,prevX:200,y:704,prevY:704});w.targets=w.targets.slice(0,1);Object.assign(w.targets[0],{x:275,y:704,prevX:275,prevY:704,spawnX:275,spawnY:704});return w;}
function advance(w,s,input={}){for(let i=0;i<Math.ceil(s/STEP);i++)step(w,STEP,input);}
function enemyShot(w){const p=w.player;w.projectiles.push({id:999,kind:'enemy',x:p.x+30,y:p.y-55,px:p.x+30,py:p.y-55,vx:-2400,vy:0,age:0,life:2,damage:10,r:5,owner:'enemy'});}
test('F is the only keyboard binding for slot one; G only interacts, and recast labels say F',()=>{
  assert.equal(skillForCode('KeyF'),'q');assert.equal(skillForCode('KeyQ'),null);assert.equal(skillForCode('KeyG'),null);assert.equal(INTERACT_CODE,'KeyG');assert.equal(KEY_LABELS.q,'F');
  const app=readFileSync(new URL('../dist/src/app.mjs',import.meta.url),'utf8');assert.ok(app.includes('skillForCode(e.code)'));assert.ok(app.includes('keyLabels[rc.key]'));assert.ok(!app.includes("e.code==='KeyQ'"));
});
test('lightning basic is a forward melee punch in either direction, with no projectile',()=>{
  for(const face of [-1,1]){const w=flat('lightning');w.targets[0].x=200+face*75;requestCast(w,'attack',200+face*500,650);advance(w,.3);assert.equal(w.targets[0].hp,220);assert.equal(w.projectiles.length,0);assert.ok(w.effects.some(e=>e.kind==='thunderPunch'&&e.face===face));}
});
test('lightning fists cannot hit distant targets, targets behind, or targets through walls',()=>{
  for(const scenario of ['distant','behind','wall']){const w=flat('lightning');w.targets[0].x=scenario==='distant'?450:scenario==='behind'?130:275;if(scenario==='wall')w.obstacles=[{x:240,y:540,w:10,h:164}];requestCast(w,'attack',500,650);advance(w,.5);assert.equal(w.targets[0].hp,240,scenario);assert.equal(w.projectiles.length,0);}
});
test('a charged melee fist consumes lightning charge only on a real hit',()=>{
  const miss=flat('lightning');miss.player.charge=100;miss.targets=[];requestCast(miss,'attack',500,650);advance(miss,.4);assert.equal(miss.player.charge,100);
  const hit=flat('lightning');hit.player.charge=100;requestCast(hit,'attack',500,650);advance(hit,.3);assert.equal(hit.targets[0].hp,207);assert.equal(hit.player.charge,0);
});
test('lightning rush lets bullets pass through during movement; damage resumes after the dash',()=>{
  const w=flat('lightning');w.targets=[];requestCast(w,'q',700,650);advance(w,.12);assert.ok(w.player.burst?.dodgeProjectiles);enemyShot(w);advance(w,.025);assert.equal(w.player.hp,120);assert.equal(w.projectiles.length,1);assert.ok(w.projectiles[0].x<w.player.x);
  w.projectiles=[];advance(w,.45);assert.equal(w.player.burst,null);enemyShot(w);advance(w,.025);assert.equal(w.player.hp,110);assert.equal(w.projectiles.length,0);
});
test('lightning ultimate physically advances and finishes in front of its aimed enemy',()=>{
  const w=flat('lightning');w.targets[0].x=500;requestCast(w,'r',500,650);advance(w,.3);assert.ok(w.player.x>200&&w.player.x<446);advance(w,.28);assert.ok(w.player.x<w.targets[0].x);assert.ok(w.targets[0].x-w.player.x<125);assert.ok(w.targets[0].hp<240);assert.ok(w.effects.some(e=>e.kind==='thunderImpact'));
});
test('shadow rush leaves full independent pose snapshots that linger after the actor finishes moving',()=>{
  const w=flat('shadow');w.targets=[];requestCast(w,'q',700,650);advance(w,.34);assert.ok(w.ghosts.length>=5);const g=w.ghosts[0],arm=g.pose.armA;assert.ok(Object.values(g.pose).every(Number.isFinite));assert.equal(g.duration,.8);w.player.cycle=300;w.player.face=-1;assert.equal(g.face,1);assert.equal(g.pose.armA,arm);advance(w,.2);assert.ok(w.ghosts.length>0);advance(w,.6);assert.equal(w.ghosts.length,0);
});
test('all six heroes keep an extended recast window and allow one late recast without resetting cooldown',()=>{
  for(const hero of ['fire','nature','frost','lightning','shadow','star']){const w=flat(hero),key=['fire','nature','shadow'].includes(hero)?'e':'q';if(hero!=='lightning')w.targets=[];else w.targets[0].x=330;requestCast(w,key,400,600);advance(w,.65);assert.equal(w.player.recast.window,RECAST_WINDOWS[hero]);assert.ok(RECAST_WINDOWS[hero]>=(hero==='fire'?2.5:3.5));
    if(hero==='lightning')w.targets=[];
    const elapsed=hero==='fire'?1.5:2.1;advance(w,elapsed);assert.ok(w.player.recast&&w.player.recast.until>w.time,hero);
    if(hero==='fire'){w.player.grounded=false;w.player.y=600;w.player.vy=-10;}
    const cooldown=w.player.cooldowns[key];assert.ok(requestCast(w,key,450,650),hero);advance(w,.15);assert.equal(w.player.recast,null);assert.ok(w.player.cooldowns[key]<cooldown&&w.player.cooldowns[key]>0);
  }
});
test('star repulse is still backed by a live gravity well in the extended late window',()=>{
  const w=flat('star');w.targets=[];requestCast(w,'q',420,650);advance(w,3.3);assert.ok(w.fields.some(f=>f.kind==='gravityWell'));assert.ok(requestCast(w,'q'));advance(w,.18);assert.equal(w.fields.length,0);assert.ok(w.effects.some(e=>e.kind==='starRepulse'));
});
test('ice crown and mirror source bounds include their top tips instead of starting at the quadrant seam',()=>{
  const b=JSON.parse(readFileSync(new URL('../dist/assets/heroes/refinement-bounds-v2.json',import.meta.url)));for(const [index,tip] of [[2,{x:378,y:383}],[3,{x:1128,y:420}]]){const r=b.frost.fx[index];assert.ok(tip.x>=r.x&&tip.x<r.x+r.w&&tip.y>=r.y&&tip.y<r.y+r.h);assert.ok(r.y<512);}
});
test('slash leading edge and both hand-drawn arcs mirror to the actor forward side',()=>{
  for(const face of [-1,1])for(const phase of [0,.25,.5,.75,1]){const shape=shadowSlashShape(phase);assert.ok((shape.tip.x*face)*face>90);for(const arc of shape.arcs)assert.ok(arc[2][0]>arc[0][0]);}
  const calls=[],ctx=new Proxy({globalAlpha:1,save(){},restore(){},translate(){},scale(x,y){calls.push([x,y]);}},{get:(o,k)=>k in o?o[k]:(()=>{})});const painter=new RosterPainter(ctx,{});painter.effect({time:1,fxTime:1},{id:1,kind:'shadowSlash',x:200,y:100,face:-1,age:.1,duration:.35});assert.ok(calls.some(([x,y])=>x===-1&&y===1));
});
test('procedural lightning stays attached at both ends, has branches to animate and never returns NaN',()=>{
  for(const point of [[0,0,0,0],[10,30,110,80],[20,50,-80,-300]]){const a=lightningPath(...point,1.0,7),b=lightningPath(...point,1.1,7);assert.deepEqual(a[0],point.slice(0,2));assert.ok(Math.abs(a.at(-1)[0]-point[2])<1e-8);assert.ok(Math.abs(a.at(-1)[1]-point[3])<1e-8);assert.ok(a.flat().every(Number.isFinite));if(point[0]!==point[2])assert.notDeepEqual(a,b);}
});
