import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,requestCast,step,STEP} from '../dist/src/simulation.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {ENEMIES} from '../dist/src/enemy-roster.mjs';
import {createDuel,duelSnapshot,restoreDuel,stepDuel} from '../dist/src/duel-simulation.mjs';
import {renderDuelWorld} from '../dist/src/duel-visual-clock.mjs';
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {PROJECTILE_RANGES,ensureProjectileRange,projectileMotion,spendProjectileDistance} from '../dist/src/projectile-range.mjs';
const heroes=['fire','nature','frost','lightning','shadow','star'];
function flat(hero='fire'){const w=createWorld(hero);w.width=6000;w.platforms=w.platforms.filter(p=>p.id==='ground');w.platforms[0].w=6000;w.obstacles=[];w.mechanisms=null;w.mirror.enabled=false;w.spring.enabled=false;w.counterattack=false;w.moving=false;Object.assign(w.player,{x:500,prevX:500,y:w.floor,prevY:w.floor});return w;}
function run(w,time,observe=()=>{}){for(let n=0;n<Math.ceil(time/STEP);n++){step(w,STEP);observe();}}
function until(w,predicate,time=5){for(let n=0;n<Math.ceil(time/STEP);n++){step(w,STEP);const r=predicate();if(r)return r;}assert.fail('Expected a real emitted projectile');}
function shot(w,extra={}){const s={id:++w.serial,kind:'fireball',owner:'player',basic:true,school:'fire',x:500,y:w.floor-50,px:500,py:w.floor-50,vx:1000,vy:0,r:5,age:0,life:3.5,damage:18,trail:[],...extra};w.projectiles.push(s);return s;}
test('flight budgets use accumulated curved path length and clamp a large step before it crosses the endpoint',()=>{
 const s={owner:'player',kind:'starBolt',basic:true,x:0,y:0,vx:30,vy:0,age:0,life:10,maxRange:100};ensureProjectileRange(s);
 for(const [vx,vy] of [[30,0],[0,40],[-30,0]]){s.vx=vx;s.vy=vy;const old={...s},next=projectileMotion(s,1);Object.assign(s,next);spendProjectileDistance(s,old.x,old.y);}
 assert.equal(s.distanceTravelled,100);assert.equal(s.x,0);assert.equal(s.y,40);assert.deepEqual(projectileMotion(s,100),{x:0,y:40});
 const short={owner:'player',kind:'thunderFistBolt',basic:true,hybridBasic:true,x:0,y:0,vx:920,vy:0,age:0,life:.78};ensureProjectileRange(short);assert.equal(short.rangeLimit,920*.78);
 const explicit={owner:'player',kind:'starBolt',basic:true,x:0,y:0,vx:100,vy:0,age:0,life:3,range:450};ensureProjectileRange(explicit);assert.equal(explicit.rangeLimit,450);
});
test('all six heroes emit finite real basics and cannot hurt a target beyond their budget in the training/solo shared simulation',()=>{
 for(const hero of heroes){const w=flat(hero),target=w.targets[0];w.targets=[target];target.x=target.spawnX=1650;target.y=target.spawnY=w.floor;requestCast(w,'attack',4000,w.floor-50);
  const p=until(w,()=>w.projectiles.find(v=>v.basic));assert.ok(p.rangeLimit>0&&p.rangeLimit<=740,hero);let faded=false;
  run(w,2.5,()=>{faded||=w.effects.some(e=>e.kind==='projectileDissipate');});assert.equal(target.hp,target.maxHp,hero);assert.ok(!w.projectiles.includes(p),hero);assert.ok(p.distanceTravelled<=p.rangeLimit+1e-7,hero);assert.ok(faded,hero);
 }
});
test('high dt and extreme speed never sweep an actor beyond the remaining range or remaining lifetime',()=>{
 for(const extra of [{maxRange:80,vx:100000},{maxRange:1000,vx:5000,life:.005}]){const w=flat(),target=w.targets[0];w.targets=[target];target.x=target.spawnX=700;target.y=target.spawnY=w.floor;const p=shot(w,extra);step(w,1);assert.equal(target.hp,target.maxHp);assert.ok(!w.projectiles.includes(p));assert.ok(p.x<=580.00001);assert.ok(w.effects.some(e=>e.kind==='projectileDissipate'));}
 const w=flat(),target=w.targets[0];w.targets=[target];target.x=target.spawnX=550;target.y=target.spawnY=w.floor;shot(w,{maxRange:80,vx:100000});step(w,1);assert.ok(target.hp<target.maxHp,'inside-range contacts still work');
});
test('actual campaign and PvP directional skill emissions use the shared budget without converting grounded ultimates',()=>{
 const campaign=createCampaign('fire',1,{seed:47});campaign.platforms=campaign.platforms.filter(p=>p.id==='ground');const enemy=spawnEnemy(campaign,'M06',{x:1700,y:campaign.floor});enemy.ai.stagger=100;enemy.ai.readyAt=Infinity;
 requestCast(campaign,'attack',3000,campaign.floor-50);let basic,fade=false;for(let i=0;i<250;i++){stepCampaign(campaign,STEP);basic||=campaign.projectiles.find(p=>p.basic);fade||=campaign.effects.some(e=>e.kind==='projectileDissipate');}assert.equal(basic.rangeLimit,720);assert.equal(enemy.hp,enemy.maxHp);assert.ok(fade);
 for(const [hero,key,column]of [['fire','e',0],['frost','e',1],['nature','q',1],['lightning','q',1],['star','q',1],['shadow','q',0]]){
  const row={q:0,e:1,r:2}[key],loadout={q:hero+'-0-0',e:hero+'-1-0',r:hero+'-2-0'};loadout[key]=`${hero}-${row}-${column}`;
  const w=createDuel([hero,'fire'],'moon',[loadout]).worlds[0];w.targets=[];w.mirror.enabled=false;w.mechanisms=null;requestCast(w,key,950,w.floor-50);
  const p=until(w,()=>w.projectiles.find(p=>p.owner==='player'));assert.equal(p.rangeLimit,PROJECTILE_RANGES.directional,hero+' '+key);
 }
 const ground=flat('fire');ground.targets=[];requestCast(ground,'r',900,ground.floor-20);run(ground,.4);assert.equal(ground.projectiles.length,0);assert.ok(ground.effects.some(e=>e.kind==='meteor'));
});
test('ordinary ranged minions receive a finite real budget while bosses and non-projectile attacks are not converted',()=>{
 const ranged=Object.keys(ENEMIES).filter(id=>!ENEMIES[id].boss&&ENEMIES[id].patterns.some(p=>p.steps.some(s=>s.type==='projectile')));
 assert.ok(ranged.includes('M20'));
 for(const id of ranged){const w=flat();w.targets=[];Object.assign(w.player,{x:1000,prevX:1000,hp:1e6,maxHp:1e6});const e=spawnEnemy(w,id,{x:500,y:w.floor});
  for(const pattern of ENEMIES[id].patterns)if(!pattern.steps.some(s=>s.type==='projectile'))e.ai.cooldowns[pattern.id]=Infinity;e.ai.readyAt=0;
  const p=until(w,()=>w.projectiles.find(v=>v.enemySource===e.id));assert.equal(p.rangeLimit,PROJECTILE_RANGES.minion,id);assert.equal(p.enemyRangeLimited,true,id);
 }
 for(const s of [{owner:'enemy',kind:'enemyAbility',enemyKind:'B08',enemySource:'boss',life:6,vx:300,vy:0},{owner:'player',kind:'petBolt',petProjectile:'frostfox',life:3,vx:300,vy:0},{owner:'player',kind:'fallingMeteor',life:3,vx:0,vy:300}])assert.equal(ensureProjectileRange(s),false);
});
test('range exhaustion never creates a damaging enemy pool, and ordinary walls still stop shots earlier',()=>{
 const w=flat();w.targets=[];w.player.x=w.player.prevX=1700;
 const p=shot(w,{owner:'enemy',kind:'enemyAbility',enemyKind:'M07',enemySource:'missing',enemyStyle:'venom',enemyPool:true,basic:false,x:600,maxRange:40,vx:10000});step(w,.03);assert.equal(p.life,0);assert.equal(w.enemyZones?.length||0,0);assert.ok(w.effects.some(e=>e.kind==='projectileDissipate'));
 const other=flat();other.targets=[];other.obstacles=[{x:540,y:other.floor-100,w:8,h:100}];const stopped=shot(other,{maxRange:300,vx:10000});step(other,.03);assert.equal(stopped.life,0);assert.ok(stopped.distanceTravelled<300);assert.ok(other.effects.some(e=>e.kind==='chips'));assert.ok(!other.effects.some(e=>e.kind==='projectileDissipate'));
});
test('a reflected projectile spends the same path budget rather than refreshing it at the mirror',()=>{
 const w=flat();w.targets=[];Object.assign(w.mirror,{enabled:true,x:560,y:w.floor-50,angle:Math.PI/2});const p=shot(w,{maxRange:120,vx:1000});let reflected=false;run(w,.5,()=>{reflected||=p.vx<0;});assert.ok(reflected);assert.equal(p.life,0);assert.ok(Math.abs(p.distanceTravelled-120)<1e-6);assert.ok(p.x<500);
});
test('network snapshot/restore retains spent range, and visual projection cannot cross the remaining endpoint or mutate authority',()=>{
 const match=createDuel(['fire','star']);for(const w of match.worlds){w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.mechanisms=null;w.mirror.enabled=false;w.spring.enabled=false;}const w=match.worlds[0];Object.assign(w.player,{x:300,prevX:300});Object.assign(match.worlds[1].player,{x:1900,prevX:1900});
 const p=shot(w,{maxRange:100,x:500,vx:1000});stepDuel(match,.02);assert.ok(p.distanceTravelled>0);
 const snap=duelSnapshot(match,{epoch:'range',roundSerial:1}),restored=restoreDuel(JSON.parse(JSON.stringify(snap))),received=restored.worlds[0].projectiles[0];assert.equal(received.rangeLimit,100);assert.equal(received.distanceTravelled,20);
 const before=received.distanceTravelled;received.distanceTravelled=99;const source=JSON.stringify(restored.worlds[0]),view=renderDuelWorld(restored.worlds[0],.05);assert.equal(view.projectiles.length,0);assert.equal(JSON.stringify(restored.worlds[0]),source);
 received.distanceTravelled=before;for(let i=0;i<10;i++)stepDuel(restored,.02);assert.equal(restored.worlds[0].projectiles.length,0);assert.equal(match.worlds[1].player.hp,match.worlds[1].player.maxHp);
});
