import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorld,step,STEP,damage,requestCast} from '../dist/src/simulation.mjs';
import {ENEMIES,ENEMY_IDS} from '../dist/src/enemy-roster.mjs';
import {spawnEnemy,placeEncounter,clearEnemies,enemyAnimationFrame,enemyStrikeContact,applyEnemyStatus,enemyCastOrigin} from '../dist/src/enemy-simulation.mjs';
import {EnemyPainter} from '../dist/src/enemy-painter.mjs';
function flat(hero='fire'){
 const w=createWorld(hero);w.targets=[];w.mirror.enabled=false;w.spring.enabled=false;w.obstacles=[];
 w.platforms=w.platforms.filter(p=>p.id==='ground');w.player.hp=w.player.maxHp=5000;
 return w;
}
function run(w,time,input={}){for(let i=0;i<Math.ceil(time/STEP);i++){step(w,STEP,input);w.events=[];}}
function bullet(w,e,{damage:amount=1,status,style='stone'}={}){
 const p=w.player;p.invuln=0;w.projectiles.push({id:++w.serial,kind:'enemyAbility',owner:'enemy',enemySource:e.id,enemyStyle:style,enemyStatus:status,x:p.x-22,y:p.y-50,px:p.x-22,py:p.y-50,vx:4800,vy:0,damage:amount,r:7,age:0,life:2,trail:[]});step(w,STEP);
}
const statusHooks={effect(w,kind,data){w.effects.push({kind,age:0,duration:.6,...data});}};
test('all 40 enemy definitions have health, independent art and distinct boss active combos plus traits',()=>{
 assert.equal(ENEMY_IDS.length,40);assert.equal(ENEMY_IDS.filter(id=>ENEMIES[id].boss).length,20);
 for(const d of Object.values(ENEMIES)){assert.ok(d.hp>0&&d.h>0&&d.w>0);assert.ok(d.patterns.length);
  if(d.boss){assert.ok(d.passive&&d.passiveText);assert.ok(d.patterns.some(p=>p.kind==='melee'&&p.steps.length>=2));assert.ok(d.patterns.some(p=>p.kind==='range'));assert.ok(d.patterns.some(p=>p.kind==='special'));}
 }
 assert.ok(!ENEMIES.B02.patterns.some(p=>p.steps.some(s=>s.type==='egg')),'egg is automatic trait');
 assert.ok(!ENEMIES.B07.patterns.some(p=>p.steps.some(s=>s.type==='heal')),'regen is not its entire active kit');
});
test('each enemy can be placed, pursue and damage the actual player, without any dummy counterattack flag',()=>{
 for(const id of ENEMY_IDS){const w=flat();const e=spawnEnemy(w,id,{x:600,y:w.floor});run(w,14);assert.ok(w.player.hp<5000,`${id} never attacked`);assert.ok([e.x,e.y,e.vx,e.vy].every(Number.isFinite),id);assert.ok(e.ai.sequence>0,id);}
});
test('sprite metadata covers 41 real transparent atlases and all 656 frames with matching hashes',()=>{
 const path=new URL('../dist/assets/enemies/',import.meta.url),legacy=JSON.parse(readFileSync(new URL('bounds-v1.json',path))),chapterTwo=JSON.parse(readFileSync(new URL('chapter2/bounds-v1.json',path))),units={...legacy.units,...chapterTwo.units},manifest=JSON.parse(readFileSync(new URL('prompts-v1.json',path)));
 assert.equal(Object.keys(legacy.units).length,22);assert.equal(manifest.units.length,22);assert.equal(Object.keys(chapterTwo.units).length,19);assert.equal(Object.keys(units).length,41);
 for(const id of [...ENEMY_IDS,'S01']){const data=units[id];assert.equal(data.frames.length,16);if(data.cornerAlpha)assert.equal(data.cornerAlpha.every(x=>x<=2),true);const bytes=readFileSync(new URL(data.file,path));assert.ok(bytes.length>10000);assert.equal(bytes[25],6,'native RGBA PNG '+id);assert.equal(createHash('sha256').update(bytes).digest('hex'),data.sha256);assert.ok(data.socket.x>=0&&data.socket.x<=1);assert.ok(data.socket.y>=0&&data.socket.y<=1);
  for(const f of data.frames){assert.ok(f.bbox[2]>0&&f.bbox[3]>0);assert.ok(f.bottomNormalized>0&&f.bottomNormalized<=1);assert.equal(f.spriteRect.length,4);}
 }
});
test('ranged attacks originate at the calibrated frame mouth and can hit the visible upper body of a boss',()=>{
 const meta=JSON.parse(readFileSync(new URL('../dist/assets/enemies/bounds-v1.json',import.meta.url)));
 const w=flat(),e=spawnEnemy(w,'B02',{x:600,y:w.floor});w.enemyArt=meta.units;e.ai.readyAt=100;e.rootUntil=100;
 const hp=e.hp;w.projectiles.push({id:++w.serial,kind:'fireball',owner:'player',x:540,y:e.y-220,px:540,py:e.y-220,vx:9000,vy:0,damage:18,fire:true,r:7,age:0,life:2,trail:[]});step(w,STEP);assert.ok(e.hp<hp,'the visible upper body must not be unhittable');
 e.ai.readyAt=0;let shot;for(let i=0;i<300&&!shot;i++){step(w,STEP);shot=w.projectiles.find(p=>p.enemySource===e.id);}
 assert.ok(shot);const origin=enemyCastOrigin(w,e);assert.ok(Math.abs(shot.px-origin.x)<.01);assert.ok(Math.abs(shot.py-origin.y)<.01);assert.ok(origin.y<e.y-150,'spit must originate near the head, not the legs');
});
test('all six heroes can damage and kill a placed enemy; dead enemies do not become respawning dummies',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star']){const w=flat(hero),e=spawnEnemy(w,'M04',{x:290,y:w.floor});Object.assign(w.player,{x:220,prevX:220});e.ai.readyAt=100;
  run(w,1.5,{attack:true,aim:{x:290,y:w.floor-55}});assert.ok(e.hp<e.maxHp,hero+' basic failed');
  damage(w,e,10000);assert.equal(e.hp,0);assert.equal(enemyAnimationFrame(e,w.time),14);run(w,3.5);assert.ok(!w.targets.some(t=>t.id===e.id));assert.ok(!w.targets.some(t=>!t.enemyKind&&!t.egg));
 }
});
test('real combo steps are separated by windup, release and recovery, rather than hitting once per render',()=>{
 const w=flat(),e=spawnEnemy(w,'B05',{x:345,y:w.floor});run(w,8);
 assert.ok(w.enemyEvents.some(e=>e.type==='comboStep'));
 const damageTaken=5000-w.player.hp;assert.ok(damageTaken>0&&damageTaken<200,damageTaken);
 assert.ok(w.enemyEvents.some(e=>e.type==='attackStarted'&&e.source==='active'));
});
test('melee accepts contact overlap but cannot hit a target wholly behind or through a wall',()=>{
 const w=flat(),e=spawnEnemy(w,'M04',{x:400,y:w.floor});e.face=1;const s={reach:130};w.player.x=400;
 assert.ok(enemyStrikeContact(w,e,w.player,s));w.player.x=300;assert.equal(enemyStrikeContact(w,e,w.player,s),false);
 w.player.x=490;w.obstacles=[{x:445,y:500,w:10,h:204}];assert.equal(enemyStrikeContact(w,e,w.player,s),false);
});
test('poison is sustained real damage, refreshing its duration without stacking duplicate tick streams',()=>{
 const w=flat(),e=spawnEnemy(w,'M07',{x:1000,y:w.floor});e.ai.readyAt=100;e.ai.nextPassive=100;
 bullet(w,e,{status:'poison',style:'venom'});const hp=w.player.hp;assert.ok(w.player.enemyStatus.poison);
 applyEnemyStatus(w,'poison',e.id,statusHooks);run(w,2.3);assert.equal(hp-w.player.hp,12);
 run(w,2);assert.equal(w.player.enemyStatus.poison,undefined);assert.equal(hp-w.player.hp,16);
});
test('stone and frost passives accumulate on actual hits, block inputs temporarily and grant control resistance',()=>{
 for(const [id,kind] of [['B06','petrify'],['B08','freeze']]){
  const w=flat(),e=spawnEnemy(w,id,{x:1000,y:w.floor});e.ai.readyAt=100;e.ai.nextPassive=100;
  for(let i=0;i<3;i++)bullet(w,e,{style:kind==='freeze'?'ice':'stone'});
  assert.equal(w.player.enemyControl.kind,kind);assert.equal(requestCast(w,'q'),false);
  const x=w.player.x;run(w,.5,{move:1,jump:true,dash:true,cast:'e'});assert.ok(Math.abs(w.player.x-x)<.1);assert.equal(w.player.cast,null);
  run(w,2.2);assert.equal(w.player.enemyControl,null);applyEnemyStatus(w,kind,e.id,statusHooks);assert.equal(w.player.enemyControl,null);
  run(w,.4,{move:1});assert.ok(w.player.x>x+20);
 }
});
test('spider trait visibly lays a damageable egg, which hatches exactly three attacking baby spiders',()=>{
 const w=flat(),boss=spawnEnemy(w,'B02',{x:800,y:w.floor});boss.ai.nextPassive=0;run(w,2.1);
 const egg=w.targets.find(t=>t.egg&&t.hp>0);assert.ok(egg);assert.equal(egg.hp,45);assert.ok(egg.hatchAt>w.time);
 run(w,2.3);const babies=w.targets.filter(t=>t.owner===boss.id&&t.enemyKind==='S01');assert.equal(babies.length,3);assert.ok(babies.every(t=>t.baby&&t.hp>0));assert.ok(babies.every(t=>ENEMIES[t.enemyKind].summonOnly));
 assert.equal(w.enemyEvents.find(e=>e.type==='eggHatched').count,3);const before=w.player.hp;run(w,8);assert.ok(w.player.hp<before);
});
test('destroying a spider egg prevents its children, and skeleton summoning remains capped',()=>{
 const w=flat(),boss=spawnEnemy(w,'B02',{x:800,y:w.floor});boss.ai.nextPassive=0;run(w,2.1);const egg=w.targets.find(t=>t.egg);assert.ok(egg);damage(w,egg,100);run(w,3);assert.equal(w.targets.filter(t=>t.owner===boss.id&&t.enemyKind==='S01').length,0);
 const v=flat(),king=spawnEnemy(v,'B11',{x:800,y:v.floor});king.ai.nextPassive=0;run(v,2.2);assert.equal(v.targets.filter(t=>t.owner===king.id&&t.enemyKind==='M06').length,2);
 run(v,39);assert.ok(v.targets.filter(t=>t.owner===king.id&&t.hp>0).length<=4);
});
test('spider queen has a separate telegraphed leap attack that deals damage only after landing',()=>{
 const w=flat(),boss=spawnEnemy(w,'B02',{x:600,y:w.floor});boss.ai.readyAt=0;boss.ai.nextPassive=100;boss.ai.sequence=5;
 run(w,.6);assert.equal(w.player.hp,5000);assert.equal(boss.y,w.floor);
 run(w,.4);assert.ok(boss.y<w.floor-50);assert.equal(w.player.hp,5000);
 run(w,.9);assert.ok(w.enemyEvents.some(e=>e.type==='leapLanded'));assert.ok(w.player.hp<5000);
});
test('bull residue is grounded lava that burns the player and expires; tree regeneration is automatic',()=>{
 const w=flat(),bull=spawnEnemy(w,'B05',{x:345,y:w.floor});run(w,5);const zone=w.enemyZones.find(z=>z.style==='lava');assert.ok(zone);assert.equal(zone.y,w.floor);
 Object.assign(w.player,{x:zone.x,y:zone.y,prevX:zone.x,prevY:zone.y,invuln:0});run(w,.85);assert.ok(w.player.enemyStatus?.burn);
 const v=flat(),tree=spawnEnemy(v,'B07',{x:1000,y:v.floor});damage(v,tree,250,{impact:false});const before=tree.hp;tree.ai.nextPassive=0;run(v,3);assert.ok(tree.hp>before);assert.ok(tree.hp<=tree.maxHp);assert.ok(v.enemyEvents.some(e=>e.type==='healed'));
});
test('enemy minions and zones interact with the actual nature summon and can be cleared without stale poison',()=>{
 const w=flat('nature');spawnEnemy(w,'B05',{x:600,y:w.floor});requestCast(w,'e');run(w,5);assert.ok(w.stats.damage>0);assert.ok(w.fox);assert.ok(w.fox.hp<w.fox.maxHp);
 applyEnemyStatus(w,'poison','test',statusHooks);clearEnemies(w);assert.equal(w.targets.length,0);assert.equal(w.enemyZones.length,0);assert.equal(w.player.enemyStatus,null);
});
test('placement is reusable on all three maps and respects terrain/actor collisions and living cap',()=>{
 for(const scene of ['moon','lava','garden']){const w=createWorld('fire',scene);placeEncounter(w,['B02'],{x:1280,y:w.floor});assert.equal(w.targets.length,1);assert.equal(w.targets[0].y,w.floor);run(w,4);for(const a of w.targets)assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));}
 const w=flat();for(let i=0;i<20;i++)spawnEnemy(w,'M01',{x:500+i*20,y:w.floor});assert.equal(w.targets.filter(t=>t.hp>0).length,18);
 assert.throws(()=>spawnEnemy(w,'bad-id'),/Unknown enemy/);
});
test('all 120 enemy/map combinations actually begin attacks on authored terrain instead of parking behind ledges',()=>{
 const art={...JSON.parse(readFileSync(new URL('../dist/assets/enemies/bounds-v1.json',import.meta.url))).units,...JSON.parse(readFileSync(new URL('../dist/assets/enemies/chapter2/bounds-v1.json',import.meta.url))).units};
 for(const scene of ['moon','lava','garden'])for(const id of ENEMY_IDS){const w=createWorld('fire',scene);w.enemyArt=art;w.player.hp=w.player.maxHp=50000;
  Object.assign(w.player,{x:850,y:w.floor,prevX:850,prevY:w.floor,platformId:'ground'});const [e]=placeEncounter(w,[id],{x:1280,y:w.floor});run(w,20);
  assert.ok(w.enemyEvents.some(event=>event.type==='attackStarted'&&event.id===e.id),scene+' '+id+' never attacks');
 }
});
test('enemy sprite/attack/status painters use finite coordinates during every actual attack',()=>{
 const gradient={addColorStop(){}};
 const c=new Proxy({createLinearGradient(...n){assert.ok(n.every(Number.isFinite));return gradient;},createRadialGradient(...n){assert.ok(n.every(Number.isFinite));return gradient;}},{get(o,k){return k in o?o[k]:(...args)=>{for(const arg of args)if(typeof arg==='number')assert.ok(Number.isFinite(arg),String(k));};}});
 const assets={enemies:Object.fromEntries(ENEMY_IDS.map(id=>[id,{width:1280,height:1280}]))},painter=new EnemyPainter(c,assets);
 for(const id of ENEMY_IDS){const w=flat(),e=spawnEnemy(w,id,{x:390,y:w.floor});for(let i=0;i<700;i++){step(w,STEP);if(i%8)continue;for(const t of w.targets)painter.unit(w,t,.5);painter.zones(w);for(const s of w.projectiles)painter.projectile(w,s);for(const fx of w.effects)painter.effect(w,fx);painter.player(w);assert.ok(enemyAnimationFrame(e,w.time)>=0&&enemyAnimationFrame(e,w.time)<16);}}
});
