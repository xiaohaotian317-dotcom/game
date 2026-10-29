import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,STEP,HEROES,requestCast,hitPlayer,damage} from '../dist/src/simulation.mjs';
import {targetPose,bodyFrame,armChain,blendPose,basePose} from '../dist/src/character-rig.mjs';
import {Renderer} from '../dist/src/renderer.mjs';
import {auditRoutes} from './route-audit.mjs';
const ids=['frost','lightning','shadow','star'];
function flat(hero){const w=createWorld(hero);w.platforms=w.platforms.filter(b=>b.id==='ground');w.obstacles=[];w.mirror.enabled=false;w.spring.enabled=false;w.targets=w.targets.slice(0,1);Object.assign(w.player,{x:200,prevX:200,y:704,prevY:704});Object.assign(w.targets[0],{x:420,prevX:420,y:704,prevY:704,spawnX:420,spawnY:704,face:-1});return w;}
function advance(w,s,input={}){for(let i=0;i<Math.ceil(s/STEP);i++)step(w,STEP,input);}
test('six original professions have complete independent skill definitions and release windups',()=>{
  assert.equal(Object.keys(HEROES).length,6);
  for(const h of ids)for(const k of ['attack','q','e','r']){const w=flat(h);assert.ok(requestCast(w,k,420,650));assert.equal(w.player.cast.released,false);advance(w,HEROES[h].skills[k].release-STEP*2);assert.equal(w.player.cast.released,false);advance(w,STEP*3);assert.ok(w.player.cast.released);assert.ok(w.player.cooldowns[k]>0);}
});
test('frost ice grows into real support, recasts once and removes its support without resetting cooldown',()=>{
  const w=flat('frost');requestCast(w,'q',400,530);advance(w,.65);const b=w.platforms.find(b=>b.type==='ice');assert.ok(b?.active);Object.assign(w.player,{x:400,y:529,prevY:529,vy:100,vx:0,grounded:false});advance(w,.05);assert.equal(w.player.platformId,b.id);const cooldown=w.player.cooldowns.q;assert.ok(requestCast(w,'q'));advance(w,.2);assert.equal(w.platforms.some(a=>a.id===b.id),false);assert.equal(w.player.recast,null);assert.ok(w.player.cooldowns.q<cooldown&&w.player.cooldowns.q>5);advance(w,.2);assert.ok(w.player.y>530);
});
test('frost shield absorbs actual damage, recharges every eight seconds and never stacks',()=>{
  const w=flat('frost');hitPlayer(w,25,0);assert.equal(w.player.shield,0);assert.equal(w.player.hp,103);advance(w,8.1);assert.equal(w.player.shield,18);advance(w,8.1);assert.equal(w.player.shield,18);
});
test('ice mirror reflects hostile projectiles back into enemies',()=>{
  const w=flat('frost');requestCast(w,'e',420,650);advance(w,.6);const m=w.iceMirrors[0];assert.ok(m);w.projectiles.push({id:999,kind:'enemy',x:m.x+50,y:m.y,px:m.x+50,py:m.y,vx:-1000,vy:0,r:5,damage:10,age:0,life:2,owner:'enemy'});advance(w,.06);const s=w.projectiles[0];assert.equal(s.owner,'player');assert.ok(s.vx>0);advance(w,.2);assert.ok(w.targets[0].hp<240);assert.equal(w.player.hp,110);
});
test('frost slow reduces actual moving-target speed by 55 percent after the freeze ends',()=>{
  const normal=flat('frost'),slow=flat('frost');normal.moving=slow.moving=true;normal.time=slow.time=1;slow.targets[0].slowUntil=3;step(normal,STEP);step(slow,STEP);assert.ok(Math.abs(slow.targets[0].vx/normal.targets[0].vx-.45)<.001);
});
test('lightning miss cannot unlock Q2; a hit unlocks exactly one aimed turn',()=>{
  const miss=flat('lightning');miss.targets=[];requestCast(miss,'q',900,640);advance(miss,.5);assert.equal(miss.player.recast,null);assert.equal(requestCast(miss,'q'),false);
  const w=flat('lightning');w.targets[0].x=350;requestCast(w,'q',500,640);advance(w,.4);assert.ok(w.player.recast?.variant==='thunderTurn');assert.ok(w.targets[0].hp<240);const cd=w.player.cooldowns.q;assert.ok(requestCast(w,'q',w.player.x+100,w.player.y-150));advance(w,.4);assert.equal(w.player.recast,null);assert.ok(w.player.cooldowns.q<cd&&w.player.cooldowns.q>4);assert.ok(w.player.y<680);
});
test('lightning movement charges its next basic hit and consumes the charge on impact',()=>{
  const w=flat('lightning');advance(w,3.3,{move:1});assert.equal(w.player.charge,100);w.targets[0].hp=240;damage(w,w.targets[0],20,{school:'lightning',basic:true});assert.equal(w.targets[0].hp,207);assert.equal(w.player.charge,0);
});
test('magnet leap lands on its visible upper anchor and thunder dive ignores intervening roofs',()=>{
  const w=flat('lightning');w.platforms.push({id:'anchor',x:300,y:500,w:240,active:true,type:'stone'});requestCast(w,'e',400,490);advance(w,.65);assert.equal(w.player.platformId,'anchor');assert.ok(Math.abs(w.player.x-400)<2);
  w.player.cast=null;w.player.x=200;w.player.y=704;requestCast(w,'r',420,600);advance(w,.75);assert.ok(w.targets[0].hp<240);assert.ok(w.player.y>=700);assert.ok(w.effects.some(e=>e.kind==='thunderImpact'));
});
test('shadow return preserves life and cooldown, consumes mark and expires after its window',()=>{
  const w=flat('shadow');w.player.hp=71;requestCast(w,'e',600,650);advance(w,.55);assert.ok(Math.abs(w.player.x-600)<1);const cd=w.player.cooldowns.e;assert.ok(requestCast(w,'e'));advance(w,.25);assert.ok(Math.abs(w.player.x-200)<1);assert.equal(w.player.hp,71);assert.ok(w.player.cooldowns.e<cd&&w.player.cooldowns.e>6);assert.equal(w.roleState.shadowMark,null);assert.equal(w.player.recast,null);
  const expired=flat('shadow');requestCast(expired,'e',600,650);advance(expired,4);assert.equal(expired.player.recast,null);assert.equal(requestCast(expired,'e'),false);
});
test('shadow melee needs proximity and sight; backstab uses the target facing and cooldown',()=>{
  const w=flat('shadow');w.targets[0].x=260;w.targets[0].face=1;requestCast(w,'attack',300,650);advance(w,.3);assert.equal(w.targets[0].hp,215);damage(w,w.targets[0],18,{basic:true,school:'shadow'});assert.equal(w.targets[0].hp,197);
  const blocked=flat('shadow');blocked.targets[0].x=280;blocked.obstacles=[{x:240,y:540,w:12,h:164}];requestCast(blocked,'attack',300,650);advance(blocked,.4);assert.equal(blocked.targets[0].hp,240);
});
test('gravity well pulls toward its center then Q2 repels with a single consumed recast',()=>{
  const w=flat('star');w.targets[0].x=500;requestCast(w,'q',400,650);advance(w,.65);assert.ok(w.targets[0].x<500);assert.equal(w.player.stars,1);assert.ok(requestCast(w,'q',400,650));advance(w,.2);assert.equal(w.player.recast,null);assert.ok(w.targets[0].vx>0);assert.ok(w.player.cooldowns.q>5);assert.equal(w.fields.length,0);
});
test('paired gates carry actors to supported exits with a travel cooldown',()=>{
  const w=flat('star');requestCast(w,'e',650,650);advance(w,.45);assert.ok(w.portals.length);assert.ok(w.player.x>650);const until=w.player.portalAt;const pair=w.portals[0];w.player.x=pair.b.x;advance(w,.15);assert.equal(w.player.portalAt,until);assert.ok(w.player.x>600);advance(w,.8);assert.ok(w.player.x<300);
});
test('star stacks only once per cast even when two fields alternate damage ticks',()=>{
  const w=flat('star'),t=w.targets[0];for(let i=0;i<4;i++){damage(w,t,1,{school:'star',castId:10,impact:false});damage(w,t,1,{school:'star',castId:20,impact:false});}assert.equal(w.player.stars,2);damage(w,t,1,{school:'star',castId:30,impact:false});assert.equal(w.player.stars,3);requestCast(w,'attack',420,650);advance(w,.18);assert.equal(w.player.stars,0);assert.ok(w.projectiles[0].homing);
});
test('all ranged new basics, including homing stars, stop at an actual wall',()=>{
  for(const h of ['frost','star']){const w=flat(h);w.player.stars=3;w.obstacles=[{x:320,y:450,w:12,h:254}];requestCast(w,'attack',420,650);advance(w,.8);assert.equal(w.targets[0].hp,240);assert.equal(w.projectiles.length,0);assert.ok(w.events.some(e=>e.type==='wallHit'));}
});
test('ground fields disappear when their supporting deck is destroyed',()=>{
  const w=flat('frost');w.platforms.push({id:'support',x:320,y:500,w:220,type:'wood',active:true});requestCast(w,'r',400,450);advance(w,.5);assert.equal(w.fields[0].y,500);w.platforms[1].active=false;advance(w,.02);assert.equal(w.fields.length,0);
});
test('all four rigs stay finite with anchored shoulders through movement, skills and zero-time resume',()=>{
  const json=JSON.parse(readFileSync(new URL('../dist/assets/heroes/bounds-v1.json',import.meta.url)));
  for(const h of ids)for(const face of [-1,1])for(const k of ['attack','q','e','r']){const w=flat(h);requestCast(w,k,face<0?50:500,620);const pose=basePose();for(let i=0;i<160;i++){step(w,STEP,{move:face});const desired=targetPose(w);blendPose(pose,desired,i<2?0:STEP,k==='r');assert.ok(Object.values(pose).every(Number.isFinite));const frame=bodyFrame(h,pose,json[h].core),arm=armChain(frame.near,pose.armA,pose.elbowA,pose.lean);assert.equal(arm.shoulder,frame.near);assert.ok(Math.abs(Math.hypot(arm.elbow.x-arm.shoulder.x,arm.elbow.y-arm.shoulder.y)-28)<1e-8);}}
});
test('new hero rendering, effects, fields and passive indicators use finite coordinates',()=>{
  globalThis.matchMedia=()=>({matches:false});const json=p=>JSON.parse(readFileSync(new URL('../dist/assets/'+p,import.meta.url)));
  const grad={addColorStop(){}};const ctx=new Proxy({createLinearGradient:()=>grad,createRadialGradient:()=>grad},{get(o,k){return k in o?o[k]:(...args)=>{for(const a of args)if(typeof a==='number')assert.ok(Number.isFinite(a),String(k)+' received '+a);};}});
  const assets={bounds:json('rig-bounds.json'),coreBounds:json('core-bounds-v2.json'),combatBounds:json('combat/bounds-v2.json'),sceneBounds:json('scenes/prop-bounds-v1.json'),rosterBounds:json('heroes/bounds-v1.json')};
  for(const h of ids){assets.bounds[h]=assets.rosterBounds[h];assets.coreBounds[h]=assets.rosterBounds[h].core;assets[h]={};assets[h+'Core']={};assets[h+'Fx']={};}
  for(const h of ids)for(const k of ['attack','q','e','r']){const w=flat(h),r=new Renderer({getContext:()=>ctx},assets);requestCast(w,k,420,650);for(let i=0;i<350;i++){step(w,STEP);r.hero(w,1,i<2?0:STEP);r.roster.before(w);r.roster.passive(w);for(const e of w.effects)r.roster.effect(w,e);for(const s of w.projectiles)r.roster.projectile(w,s);}}
});
for(const scene of ['moon','lava','garden'])for(const hero of ids)test(scene+': '+hero+' reaches every deck using basic jumps without skill assistance',()=>{const result=auditRoutes(hero,scene,scene==='moon'?{brokenBridge:true}:scene==='garden'?{noVine:true}:{});assert.deepEqual(result.unreachable,[]);});
