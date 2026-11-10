import test from 'node:test';
import assert from 'node:assert/strict';
import {ALL_STAGES,CAMPAIGN_STAGES,CHALLENGE_STAGES,CHAPTERS,STAGES,STAGE_BY_ID,TUTORIAL_STAGE,completeStage,stageUnlocked,waveComposition} from '../dist/src/campaign-data.mjs';
import {CAMPAIGN_WIDTH,createCampaign,stepCampaign,beginEncounter,addCampaignHazard,fitCampaignCamera} from '../dist/src/campaign-simulation.mjs';
import {STEP,damage} from '../dist/src/simulation.mjs?v=20261031-enemies1';
import {freshSolo,normalizeSolo} from '../dist/src/campaign-profile.mjs';
import {updateCamera} from '../dist/src/camera.mjs?v=20261030-duel12';

function run(w,seconds,input={}){for(let i=0;i<Math.ceil(seconds/STEP);i++){stepCampaign(w,STEP,input);updateCamera(w,STEP);w.events=[];}}
function clear(w){for(const e of w.targets.filter(t=>t.hp>0))damage(w,e,10000);run(w,STEP);}
// These wave-only fixtures start after the separately tested actual control lessons.
function ready(w){w.campaign.training.step='complete';return w;}
function enterWave(w){w.player.x=w.campaign.triggers[w.campaign.encounter];updateCamera(w,1);run(w,STEP);assert.equal(w.campaign.state,'wave');run(w,2);}

test('tutorial 23 is independent from the twenty story stages and both challenges',()=>{
 assert.equal(TUTORIAL_STAGE.id,23);assert.equal(TUTORIAL_STAGE.mode,'tutorial');assert.equal(TUTORIAL_STAGE.name,'启程试炼');
 assert.equal(STAGE_BY_ID[23],TUTORIAL_STAGE);assert.equal(ALL_STAGES.length,23);assert.equal(STAGES.length,11);assert.equal(CAMPAIGN_STAGES.length,20);assert.deepEqual(CAMPAIGN_STAGES.map(s=>s.id),Array.from({length:20},(_,i)=>i+1));assert.deepEqual(CHALLENGE_STAGES.map(s=>s.id),[21,22]);
 assert.equal(TUTORIAL_STAGE.art,STAGES[0].art);assert.equal(TUTORIAL_STAGE.artStageId,1);assert.equal(TUTORIAL_STAGE.boss,null);assert.equal(TUTORIAL_STAGE.ranged,null);assert.equal(stageUnlocked(TUTORIAL_STAGE,null),true);
 const progress=completeStage(null,23);assert.deepEqual(progress.cleared,[23]);assert.equal(stageUnlocked(STAGE_BY_ID[1],progress),true);assert.equal(stageUnlocked(STAGE_BY_ID[2],progress),false);assert.equal(stageUnlocked(STAGE_BY_ID[12],progress),false);assert.equal(stageUnlocked(STAGE_BY_ID[21],progress),false);assert.equal(stageUnlocked(STAGE_BY_ID[22],progress),false);assert.equal(CHAPTERS[1].requires.every(id=>progress.cleared.includes(id)),false);assert.deepEqual(normalizeSolo({...freshSolo(),cleared:[23]}).cleared,[23]);
 for(let wave=1;wave<=2;wave++){const mix=waveComposition(TUTORIAL_STAGE,wave);assert.equal(mix.total,3);assert.equal(mix.ranged,0);assert.equal(mix.sides.reduce((a,b)=>a+b,0),3);}
});

test('two small tutorial waves must fully clear before the portal, and cannot generate a boss or extra wave',()=>{
 const w=ready(createCampaign('fire',23,{seed:4})),c=w.campaign;
 w.player.x=c.triggers[0];updateCamera(w,1);run(w,STEP);assert.equal(c.encounter,1);assert.equal(c.queue.length,3);assert.equal(beginEncounter(w),false);
 run(w,.2);assert.equal(w.targets.length,0);assert.equal(c.state,'wave','pending falling spawns keep the encounter locked');run(w,2);
 assert.equal(c.spawned.length,3);assert.ok(c.spawned.every(e=>e.kind==='M06'&&e.role==='melee'&&e.platformId==='ground'));assert.ok(w.targets.every(e=>e.maxHp===12&&!e.fallingSpawn));
 const living=w.targets.filter(e=>e.hp>0);for(const e of living.slice(0,2))damage(w,e,10000);run(w,STEP);assert.equal(c.state,'wave');assert.equal(c.portal,null);damage(w,living[2],10000);run(w,STEP);assert.equal(c.state,'travel');assert.equal(c.portal,null);
 enterWave(w);assert.equal(c.encounter,2);assert.equal(c.spawned.length,6);assert.ok(w.targets.filter(e=>e.hp>0).every(e=>e.maxHp===12));clear(w);
 assert.equal(c.state,'portal');assert.ok(c.portal);assert.equal(c.cleared,false);assert.equal(c.bossId,undefined);assert.ok(!w.targets.some(e=>e.enemyKind.startsWith('B')));assert.equal(beginEncounter(w),false);run(w,5);assert.equal(c.spawned.length,6);assert.equal(c.encounter,2);
 w.player.x=c.portal.x-100;run(w,STEP,{settle:true});assert.equal(c.state,'portal','distant settlement is rejected');w.player.x=c.portal.x;w.player.y=w.floor-150;run(w,STEP,{settle:true});assert.equal(c.state,'portal','the player must also be near the portal floor');w.player.y=w.floor;w.player.vy=0;run(w,STEP);assert.equal(c.state,'portal','touching the portal does not auto-settle');run(w,STEP,{settle:true});assert.equal(c.state,'complete');assert.equal(c.cleared,true);const time=w.time;run(w,5,{attack:true,settle:true});assert.equal(w.time,time);assert.equal(c.spawned.length,6);
 const retry=ready(createCampaign('fire',23,{seed:4}));enterWave(retry);clear(retry);enterWave(retry);clear(retry);assert.equal(retry.campaign.state,'portal');assert.equal(retry.campaign.spawned.length,6,'a replay is a fresh two-wave run, not an endless round');
});

test('tutorial uses real weak melee attacks and never creates environmental hazards',()=>{
 const w=ready(createCampaign('fire',23,{seed:7}));enterWave(w);assert.equal(addCampaignHazard(w,{kind:'lava',x:w.player.x}),null);assert.equal(w.campaign.hazards.length,0);
 const enemy=w.targets.find(e=>e.hp>0);w.player.x=enemy.x-45;w.player.y=w.floor;const initial=w.player.hp;run(w,10);
 assert.ok(w.player.hp<initial,'the minions remain real interactive attackers');assert.ok(initial-w.player.hp<=12,'tutorial attacks are low damage rather than story-stage damage');assert.ok(w.enemyEvents.some(e=>e.type==='attackStarted'));assert.ok(w.targets.every(e=>e.damageFactor===.08&&e.meleeOnly));assert.equal(w.campaign.hazards.length,0);assert.equal(w.enemyZones?.length||0,0);assert.ok(!w.targets.some(e=>e.enemyKind.startsWith('B')));
});

test('tutorial kills grant only one coin and five hero XP each, without first-clear loot or main-story progress',()=>{
 const profile=freshSolo(),bag=structuredClone(profile.bag),w=ready(createCampaign('fire',23,{profile,random:()=>1,seed:3}));
 enterWave(w);clear(w);enterWave(w);clear(w);assert.equal(profile.coins,306);assert.equal(profile.heroes.fire.exp,30);assert.equal(w.campaign.rewardCount,6);assert.equal(w.campaign.rewards.coins,6);assert.deepEqual(w.campaign.rewards.xp,{fire:30});assert.deepEqual(w.campaign.rewards.items,[]);assert.deepEqual(profile.bag,bag);assert.equal(profile.tickets,0);assert.deepEqual(profile.firstTickets,[]);assert.equal(profile.choiceClaimed,false);assert.deepEqual(profile.cleared,[]);assert.deepEqual(w.campaign.drops,[]);
 w.player.x=w.campaign.portal.x;w.player.y=w.floor;run(w,STEP,{settle:true});assert.equal(w.campaign.state,'complete');assert.equal(profile.coins,306,'the one-time 500 reward belongs to the external settlement transaction');assert.deepEqual(profile.firstTickets,[]);assert.equal(profile.choiceClaimed,false);assert.deepEqual(profile.bag,bag);
});

test('short tutorial preserves walk/jump physics for all heroes and leaves story geometry untouched',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star']){
  const w=ready(createCampaign(hero,23,{seed:19}));assert.equal(w.width,3000);assert.ok(w.width<CAMPAIGN_WIDTH);assert.equal(w.platforms[0].w,w.width);assert.equal(w.platforms.filter(p=>p.type==='campaign-upper').length,2);assert.ok(w.platforms.every(p=>p.x>=0&&p.x+p.w<=w.width));assert.ok(w.platforms.filter(p=>p.type==='campaign-upper').every(p=>w.floor-p.y<=200));fitCampaignCamera(w,800,360);assert.ok(w.camera.viewWidth<=w.width);
  w.campaign.triggers=[1e8,2e8];run(w,STEP,{jump:true,move:1});run(w,.12,{move:1});assert.ok(w.player.y<w.floor,hero+' retains the normal first jump');assert.equal(w.player.jumps,1);run(w,STEP,{jump:true,move:1});assert.equal(w.player.jumps,2,hero+' retains the normal second jump');run(w,10,{move:1});assert.ok(w.player.x>w.width-200,hero+' can follow the continuous road without a forced jump');assert.equal(w.player.y,w.floor);
 }
 const story=createCampaign('fire',1,{seed:19});assert.equal(story.width,CAMPAIGN_WIDTH);assert.deepEqual(story.campaign.triggers,[1400,3600,5870,8420]);assert.equal(story.platforms.filter(p=>p.type==='campaign-upper').length,24);assert.equal(waveComposition(STAGE_BY_ID[1]).total,12);
});

test('all tutorial stepping platforms are reachable from their declared support with ordinary double jumps',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star'])for(const seed of [1,7,19,32]){
  const template=createCampaign(hero,23,{seed});
  for(const target of template.platforms.filter(p=>p.id!=='ground')){
   const source=template.platforms.find(p=>p.id===target.accessFrom);assert.ok(source,'the support chain remains rooted at the road');const w=ready(createCampaign(hero,23,{seed}));w.campaign.triggers=[1e8,2e8];const center=target.x+target.w/2,x=source.id==='ground'?center:Math.max(source.x+26,Math.min(source.x+source.w-26,center));Object.assign(w.player,{x,prevX:x,y:source.y,prevY:source.y,vx:0,vy:0,grounded:true,platformId:source.id,jumps:0});let reached=false;
   for(let frame=0;frame<260;frame++){const dx=center-w.player.x;stepCampaign(w,STEP,{jump:frame===0||frame===36,move:Math.abs(dx)>12?Math.sign(dx):0});if(frame>8&&w.player.grounded&&w.player.platformId===target.id){reached=true;break;}}
   assert.ok(reached,`${hero} seed ${seed} can reach ${target.id} without a spell or teleport`);
  }
 }
});
