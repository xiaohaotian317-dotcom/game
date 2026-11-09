import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,damage} from '../dist/src/simulation.mjs';
import {spawnEnemy,clearEnemies,enemyMeleeReach} from '../dist/src/enemy-simulation.mjs';
import {ENEMIES,ENEMY_IDS} from '../dist/src/enemy-roster.mjs';
import {bossVisibility} from '../dist/src/boss-tactics.mjs';
import {BOSS_TUNING,ENEMY_DAMAGE,enemyDamageFactor} from '../dist/src/enemy-tuning.mjs';
import {createCampaign,beginEncounter,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {EnemyPainter} from '../dist/src/enemy-painter.mjs';

function arena(kind,pattern,{campaign=false,x=400,bossX=900}={}){
 const profile=campaign?freshSolo():null,w=campaign?createCampaign('fire',16,{profile,random:()=>.99,seed:46}):createWorld('fire');
 w.targets=[];w.obstacles=[];w.mechanisms=null;w.mirror.enabled=w.spring.enabled=false;w.platforms=w.platforms.filter(p=>p.id==='ground');
 Object.assign(w.player,{x,prevX:x,y:w.floor,prevY:w.floor,vx:0,vy:0,hp:1e6,maxHp:1e6,invuln:0});
 if(campaign){Object.assign(w.campaign,{state:'boss',encounter:4,queue:[],triggers:[1e8,2e8,3e8,4e8],nextHazard:Infinity});}
 const e=spawnEnemy(w,kind,{x:bossX,y:w.floor});e.ai.nextPassive=Infinity;e.ai.sequence=2;
 for(const p of ENEMIES[kind].patterns)if(p.id!==pattern)e.ai.cooldowns[p.id]=Infinity;
 if(campaign){w.campaign.bossIds=[e.id];w.campaign.bossId=e.id;}
 return {w,e,profile};
}
function run(w,seconds,observe=()=>{},input={}){for(let n=0;n<Math.ceil(seconds/STEP);n++){step(w,STEP,input);observe();}}
function until(w,predicate,seconds=10){for(let n=0;n<Math.ceil(seconds/STEP);n++){step(w,STEP);const value=predicate();if(value)return value;}assert.fail('Timed out waiting for actual boss tactic');}
const currentStep=e=>e.ai.attack?.plan.steps[e.ai.attack.index];
function firstWave(options){const pair=arena('B12','undertow',options),{w,e}=pair;const z=until(w,()=>w.enemyWaves?.find(z=>z.owner===e.id));e.ai.cooldowns.undertow=Infinity;return {...pair,z};}

test('anchor shockwave is grounded and damages a victim only once even after invulnerability ends',()=>{
 const {w,e,z}=firstWave();assert.equal(z.y,w.floor);assert.equal(w.player.hp,1e6,'windup is safe');
 let contacts=0,previous=w.player.hp;
 run(w,1.5,()=>{if(w.player.hp<previous)contacts++;previous=w.player.hp;Object.assign(w.player,{x:z.x,prevX:z.x,y:w.floor,prevY:w.floor,vx:0,vy:0,invuln:0,hurt:0});});
 assert.equal(contacts,1);assert.equal(1e6-w.player.hp,z.damage);assert.deepEqual(z.victims,['player']);assert.ok(z.travel>0);
 until(w,()=>!w.enemyWaves.includes(z),3);assert.equal(w.enemyWaves.length,0);assert.equal(w.enemyEvents.filter(v=>v.type==='groundWaveReleased'&&v.id===e.id).length,1);
});

test('a timed real double jump avoids the low shockwave, while a fast swept crossing still connects on the floor',()=>{
 const dodge=firstWave();until(dodge.w,()=>dodge.z.x-dodge.w.player.x<190,4);
 step(dodge.w,STEP,{jump:true});assert.ok(dodge.w.player.vy<0);run(dodge.w,.28);step(dodge.w,STEP,{jump:true});assert.equal(dodge.w.player.jumps,2);let passed=false;
 run(dodge.w,.8,()=>{if(dodge.z.x<dodge.w.player.x-dodge.z.radius-30)passed=true;});
 assert.ok(passed,'wave must actually pass beneath the jumping player');assert.equal(dodge.w.player.hp,1e6);
 const fast=firstWave({x:500,bossX:1100}),{w,z}=fast;Object.assign(z,{x:850,prevX:850,speed:60000,distance:2000});
 const hp=w.player.hp;step(w,STEP);assert.ok(z.prevX>w.player.x+z.radius+w.player.w&&z.x<w.player.x-z.radius-w.player.w,'one update crosses the entire hurt interval');assert.equal(hp-w.player.hp,z.damage);
});

test('waves stop at arena bounds, lost support or dead owners, and clearEnemies removes pending waves',()=>{
 for(const ending of ['boundary','support','owner','clear']){
  const {w,e,z}=firstWave();const hp=w.player.hp;w.player.x=w.player.prevX=1300;
  if(ending==='boundary'){z.x=z.lo+1;step(w,STEP);assert.equal(z.x,z.lo);}
  if(ending==='support'){w.platforms[0].active=false;step(w,STEP);}
  if(ending==='owner'){damage(w,e,e.hp+1,{source:'artifact',impact:false});step(w,STEP);}
  if(ending==='clear')clearEnemies(w);
  assert.equal(w.enemyWaves.length,0,ending);assert.equal(w.player.hp,hp,ending+' cannot apply a distant late hit');
 }
});

test('crystal burrow remains briefly veiled and damageable, then reveals before the offensive uppercut',()=>{
 const {w,e}=arena('B13','burrow');until(w,()=>w.enemyEvents.find(v=>v.type==='enemyVeiled'&&v.id===e.id));
 const hp=e.hp;assert.ok(bossVisibility(e,w.time)<.3);assert.ok(damage(w,e,23,{source:'artifact',impact:false}));assert.equal(hp-e.hp,23,'veil is not immunity');
 run(w,.12);assert.ok(bossVisibility(e,w.time)<.3,'zero-damage veil/teleport phases may not immediately reveal the boss');
 const reveal=until(w,()=>w.enemyEvents.find(v=>v.type==='enemyRevealed'&&v.id===e.id),4);assert.equal(bossVisibility(e,w.time),1);
 assert.equal(currentStep(e).type,'melee');const a=e.ai.attack,s=currentStep(e);assert.ok(a.age<s.windup,'reveal must precede actual damage');assert.ok((s.windup-a.age)/a.speed>=.3);
 until(w,()=>e.ai.attack?.fired&&currentStep(e)?.type==='melee',2);assert.ok(w.time-reveal.time>=.3);
});

test('heavy hits interrupt a veil without making the boss immune or leaving it hidden while staggered',()=>{
 const {w,e}=arena('B13','burrow');until(w,()=>e.ai.veilUntil>w.time);const before=e.hp;
 damage(w,e,150,{source:'artifact',impact:true});assert.equal(before-e.hp,150);assert.equal(e.ai.attack,null);assert.ok(e.ai.stagger>0);assert.equal(bossVisibility(e,w.time),1);
});

test('fungal renewal restores no more than six percent during one channel and never revives a dead boss',()=>{
 const {w,e}=arena('B14','renewal');e.hp=Math.round(e.maxHp*.55);const before=e.hp;
 until(w,()=>w.enemyEvents.some(v=>v.type==='enemyHealing'&&v.id===e.id));until(w,()=>!e.ai.attack,5);
 const heals=w.enemyEvents.filter(v=>v.type==='bossHealed'&&v.id===e.id),total=heals.reduce((n,v)=>n+v.amount,0);
 assert.equal(heals.length,4);assert.ok(total>e.maxHp*.05&&total<=e.maxHp*.06+4);assert.equal(e.hp-before,total);
 const dead=arena('B14','renewal');dead.e.hp=Math.round(dead.e.maxHp*.55);until(dead.w,()=>dead.w.enemyEvents.some(v=>v.type==='enemyHealing'));
 damage(dead.w,dead.e,dead.e.hp+1,{source:'artifact',impact:false});run(dead.w,3);assert.equal(dead.e.hp,0);assert.equal(dead.w.enemyEvents.some(v=>v.type==='bossHealed'&&v.id===dead.e.id),false);
});

test('renewal stops after a real stagger and does not continue its remaining healing ticks',()=>{
 const {w,e}=arena('B14','renewal');e.hp=Math.round(e.maxHp*.55);until(w,()=>w.enemyEvents.some(v=>v.type==='bossHealed'&&v.id===e.id));
 const tickCount=w.enemyEvents.filter(v=>v.type==='bossHealed'&&v.id===e.id).length;damage(w,e,150,{source:'artifact',impact:true});const hp=e.hp;
 assert.equal(e.ai.attack,null);run(w,3);assert.equal(e.hp,hp);assert.equal(w.enemyEvents.filter(v=>v.type==='bossHealed'&&v.id===e.id).length,tickCount);
});

test('mirror clones fight as real minions but draw the queen body and never exceed two living reflections',()=>{
 const {w,e}=arena('B16','reflections');const clones=until(w,()=>{const list=w.targets.filter(t=>t.owner===e.id&&t.mirage);return list.length===2&&list;},6);
 assert.ok(clones.every(t=>t.enemyKind==='M15'&&t.appearanceKind==='B16'&&t.hp>0));
 const draws=[],gradient={addColorStop(){}},ctx=new Proxy({drawImage(...args){draws.push(args);},createRadialGradient(){return gradient;}},{get:(o,key)=>key in o?o[key]:()=>{}}),queenImage={width:1024,height:1024,identity:'B16'},guardImage={width:1024,height:1024,identity:'M15'};
 new EnemyPainter(ctx,{enemies:{B16:queenImage,M15:guardImage}}).unit(w,clones[0],1);assert.ok(draws.some(args=>args[0]===queenImage));assert.equal(draws.some(args=>args[0]===guardImage),false);
 until(w,()=>w.enemyEvents.some(v=>v.type==='attackStarted'&&clones.some(t=>t.id===v.id)),5);
 // Re-enable the same natural plan before the first pair expires to exercise
 // the summon cap, rather than merely waiting for the usual long cooldown.
 e.ai.attack=null;e.ai.cooldowns.reflections=0;e.ai.sequence=2;e.ai.readyAt=w.time;e.ai.rangeStreak=0;e.ai.pursuitUntil=0;
 let secondCloneReleased=false;run(w,3,()=>{secondCloneReleased||=currentStep(e)?.type==='clone'&&e.ai.attack.fired;assert.ok(w.targets.filter(t=>t.owner===e.id&&t.mirage&&t.hp>0).length<=2);});assert.ok(secondCloneReleased,'a second clone release must actually exercise the cap');
 for(const t of clones)assert.ok(Math.abs(t.expires-t.bornAt-8)<1e-9);
 until(w,()=>clones.every(t=>t.hp<=0),8);assert.ok(clones.every(t=>w.time>=t.expires));
});

test('mirror summons disappear when their owner dies and player kills award no coins, XP or loot',()=>{
 const owned=arena('B16','reflections');const clones=until(owned.w,()=>{const t=owned.w.targets.filter(t=>t.owner===owned.e.id&&t.mirage);return t.length===2&&t;},6);
 damage(owned.w,owned.e,owned.e.hp+1,{source:'artifact',impact:false});step(owned.w,STEP);assert.ok(clones.every(t=>t.hp===0&&t.ai.attack===null));
 const loot=arena('B16','reflections',{campaign:true}),adds=until(loot.w,()=>{const t=loot.w.targets.filter(t=>t.owner===loot.e.id&&t.mirage);return t.length===2&&t;},6),before={coins:loot.profile.coins,xp:loot.profile.heroes.fire.exp,drops:loot.w.campaign.drops.length,kills:loot.w.campaign.rewardCount};
 for(const t of adds)damage(loot.w,t,t.hp+1,{source:'artifact',impact:false});stepCampaign(loot.w,STEP,{});
 assert.equal(loot.profile.coins,before.coins);assert.equal(loot.profile.heroes.fire.exp,before.xp);assert.equal(loot.w.campaign.drops.length,before.drops);assert.equal(loot.w.campaign.rewardCount,before.kills);
});

test('mirror teleport commits its warning before the player moves and follows only the selected support',()=>{
 const {w,e}=arena('B16','reflections');const a=until(w,()=>currentStep(e)?.type==='teleport'&&e.ai.attack,5),promised={...a.teleportAnchor};assert.ok(promised.platformId);
 Object.assign(w.player,{x:1200,prevX:1200});run(w,.1);assert.equal(a.teleportAnchor.x,promised.x);assert.equal(a.teleportAnchor.platformId,promised.platformId);
 const support=w.platforms.find(p=>p.id===promised.platformId);support.x+=35;support.y-=20;
 const moved=until(w,()=>w.enemyEvents.find(v=>v.type==='enemyTeleported'&&v.id===e.id),3);
 assert.ok(Math.abs(moved.x-(promised.x+35))<1e-9);assert.equal(moved.y,promised.y-20);assert.ok(Math.abs(moved.x-w.player.x)>300,'destination must not track the moved player');
});

test('all twenty boss bodies grow ten percent relative to campaign17 without increasing attack range or damage again',()=>{
 const ids=ENEMY_IDS.filter(id=>ENEMIES[id].boss);assert.equal(ids.length,20);
 // Published root HEAD 8992234 uses .72 body scale, .8*1.2 independent reach,
 // and the same two historical damage factors. This fixture is the old result.
 const baselineScale=.72,baselineReach=.8*1.2,baselineDamage=1.07*1.10;
 for(const id of ids){const w=createWorld(),d=ENEMIES[id];w.targets=[];w.platforms=w.platforms.filter(p=>p.id==='ground');const now=spawnEnemy(w,id,{x:900,y:w.floor}),before=spawnEnemy(w,id,{x:700,y:w.floor,scale:baselineScale});
  assert.ok(Math.abs(now.w/before.w-1.1)<1e-10,id+' collision width');assert.ok(Math.abs(now.h/before.h-1.1)<1e-10,id+' collision height');assert.ok(Math.abs(now.visual/before.visual-1.1)<1e-10,id+' visible body');
  assert.equal(now.attackScale,baselineReach,id+' independent reach');assert.equal(enemyDamageFactor(now),baselineDamage,id+' independent damage');
  const melee=d.patterns.flatMap(p=>p.steps).find(s=>s.reach);if(melee)assert.equal(enemyMeleeReach(w,now,melee),enemyMeleeReach(w,before,melee),id+' real reach unchanged');
  const pattern=d.patterns.find(p=>p.kind==='melee');if(pattern){const results=[];for(const scale of [undefined,baselineScale]){const duel=arena(id,pattern.id,{x:500,bossX:600});if(scale!==undefined){duel.w.targets=[];duel.e=spawnEnemy(duel.w,id,{x:600,y:duel.w.floor,scale});duel.e.ai.nextPassive=Infinity;for(const p of d.patterns)if(p.id!==pattern.id)duel.e.ai.cooldowns[p.id]=Infinity;}until(duel.w,()=>duel.w.player.hp<1e6,10);results.push(1e6-duel.w.player.hp);}assert.equal(results[0],results[1],id+' actual first melee damage unchanged');}

 }
 assert.equal(BOSS_TUNING.frequency,1.2);assert.equal(ENEMY_DAMAGE.boss,baselineDamage);
 for(const stageId of [1,12,21,22]){const w=createCampaign('fire',stageId,{seed:46,random:()=>.5});w.campaign.encounter=3;assert.ok(beginEncounter(w));const bosses=w.targets.filter(t=>ENEMIES[t.enemyKind]?.boss);assert.equal(bosses.length,stageId===22?2:1);
  for(const e of bosses){const d=ENEMIES[e.enemyKind];assert.ok(Math.abs(e.visual/(d.visual*baselineScale*1.1)-1.1)<1e-10,'shared current growth with existing solo 1.1 multiplier');assert.equal(e.attackScale,baselineReach*1.3);assert.equal(enemyDamageFactor(e),w.campaign.stage.bossDamageFactor*baselineDamage);}
 }
});
