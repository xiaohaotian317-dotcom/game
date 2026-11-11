import test from 'node:test';
import assert from 'node:assert/strict';
import {PET_IDS,PET_BASE,PET_SKILLS,petStats,normalizePets,petSkillLevel,petSkillPower,petSkillBonuses,petSkillStoneCount,petSkillUpgradeRecipe,petSkillUpgradeCost,upgradePetSkill} from '../dist/src/campaign-pet-data.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {createCampaign} from '../dist/src/campaign-simulation.mjs';
import {stepCompanion} from '../dist/src/campaign-companion.mjs';
import {petPanel} from '../dist/src/campaign-pet-ui.mjs';

const record=(kind='mossdeer',ranks=[0,0,0])=>({id:'pet-t61',kind,form:2,exp:2000,traits:{hp:1,mp:1,attack:1},skillRanks:[...ranks]});
const profile=(kind='mossdeer')=>({coins:1e6,bag:[{id:'stones',type:'petSkillStone',count:8}],pets:[record(kind)]});
test('each of the twelve pet skills has five levels and uses coins, then one/two/five skill stones',()=>{
 for(const kind of PET_IDS)for(let i=0;i<3;i++){
  const p=profile(kind),pet=p.pets[0];let spent=0;
  for(const [rank,stoneCount] of [0,1,2,5].entries()){
   const recipe=petSkillUpgradeRecipe(pet,i),coins=p.coins,before=petSkillStoneCount(p);
   assert.equal(recipe.stoneCount,stoneCount);assert.equal(recipe.level,rank+1);assert.equal(recipe.nextLevel,rank+2);
   assert.equal(petSkillUpgradeCost(pet,i),recipe.coins);upgradePetSkill(p,pet.id,i);
   assert.equal(p.coins,coins-recipe.coins);assert.equal(petSkillStoneCount(p),before-stoneCount);assert.equal(petSkillLevel(pet,i),rank+2);spent+=stoneCount;
  }
  assert.equal(spent,8);assert.equal(petSkillStoneCount(p),0);assert.equal(petSkillUpgradeRecipe(pet,i),null);assert.throws(()=>upgradePetSkill(p,pet.id,i),/满级/);
 }
});
test('insufficient coins, insufficient stones, wrong pet, fractional skill and locked form leave the whole inventory unchanged',()=>{
 for(const mutate of [p=>p.coins=0,p=>{p.pets[0].skillRanks[0]=1;p.bag[0].count=0;},p=>p.pets[0].form=0]){
  const p=profile();mutate(p);const before=structuredClone(p),index=p.pets[0].form===0?1:0;
  assert.throws(()=>upgradePetSkill(p,'pet-t61',index));assert.deepEqual(p,before);
 }
 const p=profile(),before=structuredClone(p);
 for(const [id,index] of [['wrong',0],['pet-t61',.5],['pet-t61',NaN],['pet-t61',-1],['pet-t61',3]]){assert.throws(()=>upgradePetSkill(p,id,index));assert.deepEqual(p,before);}
});
test('skill stones can be consumed across stacks without spending unrelated materials',()=>{
 const p=profile();p.pets[0].skillRanks=[3,0,0];p.bag=[{id:'a',type:'petSkillStone',count:2},{id:'b',type:'stoneSmall',count:9},{id:'c',type:'petSkillStone',count:4}];
 upgradePetSkill(p,'pet-t61',0);assert.equal(petSkillStoneCount(p),1);assert.deepEqual(p.bag,[{id:'b',type:'stoneSmall',count:9},{id:'c',type:'petSkillStone',count:1}]);
});
test('new pets keep original base strength, while purchased skill levels add HP and basic attack and steepen skill effects',()=>{
 for(const kind of PET_IDS){
  const fresh={...record(kind),form:0,exp:0},initial=petStats(fresh);
  assert.equal(initial.maxHp,PET_BASE[kind].hp);assert.equal(initial.maxMp,PET_BASE[kind].mp);assert.equal(initial.damage,PET_BASE[kind].damage);
  const base=petStats(record(kind)),grown=petStats(record(kind,[4,4,4]));
  assert(Math.abs(grown.maxHp-base.maxHp*1.48)<=1);assert(grown.damage>=base.damage*1.25);assert.equal(grown.maxMp,base.maxMp);
  assert.deepEqual(petSkillBonuses(record(kind,[4,4,4])),{healthRatio:.48,attackRatio:.30000000000000004});
  assert.deepEqual([0,1,2,3,4].map(rank=>petSkillPower(record(kind,[rank,0,0]),0)),[1,1.25,1.65,2.15,2.8]);
 }
});
test('old fifth enhancement remains stored and gains new maximum-level strength without changing XP, traits or saved vitals',()=>{
 const old={...record('dawnlion',[5,5,5]),vitals:{hp:31,mp:12,epoch:2}},saved=normalizePets([old])[0];
 assert.deepEqual(saved.skillRanks,[5,5,5]);assert.equal(saved.exp,old.exp);assert.deepEqual(saved.traits,old.traits);assert.deepEqual(saved.vitals,old.vitals);
 for(let i=0;i<3;i++){assert.equal(petSkillLevel(saved,i),5);assert.equal(petSkillPower(saved,i),2.8);assert(petSkillPower(saved,i)>1+old.skillRanks[i]*.12);assert.equal(petSkillUpgradeRecipe(saved,i),null);}
 assert.deepEqual(petStats(saved),petStats({...saved,skillRanks:[4,4,4]}));
});
function combat(kind,rank,index=0){
 const p=freshSolo(),pet=record(kind,[0,0,0]);pet.skillRanks[index]=rank;p.pets=[pet];p.activePetId=pet.id;
 const w=createCampaign('fire',1,{profile:p});w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.campaign.state='wave';
 const f=w.companion,target={id:'test-target',enemyKind:'M06',x:f.x+50,y:w.floor,h:110,w:20,hp:1e5,maxHp:1e5};w.targets=[target];
 f.attackAt=.001;f.pendingSkill=index;f.targetId=target.id;w.time=.1;const hits=[];
 const api={physics(){},damage(_w,t,n){hits.push(n);t.hp-=n;}};
 return {w,f,pet,target,hits,api};
}
test('real claw and projectile hits use the new skill multiplier and pet basic-attack stat, without borrowing hero damage',()=>{
 for(const kind of PET_IDS){
  const c=combat(kind,4);const before=c.f.mp;stepCompanion(c.w,.01,c.api);
  if(c.f.shots.length){c.f.shots[0].x=c.target.x;c.f.shots[0].y=c.target.y-45;c.w.time+=.02;stepCompanion(c.w,.02,c.api);}
  assert(c.hits.length>0,kind);assert.equal(c.hits[0],Math.round(petStats(c.pet).damage*PET_SKILLS[kind][0].power*2.8));assert(c.f.mp<before);
 }
});
test('the healing skill uses the same upgraded effect curve and remains capped at real maximum health',()=>{
 const c=combat('mossdeer',4,1);c.w.player.hp=1;c.f.hp=1;const hp=c.w.player.hp;
 stepCompanion(c.w,.01,c.api);assert(Math.abs(c.w.player.hp-(hp+c.w.player.maxHp*.08*2.8))<1e-9);assert(c.f.hp>c.f.maxHp*.12*2.8);
 c.f.attackAt=c.w.time-.001;c.f.mp=c.f.maxMp;c.w.player.hp=c.w.player.maxHp-1;c.f.hp=c.f.maxHp-1;stepCompanion(c.w,.01,c.api);
 assert.equal(c.w.player.hp,c.w.player.maxHp);assert.equal(c.f.hp,c.f.maxHp);
});
test('pet panel shows five skill levels, material cost and current upgraded HP/attack',()=>{
 const p=profile();p.pets[0].skillRanks=[1,0,0];const markup=petPanel({getWorld:()=>null},p),stats=petStats(p.pets[0]);
 assert.match(markup,/荆棘灵籽 · Lv\.2 \/ 5/);assert.match(markup,/技能石×1（持有8）/);assert.match(markup,/升至 Lv\.3/);assert.match(markup,new RegExp('攻击力</dt><dd>'+stats.damage));assert.doesNotMatch(markup,/\+1\/5/);
});
