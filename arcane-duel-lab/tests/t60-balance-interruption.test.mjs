import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,beginEncounter,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {freshSolo,addItem,normalizeSolo} from '../dist/src/campaign-profile.mjs';
import {SOLO_HEROES,SOLO_SKILLS,SOLO_BALANCE} from '../dist/src/campaign-growth-data.mjs';
import {STAGES,waveComposition} from '../dist/src/campaign-data.mjs';
import {createWorld,requestCast,step,hitPlayer,damage,STEP} from '../dist/src/simulation.mjs';
import {applyEnemyStatus,spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {spawnWildPet,stepPets,startCapture} from '../dist/src/campaign-pets.mjs';
import {PET_STAGE,petStats} from '../dist/src/campaign-pet-data.mjs';

function arena(hero='fire'){
 const profile=freshSolo();profile.owned=[...SOLO_HEROES];
 const w=createCampaign(hero,1,{profile,seed:7,random:()=>.99});
 w.platforms=w.platforms.filter(p=>p.id==='ground');w.targets=[];
 w.player.x=w.player.prevX=500;w.campaign.triggers=[1e8,2e8,3e8,4e8];return w;
}
test('36 solo skills refund precisely once when hurt before release; no ghost effects or mana loss',()=>{
 for(const hero of SOLO_HEROES)for(const s of SOLO_SKILLS[hero]){
  const w=arena(hero),p=w.player,h=w.campaign.progression.heroes[hero];
  h.skills[s.id]=0;h.slots[s.key]=s.id;
  const mp=p.mp;assert(requestCast(w,s.key,750,w.floor-1),s.id);assert.equal(p.mp,mp-s.mana);
  const canceled=p.cast;assert(hitPlayer(w,1,300));assert.equal(p.cast,null);assert.equal(p.mp,mp,s.id);assert.equal(p.cooldowns[s.key],0);
  p.invuln=0;hitPlayer(w,1,300);assert.equal(p.mp,mp,'no second refund');
  for(let i=0;i<100;i++)step(w,STEP);
  assert(!w.projectiles.some(v=>v.castId===canceled.id),s.id+' must not fire after cancellation');
 }
});
test('already released skills keep their cost; poison ticks do not interrupt living players',()=>{
 const w=arena(),p=w.player,h=w.campaign.progression.heroes.fire,s=SOLO_SKILLS.fire.find(s=>s.key==='e'&&!s.column);h.skills[s.id]=0;h.slots.e=s.id;
 const mp=p.mp;assert(requestCast(w,'e',800,w.floor-60));while(!p.cast.released)step(w,STEP);
 assert(w.projectiles.some(s=>s.kind==='emberOrb'));hitPlayer(w,1,300);assert.equal(p.mp,mp-s.mana);
 const v=arena();assert(requestCast(v,'q',750,v.floor-1));const cast=v.player.cast;hitPlayer(v,1,300,{dot:true});assert.equal(v.player.cast,cast);assert.equal(v.player.mp,v.player.maxMp-9);
});
test('freeze/petrify interrupt a pending solo skill fairly, while practice and basic attacks gain no mana',()=>{
 for(const kind of ['freeze','petrify']){
  const w=arena();requestCast(w,'q',700,w.floor-1);applyEnemyStatus(w,kind,'fixture',{effect(){}});
  assert.equal(w.player.mp,w.player.maxMp);assert.equal(w.player.cast,null);assert.equal(w.player.cooldowns.q,0);
 }
 const w=createWorld('fire');requestCast(w,'q',700,w.floor-1);const buffer=w.player.buffer={key:'q',until:2,x:700,y:w.floor-1};hitPlayer(w,1,100);assert.equal(w.player.mp,undefined);assert.equal(w.player.buffer,buffer,'public buffered input keeps its existing rule');
 const v=arena();v.player.mp=10;requestCast(v,'attack',700,v.floor-60);hitPlayer(v,1,100);assert.equal(v.player.mp,10);
});
test('only first two story stages soften and spawn three on each side; later stages retain the final curve',()=>{
 const oldHp=[30,41,53,65,82,97,113,132,154,176,198],oldBoss=[418,600,820,1100,1450,1850,2350,3000,3800,4700,5800],oldDamage=[.8,.97,1.12,1.3,1.5,1.7,1.95,2.2,2.5,2.8,3.05],oldBossDamage=[.98,1.1,1.26,1.5,1.8,2.15,2.6,3.1,3.7,4.5,5.4];
 for(const [i,s] of STAGES.entries()){
  const factor=i<2?.9:1;assert.equal(s.minionHp,Math.round(oldHp[i]*factor));assert.equal(s.bossHp,Math.round(oldBoss[i]*factor));
  assert.equal(s.damageFactor,oldDamage[i]*factor);assert.equal(s.bossDamageFactor,oldBossDamage[i]*factor);
  for(let wave=1;wave<=3;wave++){
   const m=waveComposition(s,wave);assert.equal(m.perSide,i<2?3:Math.min(10,s.perSide+(wave===3?1:0)));
   if(i<2){assert.equal(m.melee,2);assert.equal(m.ranged,1);}
  }
 }
 for(const id of [1,2]){const w=createCampaign('fire',id);beginEncounter(w);assert.equal(w.campaign.queue.length,6);assert.equal(w.campaign.queue.filter(s=>s.role==='melee').length,4);}
});
test('recovery drop boundary rises another relative fifteen percent, stays capped at two per run',()=>{
 assert(Math.abs(SOLO_BALANCE.recoveryDropChance-.0462875)<1e-12);
 for(const [roll,count] of [[.045,2],[.047,0]]){
  const w=arena();w.campaign.random=()=>roll;
  for(let i=0;i<4;i++){const e=spawnEnemy(w,'M06',{x:700});e.hp=1;damage(w,e,10000,{source:'artifact'});stepCampaign(w,STEP);}
  assert.equal(w.campaign.drops.filter(d=>d.recovery).length,count);
 }
});
test('all four wild pets have thirty percent less HP and real melee/projectile damage, without weakening captured pets',()=>{
 for(const id of [5,9,14,17]){
  const profile=freshSolo();profile.cleared=[4,id];addItem(profile,{type:'mirror'});profile.mirrorEquipped=true;
  const w=createCampaign('fire',id,{profile,petDungeon:true,random:()=>0});w.campaign.lock={x:0,width:1664};
  const e=spawnWildPet(w),old=structuredClone(profile),base=Math.round(28+id*3.5);
  assert.equal(e.maxHp,Math.round(Math.round(w.campaign.stage.bossHp*.38)*.7));
  w.time=3;e.x=w.player.x+50;e.attackAt=2;e.sequence=1;const hits=[];
  stepPets(w,STEP,{damage,hitPlayer:(_w,n)=>hits.push(n)});assert.deepEqual(hits,[Math.round(base*.7)]);
  e.attackAt=2;e.sequence=3;stepPets(w,STEP,{damage,hitPlayer(){}});assert.equal(w.projectiles.length,3);assert(w.projectiles.every(p=>p.damage===Math.round(Math.round(base*.7)*.7)));
  e.hp=1;assert(startCapture(w));w.time+=2;stepPets(w,STEP,{damage,hitPlayer(){}});
  assert.equal(w.campaign.petOutcome,'captured');const record=profile.pets[0];assert.equal(record.kind,PET_STAGE[id]);
  assert.deepEqual(petStats(record),petStats({...record,traits:{hp:.92,mp:.92,attack:.92}}));
  assert.equal(normalizeSolo(profile).pets[0].traits.hp,.92);assert.equal(old.heroes.fire.exp,profile.heroes.fire.exp);
 }
});
