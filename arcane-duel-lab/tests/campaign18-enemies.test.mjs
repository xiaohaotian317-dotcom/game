import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorld,step,STEP,damage} from '../dist/src/simulation.mjs';
import {ENEMIES} from '../dist/src/enemy-roster.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {EnemyPainter} from '../dist/src/enemy-painter.mjs';

const chapterIds=Object.keys(ENEMIES).filter(id=>ENEMIES[id].chapter===2);
const art=Object.assign({},...['bounds-v1.json','chapter2/bounds-v2.json'].map(file=>JSON.parse(readFileSync(new URL('../dist/assets/enemies/'+file,import.meta.url))).units));
function arena(id,{distance=450,half=false,pattern=null}={}){
 const w=createWorld('fire');w.targets=[];w.obstacles=[];w.mechanisms=null;w.mirror.enabled=false;w.spring.enabled=false;w.platforms=w.platforms.filter(p=>p.id==='ground');w.enemyArt=art;
 Object.assign(w.player,{x:400,prevX:400,y:w.floor,prevY:w.floor,hp:1e6,maxHp:1e6});
 const e=spawnEnemy(w,id,{x:400+distance,y:w.floor});if(half)e.hp=e.maxHp*.45;
 if(pattern){e.ai.sequence=2;for(const p of ENEMIES[id].patterns)if(p.id!==pattern)e.ai.cooldowns[p.id]=Infinity;}
 return {w,e};
}
function run(w,seconds,observe=()=>{}){for(let n=0;n<Math.ceil(seconds/STEP);n++){step(w,STEP);observe();}}
function until(w,predicate,seconds=10){for(let n=0;n<Math.ceil(seconds/STEP);n++){step(w,STEP);const value=predicate();if(value)return value;}assert.fail('timed out waiting for a real enemy action');}

test('all nineteen chapter-two enemies naturally pursue and damage at close and far range, including both boss phases',()=>{
 assert.equal(chapterIds.length,19);
 for(const id of chapterIds)for(const distance of [120,560])for(const half of ENEMIES[id].boss?[false,true]:[false]){
  const {w,e}=arena(id,{distance,half});const started=new Set();let minimum=distance;
  run(w,40,()=>{for(const event of w.enemyEvents)if(event.type==='attackStarted'&&event.id===e.id)started.add(event.pattern);minimum=Math.min(minimum,Math.abs(e.x-w.player.x));assert.ok([e.x,e.y,e.vx,e.vy,w.player.hp].every(Number.isFinite),id);});
  const label=`${id} distance ${distance} half ${half}`;
  assert.ok(started.size,label+' never selected a real attack');assert.ok(w.player.hp<1e6,label+' never hurt the player');
  if(ENEMIES[id].boss){assert.equal(e.ai.phase,half?2:1,label);if(distance===560)assert.ok(minimum<300,label+' never approached after ranged pressure');}
 }
});

test('chapter-two melee minions execute their distinct combo, dash and on-hit control mechanics',()=>{
 for(const [id,kind]of [['M11','snare'],['M12','dash'],['M13','poison'],['M14','dash'],['M15','combo'],['M16','snare'],['M20','combo']]){
  const {w,e}=arena(id,{distance:95});let status=false,dash=false,combo=false;
  run(w,12,()=>{status||=kind==='poison'?!!w.player.enemyStatus?.poison:w.player.enemySnareUntil>w.time;dash||=e.ai.attack?.plan.steps[e.ai.attack.index]?.type==='dash'&&Math.abs(e.vx)>180;combo||=w.enemyEvents.some(event=>event.type==='comboStep'&&event.id===e.id);});
  assert.ok(w.player.hp<1e6,id+' real damage');assert.ok(kind==='dash'?dash:kind==='combo'?combo:status,id+' '+kind);
 }
});

test('contract seal tracks a moving target only during its initial seeking window',()=>{
 const {w,e}=arena('M17',{pattern:'seal'}),s=until(w,()=>w.projectiles.find(p=>p.enemySource===e.id));
 assert.equal(s.enemySeeking,true);const vy=s.vy;w.player.y-=220;w.player.prevY=w.player.y;w.player.grounded=false;w.player.vy=-100;
 run(w,.2);assert.ok(s.vy<vy-10,'seal must turn toward the elevated target');
 until(w,()=>s.age>.62);const after=s.vy;w.player.y=w.floor;run(w,.1);assert.equal(s.vy,after,'homing must stop after the limited window');
});

test('prism bolts actually ricochet once from solid cover and cannot bounce forever',()=>{
 const {w,e}=arena('M18'),s=until(w,()=>w.projectiles.find(p=>p.enemySource===e.id));assert.equal(s.enemyRicochet,1);const direction=Math.sign(s.vx);
 w.obstacles=[{x:s.x+direction*45-4,y:s.y-100,w:8,h:200,actor:false}];
 until(w,()=>s.enemyRicochet===0,1);assert.equal(Math.sign(s.vx),-direction);assert.ok(w.projectiles.includes(s));
 w.obstacles.push({x:s.x-direction*45-4,y:s.y-100,w:8,h:200,actor:false});until(w,()=>!w.projectiles.includes(s),1);assert.equal(s.life,0);
});

test('spore lantern lobs a gravity-driven projectile that creates a grounded poisonous pool',()=>{
 const {w,e}=arena('M19'),s=until(w,()=>w.projectiles.find(p=>p.enemySource===e.id));assert.ok(s.enemyGravity>0);assert.equal(s.enemyPool,true);const vy=s.vy;run(w,.15);assert.ok(s.vy>vy);
 const z=until(w,()=>w.enemyZones.find(z=>z.owner===e.id),5);assert.equal(z.style,'spore');assert.equal(z.status,'poison');assert.equal(z.y,w.floor);
 Object.assign(w.player,{x:z.x,y:z.y,prevX:z.x,prevY:z.y,invuln:0});const hp=w.player.hp;run(w,1);assert.ok(w.player.hp<hp);assert.ok(w.player.enemyStatus.poison);
});

test('anchor king emits opposing pushing tide fields with safe warnings and real damage',()=>{
 const {w,e}=arena('B12',{pattern:'twinwake'}),z=until(w,()=>w.enemyZones.find(z=>z.owner===e.id));assert.ok(z.push>0);assert.ok(z.delay>0);
 Object.assign(w.player,{x:z.x,prevX:z.x,invuln:0});const hp=w.player.hp;run(w,z.delay*.8);assert.equal(w.player.hp,hp,'warning is safe');
 until(w,()=>w.player.hp<hp,2);assert.ok(w.player.vx>0,'first tide pushes right');
 const right=until(w,()=>w.enemyZones.find(t=>t.owner===e.id&&t.push<0),5);Object.assign(w.player,{x:right.x,prevX:right.x,invuln:0});const before=w.player.hp;until(w,()=>w.player.hp<before,3);assert.ok(w.player.vx<0,'second tide pushes left');
});

test('crystal armor reduces real damage by twenty percent and burrow teleports before its uppercut',()=>{
 const {w,e}=arena('B13',{pattern:'burrow'});e.ai.nextPassive=0;step(w,STEP);assert.ok(e.ai.crystalUntil>w.time);const hp=e.hp;damage(w,e,50,{source:'artifact',impact:false});assert.equal(hp-e.hp,40);
 w.time=e.ai.crystalUntil+.01;const exposed=e.hp;damage(w,e,50,{source:'artifact',impact:false});assert.equal(exposed-e.hp,50);
 const start=e.x;until(w,()=>w.enemyEvents.some(event=>event.type==='enemyTeleported'&&event.id===e.id),4);assert.ok(Math.abs(e.x-start)>100);const before=w.player.hp;run(w,3);assert.ok(w.player.hp<before,'emergence uppercut must damage');
});

test('swamp mother summons real attacking fungus minions with a living cap and no reward ownership loss',()=>{
 const {w,e}=arena('B14',{pattern:'brood'});const add=until(w,()=>w.targets.find(t=>t.owner===e.id),5);assert.equal(add.enemyKind,'M13');assert.ok(add.hp>0);const hp=w.player.hp;run(w,9);assert.ok(w.player.hp<hp);
 run(w,30);assert.ok(w.targets.filter(t=>t.owner===e.id&&t.hp>0).length<=4);assert.ok(w.targets.filter(t=>t.owner===e.id).every(t=>t.enemyKind==='M13'));
});

test('ash judge leaves damaging five-second cinders after its charge and during half-health pursuit',()=>{
 const {w,e}=arena('B15',{pattern:'pyre',half:true});const z=until(w,()=>w.enemyZones.find(z=>z.owner===e.id&&z.style==='lava'),5);assert.equal(z.life,5);assert.equal(z.status,'burn');assert.equal(z.y,w.floor);
 Object.assign(w.player,{x:z.x,prevX:z.x,invuln:0});const hp=w.player.hp;run(w,1.1);assert.ok(w.player.hp<hp);assert.ok(w.player.enemyStatus.burn);
 assert.ok(w.enemyZones.some(t=>t.owner===e.id&&t.style==='ash'),'half-health movement leaves separate cinders');
});

test('mirror queen and sand sovereign teleport through their own special plans and produce real follow-up mechanics',()=>{
 for(const [id,pattern]of [['B16','reflections'],['B17','sandstep']]){const {w,e}=arena(id,{pattern});const x=e.x;until(w,()=>w.enemyEvents.some(event=>event.type==='enemyTeleported'&&event.id===e.id),5);assert.ok(Math.abs(e.x-x)>100,id);assert.equal(e.y,w.floor);
  if(id==='B16'){const add=until(w,()=>w.targets.find(t=>t.owner===e.id),5);assert.equal(add.enemyKind,'M15');}
  else{w.player.x-=260;const s=until(w,()=>w.projectiles.find(p=>p.enemySource===e.id),4);assert.ok(Math.abs(s.vx)>400);const hp=w.player.hp;run(w,1.5);assert.ok(w.player.hp<hp);}
 }
 const {w,e}=arena('B17',{pattern:'hourglass'}),z=until(w,()=>w.enemyZones.find(z=>z.owner===e.id));Object.assign(w.player,{x:z.x,prevX:z.x,invuln:0});until(w,()=>w.player.enemySnareUntil>w.time,3);assert.ok(w.player.hp<1e6);
});

test('moon emperor leaps before landing damage and its ranged crescents really turn back',()=>{
 const {w,e}=arena('B18',{pattern:'moonfall'});until(w,()=>e.ai.attack?.leaping,5);assert.equal(w.player.hp,1e6);until(w,()=>e.y<w.floor-30,1);assert.equal(w.player.hp,1e6);until(w,()=>w.enemyEvents.some(event=>event.type==='leapLanded'&&event.id===e.id),3);assert.ok(w.player.hp<1e6);
 const ranged=arena('B18',{pattern:'crescent'}),s=until(ranged.w,()=>ranged.w.projectiles.find(p=>p.enemySource===ranged.e.id));assert.equal(s.enemyReturning,true);const direction=Math.sign(s.vx);ranged.w.player.x=50;until(ranged.w,()=>s.age>.9,2);assert.equal(Math.sign(s.vx),-direction,'crescent turns back toward its owner '+JSON.stringify({x:s.x,y:s.y,vx:s.vx,vy:s.vy,age:s.age,owner:ranged.e.x,active:ranged.w.projectiles.includes(s)}));
});

test('machine colossus emits three separately warned thunder pillars and its third landed hit causes overload',()=>{
 const {w,e}=arena('B19',{pattern:'conductors'}),centers=new Set();run(w,7,()=>{for(const z of w.enemyZones)if(z.owner===e.id){centers.add(z.x);assert.ok(z.delay>0);}});assert.equal(centers.size,3);
 const close=arena('B19',{distance:100});until(close.w,()=>close.e.ai.charges>=3,15);assert.ok(close.w.texts.some(t=>t.text==='−6'),'third contact must add the real overload hit');
});

test('eclipse king pulls with a real domain, teleports, and summons owned sand guards in its special sequence',()=>{
 const {w,e}=arena('B20',{pattern:'blackcrown'}),z=until(w,()=>w.enemyZones.find(z=>z.owner===e.id&&z.gravity));assert.ok(z.radius>0);Object.assign(w.player,{x:z.x+50,prevX:z.x+50,vx:0,invuln:999});until(w,()=>z.activated,3);run(w,.15);assert.ok(w.player.vx<0,'gravity domain pulls toward its center');w.player.invuln=0;const hp=w.player.hp;until(w,()=>w.player.hp<hp,2);
 until(w,()=>w.enemyEvents.some(event=>event.type==='enemyTeleported'&&event.id===e.id),5);const add=until(w,()=>w.targets.find(t=>t.owner===e.id),5);assert.equal(add.enemyKind,'M16');assert.ok(add.hp>0);
});

test('spider and moon leaps land at their displayed warning and share the same real normal/solo danger radius',()=>{
 const normalRadii={};
 for(const [id,pattern]of [['B02','leap'],['B18','moonfall']])for(const soloRange of [1,1.3])for(const inside of [true,false]){
  const {w,e}=arena(id,{pattern});e.soloRange=soloRange;const a=until(w,()=>e.ai.attack?.plan.id===pattern&&e.ai.attack),s=a.plan.steps[0];until(w,()=>a.age>=s.windup-.03,2);
  const ellipses=[],gradient={addColorStop(){}},c=new Proxy({ellipse(...args){ellipses.push(args);},createRadialGradient(){return gradient;}},{get:(obj,key)=>key in obj?obj[key]:()=>{}});new EnemyPainter(c,{}).telegraph(w,e);
  const warning=ellipses.find(args=>args[2]>80);assert.ok(warning,id+' ground warning');const [x,y,radius]=warning;assert.ok(Number.isFinite(radius)&&radius>100);if(soloRange===1)normalRadii[id]=radius;else assert.ok(Math.abs(radius-normalRadii[id]*1.3)<1e-8,id+' solo warning retains its real thirty percent range increase');assert.ok(Math.abs(y-w.floor)<=5);
  until(w,()=>a.leaping,1);assert.equal(w.player.hp,1e6,'windup never deals landing damage');Object.assign(w.player,{x:x+radius+w.player.w+(inside?-3:3),prevX:x+radius+w.player.w+(inside?-3:3),vx:0,invuln:0});
  until(w,()=>w.enemyEvents.some(event=>event.type==='leapLanded'&&event.id===e.id),3);const impact=w.effects.find(f=>f.kind==='enemyVfx'&&f.enemyKind===id&&f.ground&&Math.abs(f.radius-radius)<1e-8);assert.ok(impact,id+' landing impact uses warning radius');assert.ok(Math.abs(impact.x-x)<2,id+' lands at warned x');assert.ok(Math.abs(impact.y-y)<=5,id+' lands at warned support');assert.equal(w.player.hp<1e6,inside,id+' radius boundary');
 }
});
