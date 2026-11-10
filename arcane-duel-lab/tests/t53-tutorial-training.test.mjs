import test from 'node:test';import assert from 'node:assert/strict';
import {createCampaign,stepCampaign,beginEncounter} from '../dist/src/campaign-simulation.mjs';
import {STEP,damage} from '../dist/src/simulation.mjs';
import {freshSolo,normalizeSolo,loadSolo,saveSolo} from '../dist/src/campaign-profile.mjs';
import {tutorialRewardDraft} from '../dist/src/onboarding-state.mjs';
import {normalizeTutorialTraining,tutorialTrainingComplete,TUTORIAL_ENEMY_LEAD,TUTORIAL_ATTACK_DISTANCE} from '../dist/src/tutorial-training-state.mjs';
const run=(w,time,input={})=>{for(let n=0;n<Math.ceil(time/STEP);n++)stepCampaign(w,STEP,input);};
const pulse=(w,input)=>stepCampaign(w,STEP,input);
function until(w,predicate,input={},seconds=4){for(let n=0;n<seconds/STEP;n++){stepCampaign(w,STEP,input);if(predicate())return;}assert.fail('actual tutorial action did not complete: '+w.campaign.training.step);}
function motion(w){run(w,.38,{move:-1});assert.equal(w.campaign.training.left,true);run(w,.7,{move:1});assert.equal(w.campaign.training.step,'jump');pulse(w,{jump:true});assert.equal(w.campaign.training.step,'doubleJump');run(w,.15);pulse(w,{jump:true});assert.equal(w.campaign.training.step,'dash');until(w,()=>w.player.grounded);pulse(w,{dash:true,move:1});assert.equal(w.campaign.training.step,'approach');}
function approach(w){if(!w.campaign.encounter){until(w,()=>w.campaign.encounter===1,{move:1},8);assert.ok(w.campaign.queue[0].x-w.player.x>=TUTORIAL_ENEMY_LEAD-1,'first enemy is born well ahead of the player');}until(w,()=>w.campaign.training.step==='attack',{move:1},8);assert.equal(w.campaign.encounter,1);assert.ok(w.targets.some(e=>e.hp>0&&!e.fallingSpawn&&e.grounded&&Math.abs(e.x-w.player.x)<=TUTORIAL_ATTACK_DISTANCE));}
function basics(w){motion(w);approach(w);until(w,()=>w.campaign.training.step==='skill',{attack:true,aim:{x:w.player.x+250,y:w.floor-5}});pulse(w,{cast:'q',aim:{x:w.player.x+250,y:w.floor-5}});until(w,()=>tutorialTrainingComplete(w));}

test('training is separate from the first-run guide and never resets legacy ownership, economy or rewards',()=>{
 const raw=freshSolo();delete raw.onboarding;delete raw.tutorialTraining;raw.coins=1234;raw.owned.push('nature');raw.heroes.nature.exp=800;const profile=normalizeSolo(raw),before=structuredClone(profile);assert.equal(profile.onboarding.step,'done');const w=createCampaign('fire',23,{profile});assert.equal(w.campaign.training.step,'move');assert.equal(profile.coins,before.coins);assert.deepEqual(profile.owned,before.owned);assert.deepEqual(profile.bag,before.bag);assert.deepEqual(profile.heroes,before.heroes);assert.equal(profile.onboarding.step,'done');
});

test('movement teaching requires real left and right travel, blocks early combat and cannot be bypassed by waiting or moving to a trigger',()=>{
 const w=createCampaign('fire',23,{profile:freshSolo()}),mana=w.player.mp;run(w,15);assert.equal(w.campaign.encounter,0);assert.equal(w.targets.length,0);assert.equal(beginEncounter(w),false);
 pulse(w,{jump:true,dash:true,attack:true,cast:'q'});assert.equal(w.campaign.training.step,'move');assert.equal(w.player.mp,mana);assert.equal(w.player.cast,null);assert.equal(w.player.jumps,0);assert.equal(w.player.dash,0);assert.equal(w.campaign.queue.length,0);w.player.x=2000;run(w,.1);assert.equal(w.campaign.encounter,0);
 run(w,.4,{move:1});assert.equal(w.campaign.training.right,true);assert.equal(w.campaign.training.step,'move');run(w,.4,{move:-1});assert.equal(w.campaign.training.step,'jump');assert.equal(w.targets.length,0);
});

test('jump and double-jump lessons permit only jumping; dash permits only one successful dodge',()=>{
 const w=createCampaign('fire',23,{profile:freshSolo()}),mana=w.player.mp;run(w,.4,{move:-1});run(w,.7,{move:1});assert.equal(w.campaign.training.step,'jump');run(w,.5);const x=w.player.x;
 run(w,.3,{move:1,dash:true,attack:true,cast:'q'});assert.equal(w.campaign.training.step,'jump');assert.equal(w.player.x,x);assert.equal(w.player.dash,0);assert.equal(w.player.cast,null);assert.equal(w.player.mp,mana);
 pulse(w,{jump:true});assert.equal(w.campaign.training.step,'doubleJump');run(w,.1,{move:-1,dash:true,attack:true,cast:'q'});assert.equal(w.player.x,x);assert.equal(w.player.dash,0);assert.equal(w.player.mp,mana);assert.equal(w.player.cast,null);pulse(w,{jump:true});assert.equal(w.campaign.training.step,'dash');until(w,()=>w.player.grounded);run(w,.3,{move:1,jump:true,attack:true,cast:'q'});assert.equal(w.campaign.training.step,'dash');assert.equal(w.player.grounded,true);assert.equal(w.player.mp,mana);assert.equal(w.campaign.spawned.length,0);pulse(w,{dash:true});assert.equal(w.campaign.training.step,'approach');
});

test('walking approach spawns the first wave ahead; attack and skill lessons filter unrelated real inputs',()=>{
 const p=freshSolo(),w=createCampaign('fire',23,{profile:p}),mana=w.player.mp;motion(w);assert.equal(w.campaign.encounter,0);assert.equal(w.campaign.queue.length,0);assert.equal(w.player.mp,mana);run(w,.3,{jump:true,dash:true,attack:true,cast:'q'});assert.equal(w.campaign.training.step,'approach');assert.equal(w.player.mp,mana);assert.equal(w.player.cast,null);
 approach(w);assert.equal(w.campaign.queue.length,3);assert.ok(w.campaign.spawned.length>=1);const hp=w.player.hp,x=w.player.x;run(w,1,{move:1,jump:true,dash:true,cast:'q'});assert.equal(w.campaign.training.step,'attack');assert.equal(w.player.x,x);assert.equal(w.player.mp,mana);assert.equal(w.player.hp,hp);assert.equal(w.player.cast,null);
 until(w,()=>w.campaign.training.step==='skill',{attack:true,aim:{x:w.player.x+250,y:w.floor-5}});assert.ok(w.player.cast?.released);run(w,1,{move:-1,jump:true,dash:true,attack:true,cast:'e'});assert.equal(w.player.x,x);assert.equal(w.player.mp,mana);assert.equal(w.player.hp,hp);assert.equal(w.campaign.training.step,'skill');assert.ok(!w.player.cast||w.player.cast.key==='attack','a held attack cannot create a new cast during the F lesson');
 pulse(w,{cast:'q',aim:{x:w.player.x+250,y:w.floor-5}});assert.equal(w.campaign.training.step,'skill','button press is not a release');until(w,()=>tutorialTrainingComplete(w));assert.equal(p.tutorialTraining.step,'complete');assert.equal(w.player.mp,mana-9);assert.equal(p.heroes.fire.slots.e,null);assert.equal(p.heroes.fire.skills['fire-1-0'],undefined);assert.equal(p.coins,300);assert.equal(p.onboarding.tutorialRewardClaimed,false);
 const endX=w.player.x;run(w,.4,{move:1});assert.ok(w.player.x>endX+20);pulse(w,{jump:true});assert.ok(w.player.vy<0);run(w,.1);pulse(w,{jump:true});assert.equal(w.player.jumps,2);until(w,()=>w.player.grounded);until(w,()=>w.player.dash>0,{dash:true});assert.ok(w.player.dash>0);
});

test('failed or unavailable actions do not satisfy a lesson and successful action observations survive reload',()=>{
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},p=freshSolo(),w=createCampaign('fire',23,{profile:p});run(w,.4,{move:-1});run(w,.7,{move:1});pulse(w,{jump:true});assert.equal(p.tutorialTraining.step,'doubleJump');assert.ok(saveSolo(storage,p));const next=loadSolo(storage),resumed=createCampaign('fire',23,{profile:next});assert.equal(resumed.campaign.training.step,'doubleJump');assert.equal(resumed.campaign.encounter,0);pulse(resumed,{jump:true});assert.equal(resumed.campaign.training.step,'doubleJump');run(resumed,.1);pulse(resumed,{jump:true});assert.equal(resumed.campaign.training.step,'dash');until(resumed,()=>resumed.player.grounded);resumed.player.dashCooldown=100;pulse(resumed,{dash:true});assert.equal(resumed.campaign.training.step,'dash');resumed.player.dashCooldown=0;pulse(resumed,{dash:true});approach(resumed);until(resumed,()=>resumed.campaign.training.step==='skill',{attack:true});resumed.player.mp=0;pulse(resumed,{cast:'q'});run(resumed,1);assert.equal(resumed.campaign.training.step,'skill');assert.equal(resumed.player.mp,0);
});

test('saved combat lessons re-enter via a walking approach without repeating learned jumps or dash',()=>{
 for(const lesson of ['attack','skill']){const p=freshSolo();p.tutorialTraining={version:1,step:lesson,left:true,right:true};const w=createCampaign('fire',23,{profile:p});assert.equal(w.campaign.training.step,'approach');assert.equal(w.campaign.encounter,0);assert.equal(w.campaign.spawned.length,0);assert.equal(w.campaign.training.left,true);assert.equal(w.campaign.training.right,true);until(w,()=>w.campaign.training.step===lesson,{move:1},8);assert.ok(w.targets.some(e=>e.hp>0&&e.grounded));assert.equal(w.campaign.encounter,1);}
});

test('an already-cleared wave cannot settle until the skill lesson is really complete; the existing 500 reward remains once-only',()=>{
 const p=freshSolo(),w=createCampaign('fire',23,{profile:p});motion(w);approach(w);w.campaign.state='portal';w.campaign.portal={x:w.player.x,y:w.floor};w.player.dash=0;w.player.vx=0;pulse(w,{settle:true});assert.equal(w.campaign.state,'portal');until(w,()=>w.campaign.training.step==='skill',{attack:true});pulse(w,{cast:'q',aim:{x:w.player.x+80,y:w.floor-5}});until(w,()=>tutorialTrainingComplete(w));w.player.x=w.campaign.portal.x;w.player.y=w.floor;w.player.vy=0;pulse(w,{settle:true});assert.equal(w.campaign.state,'complete');const first=tutorialRewardDraft(p);assert.equal(first.coins,500);assert.equal(tutorialRewardDraft(first.profile).coins,0);
});

test('after all actual lessons the original two weak waves clear normally without a boss, and a saved completion resumes freely',()=>{
 const p=freshSolo(),w=createCampaign('fire',23,{profile:p,random:()=>1});basics(w);for(let n=0;n<4000&&w.campaign.state!=='portal';n++){for(const e of w.targets)if(e.hp>0)damage(w,e,10000,{impact:false});if(w.campaign.state==='travel')w.player.x=w.campaign.triggers[w.campaign.encounter];stepCampaign(w,STEP);}
 assert.equal(w.campaign.state,'portal');assert.equal(w.campaign.spawned.length,6);assert.equal(w.campaign.bossId,undefined);assert.equal(w.campaign.hazards.length,0);const replay=createCampaign('fire',23,{profile:normalizeSolo(p)});assert.equal(replay.campaign.training.step,'complete');until(replay,()=>replay.campaign.encounter===1,{move:1},8);
 const story=createCampaign('fire',1,{profile:freshSolo()});assert.equal(story.campaign.training,undefined);pulse(story,{cast:'q',aim:{x:400,y:story.floor-5}});assert.ok(story.player.cast);assert.equal(story.player.mp,story.player.maxMp-9);assert.deepEqual(normalizeTutorialTraining({step:'bad',left:'true'}),{version:2,step:'move',left:false,right:false});
});
