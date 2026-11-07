import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,normalizeSolo,heroStats,grantXP} from '../dist/src/campaign-profile.mjs';
import {SOLO_HEROES,SOLO_SKILLS,BASE_STATS,xpNeeded} from '../dist/src/campaign-growth-data.mjs';
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {soloPay,soloSpec,syncSoloStats} from '../dist/src/campaign-growth-runtime.mjs';
import {createWorld,STEP,HEROES} from '../dist/src/simulation.mjs';
const totalXP=level=>Array.from({length:level-1},(_,i)=>xpNeeded(i+1)).reduce((a,b)=>a+b,0);

test('existing hero XP gains stronger linear health and mana with a solo-only current solo health, mana and attack multipliers',()=>{
 const p=freshSolo();p.owned=[...SOLO_HEROES];
 for(const hero of SOLO_HEROES){const [hp,mp]=BASE_STATS[hero];
  for(const level of [1,2,5,10,20]){p.heroes[hero].exp=totalXP(level);const s=heroStats(normalizeSolo(p),hero);
   assert.equal(s.level,level);assert.equal(s.maxHp,Math.round(hp*(1+.05*(level-1))*1.15*.9));assert.equal(s.maxMp,Math.round(Math.round(mp*(1+.04*(level-1)))*1.05));assert.equal(s.attack,Math.round(10*(1+.02*(level-1))*1.2));
  }
 }
 assert.equal(createWorld('fire').player.maxHp,180);
});

test('all 36 solo skills pay integer mana from the common skill data, reject insufficient mana atomically and keep recasts free',()=>{
 const p=freshSolo();p.owned=[...SOLO_HEROES];
 for(const hero of SOLO_HEROES)for(const skill of SOLO_SKILLS[hero]){
  p.heroes[hero].skills[skill.id]=0;p.heroes[hero].slots[skill.key]=skill.id;
  const w=createCampaign(hero,1,{profile:p}),spec=soloSpec(w,skill.key,HEROES[hero].skills[skill.key]);
  const cost=[9,15,28][skill.row];assert.equal(skill.mana,cost);assert.equal(spec.soloSkill.id,skill.id);
  w.player.mp=cost-.01;assert.equal(soloPay(w,skill.key,false,spec),false);assert.equal(w.player.mp,cost-.01);
  w.player.mp=cost;assert.equal(soloPay(w,skill.key,false,spec),true);assert.equal(w.player.mp,0);
  assert.equal(soloPay(w,skill.key,true,spec),true);assert.equal(w.player.mp,0);
 }
});

test('learned mana passive restores its increased real amount while level zero and reserve heroes stay unchanged',()=>{
 for(const [rank,rate]of [[0,0],[1,.25],[2,.5],[3,.8],[4,1.2],[5,1.8]]){
  const p=freshSolo();p.owned=['fire','nature'];p.passives.mana=rank;
  const w=createCampaign('fire',1,{profile:normalizeSolo(p),team:['fire','nature']});w.campaign.triggers=[1e8,2e8,3e8,4e8];
  w.player.mp=10;w.campaign.team[1].player.mp=10;
  for(let i=0;i<480;i++)stepCampaign(w,STEP);
  assert.ok(Math.abs(w.player.mp-(10+rate*4))<1e-8);assert.equal(w.campaign.team[1].player.mp,10);
 }
});

test('level-up adds only the increased capacity difference instead of refilling all lost health and mana',()=>{
 const p=freshSolo(),w=createCampaign('fire',1,{profile:p});w.player.hp=50;w.player.mp=10;
 grantXP(p,'fire',80);syncSoloStats(w);
 assert.equal(w.player.maxHp,130);assert.equal(w.player.maxMp,71);assert.equal(w.player.hp,56);assert.equal(w.player.mp,13);
});
