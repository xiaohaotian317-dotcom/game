import {captureCampaignDefeat} from './campaign-ad-recovery.mjs';
import {towerFloor} from './tower-data.mjs';
import {initTutorialTraining,tutorialCombatReady,tutorialTrainingComplete,tutorialTrainingInput,tutorialActionSnapshot,observeTutorialTraining,TUTORIAL_ENEMY_LEAD} from './tutorial-training-state.mjs';
import {endlessRoster,normalizeChallenges} from './campaign-challenges.mjs';
import {soloActivity} from './campaign-growth-runtime.mjs';
import {initTeam,tickReserve,switchTeamHero,rescueWithReserve} from './campaign-team.mjs';
import {stepArtifact} from './campaign-artifact-runtime.mjs';
import {beginCompanionRun,spawnCompanion,hitCompanion} from './campaign-companion.mjs';
import {PET_STAGE,PET_DUNGEON,petDungeonUnlocked,markPetRest} from './campaign-pet-data.mjs';
import {spawnWildPet,stepPets} from './campaign-pets.mjs';
import {createWorld,step,hitPlayer,damage} from './simulation.mjs?v=20261031-enemies1';
import {soloTick,syncSoloStats,pickupSolo} from './campaign-growth-runtime.mjs';
import {spawnEnemy} from './enemy-simulation.mjs';
import {STAGE_BY_ID,waveComposition} from './campaign-data.mjs';
import {BOSS_TUNING} from './enemy-tuning.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const CAMPAIGN_FLOOR=760,CAMPAIGN_WIDTH=10120,CAMPAIGN_HEIGHT=960,CAMPAIGN_VIEW=1664;
export const SPAWN_RATE=.8;
import {campaignPlatforms} from './campaign-platforms.mjs';
export {campaignPlatforms} from './campaign-platforms.mjs';
export function createCampaign(hero='fire',id=1,{seed=(Date.now()^Math.floor(Math.random()*0x7fffffff))>>>0,profile=null,random=Math.random,petDungeon=false,team=null,tower=null}={}){
 const stage=STAGE_BY_ID[id];if(!stage)throw new Error('未知关卡');
 if(petDungeon&&(!PET_STAGE[id]||!profile||!petDungeonUnlocked(profile,id)))throw Error('需通关本关与第4关，才可进入宠物副本');
 if(profile&&!profile.owned.includes(hero))throw Error('该英雄尚未拥有');
 const activeStage=tower?towerFloor(tower.floor):stage.mode==='endless'?{...stage,...endlessRoster(1,random)}:petDungeon?{...stage,minionHp:Math.round(stage.minionHp*PET_DUNGEON.health),bossHp:Math.round(stage.bossHp*PET_DUNGEON.bossHealth),damageFactor:stage.damageFactor*PET_DUNGEON.damage,bossDamageFactor:stage.bossDamageFactor*PET_DUNGEON.damage,hazardDamage:Math.round(stage.hazardDamage*PET_DUNGEON.damage)}:stage;
 const tutorial=stage.mode==='tutorial';
 const w=createWorld(hero);w.width=tower?1900:tutorial?stage.mapWidth:CAMPAIGN_WIDTH;w.height=CAMPAIGN_HEIGHT;w.floor=CAMPAIGN_FLOOR;w.sceneId='campaign';w.targets=[];w.obstacles=[];w.mechanisms=null;w.mirror.enabled=false;w.spring.enabled=false;w.enemyMode=true;
 w.platforms=[{id:'ground',x:0,y:w.floor,w:w.width,type:'stone',active:true,hp:Infinity,maxHp:Infinity}];
 // Optional low stepping stones retain the same one-way platform physics; the road is flat.
 const platforms=campaignPlatforms(seed);w.platforms.push(...(tower?[{id:'tower-low-left',x:210,y:610,w:320,type:'campaign-upper',region:'combat',active:true,hp:Infinity,maxHp:Infinity},{id:'tower-high-left',x:540,y:455,w:290,type:'campaign-upper',region:'combat',active:true,hp:Infinity,maxHp:Infinity},{id:'tower-right',x:1180,y:575,w:340,type:'campaign-upper',region:'combat',active:true,hp:Infinity,maxHp:Infinity}]:tutorial?platforms.filter(p=>p.region==='travel'&&p.zone===0).map(p=>({...p,x:p.x+700})):platforms));
 Object.assign(w.player,{x:170,y:w.floor,prevX:170,prevY:w.floor,grounded:true,platformId:'ground'});w.spawn={x:170,y:w.floor};w.camera={x:0,y:0,viewWidth:CAMPAIGN_VIEW,viewHeight:960};w.aim={x:600,y:w.floor-60};
 w.campaign={stage:activeStage,mode:tower?'tower':stage.mode||'story',tower:tower?{id:tower.id,floor:activeStage.towerFloor,completed:false}:null,endless:stage.mode==='endless'?{round:1,completed:0}:null,petDungeon,seed,state:'travel',encounter:0,triggers:tutorial?[...stage.triggers]:[1400,3600,5870,8420],lock:null,queue:[],attackBudget:stage.attackBudget,notice:tutorial?'向右前进 · 熟悉移动与攻击':'向右前进 · 留意前方的动静',noticeUntil:4,hazards:[],nextHazard:tutorial?Infinity:3,portal:null,cleared:false,defeated:false,spawned:[],events:[],progression:profile,random,castSkills:{},soloFields:[],drops:[],rewardCount:0,recoveryDrops:0};if(tower){w.campaign.triggers=[0];w.campaign.attackBudget=activeStage.attackBudget;w.campaign.notice='第'+activeStage.towerFloor+'层 · '+'清理本层妖兽';}if(stage.mode==='endless')w.campaign.triggers=[450,450,450,450];if(profile){syncSoloStats(w,true);initTeam(w,team||[hero]);beginCompanionRun(w);spawnCompanion(w);if(tower?.vitals)for(const m of w.campaign.team){const v=tower.vitals[m.hero];if(v){m.player.hp=Math.min(m.player.maxHp,Math.max(0,v.hp));m.player.mp=Math.min(m.player.maxMp,Math.max(0,v.mp));}}}initTutorialTraining(w);return w;
}
function say(w,message){const c=w.campaign;c.notice=message;c.noticeUntil=w.time+3.5;c.events.push({time:w.time,message});}
export function fitCampaignCamera(w,width,height){const aspect=Math.max(.3,width/Math.max(1,height));w.camera.viewWidth=Math.min(CAMPAIGN_VIEW,CAMPAIGN_HEIGHT*aspect);w.camera.viewHeight=w.camera.viewWidth/aspect;w.camera.y=clamp(w.floor-w.camera.viewHeight*.8,0,Math.max(0,w.height-w.camera.viewHeight));if(w.campaign.lock){const lock=w.campaign.lock;lock.x=clamp(lock.x+(lock.width-w.camera.viewWidth)/2,0,w.width-w.camera.viewWidth);lock.width=w.camera.viewWidth;}}
export function beginEncounter(w){
 const c=w.campaign;if(c.mode==='tower')return beginTowerEncounter(w);if(!tutorialCombatReady(w)||c.state!=='travel'||c.encounter>=(c.mode==='tutorial'?c.stage.waveCount:4))return false;
 c.encounter++;const vw=w.camera.viewWidth||1200,x=clamp(w.camera.x||0,0,w.width-vw);c.lock={x,width:vw};c.state=c.encounter===4?'boss':'wave';c.queue=[];c.hazards=[];
 if(c.encounter===4){c.bossIds=[];const ids=c.stage.bosses||[c.stage.boss];for(const [i,id]of ids.entries()){const e=spawnEnemy(w,id,{x:x+vw*(ids.length>1?i?.82:.18:.74),y:w.floor,scale:BOSS_TUNING.scale*1.1});if(!e)throw new Error('首领生成失败');e.attackScale*=1.3;e.soloRange=1.3;e.hp=e.maxHp=c.stage.bossHp;e.damageFactor=c.stage.bossDamageFactor;e.attackTempo=c.mode==='endless'?Math.min(1.2,.9+c.endless.round*.02):c.mode==='twin'?1.12:.85+(c.stage.chapterIndex||c.stage.id)*.025;e.ai.readyAt=w.time+1.6+i*.4;c.bossIds.push(e.id);}c.bossId=c.bossIds[0];say(w,c.mode==='endless'?'轮回 '+c.endless.round+' · 首领降临':ids.length>1?'双王降临':'守关首领 · '+c.stage.name);}
 else{const mix=waveComposition(c.stage,c.encounter);for(let side=0;side<2;side++)for(let i=0;i<(mix.sides?.[side]??mix.perSide);i++){const ranged=i>=mix.melee,baseX=x+vw*(side?.8:.2),upper=w.platforms.filter(p=>p.type==='campaign-upper'&&p.region==='combat'&&p.x>=x+80&&p.x+p.w<x+vw-80).sort((a,b)=>Math.abs(a.x+a.w/2-baseX)-Math.abs(b.x+b.w/2-baseX))[0],onUpper=c.mode!=='tutorial'&&c.stage.id>=3&&upper&&(ranged||i%4===0);c.queue.push({kind:ranged?c.stage.ranged:c.stage.melee,role:ranged?'ranged':'melee',side,x:onUpper?clamp(baseX+(i%3-1)*35,upper.x+35,upper.x+upper.w-35):baseX+(i%3-1)*35,y:onUpper?upper.y:w.floor,platformId:onUpper?upper.id:'ground',at:w.time+(.65+Math.floor(i/3)*.4+(i%3)*.13)/SPAWN_RATE});}say(w,c.mode==='endless'?`轮回 ${c.endless.round} · 第 ${c.encounter} / 3 波`:`第 ${c.encounter} / ${c.mode==='tutorial'?c.stage.waveCount:3} 波`);}
 if(c.mode==='tutorial'){c.queue.forEach((spawn,index)=>{spawn.x=clamp(w.player.x+TUTORIAL_ENEMY_LEAD+index*90,x+80,Math.min(w.width-100,x+vw-80));spawn.side=1;});}
 c.nextHazard=c.stage.environmentHazards===false?Infinity:w.time+(c.stage.id<=2?5:3);return true;
}

function beginTowerEncounter(w){
 const c=w.campaign;if(c.state!=='travel'||c.encounter)return false;
 c.encounter=1;c.lock={x:clamp((w.player.x-380),0,w.width-(w.camera.viewWidth||1664)),width:w.camera.viewWidth||1664};c.state='wave';c.queue=[];const x=c.lock.x,vw=c.lock.width;
 for(let i=0;i<c.stage.towerCount;i++){const ranged=i>=Math.ceil(c.stage.towerCount*.7),side=i%2;c.queue.push({kind:ranged?c.stage.ranged:c.stage.melee,role:ranged?'ranged':'melee',side,x:x+vw*(side?.78:.28)+(Math.floor(i/2)-1)*55,y:w.floor,platformId:'ground',at:w.time+.9+Math.floor(i/2)*.42});}
 c.nextHazard=Infinity;return true;
}

function beginTowerBoss(w){
 const c=w.campaign,x=c.lock.x,vw=c.lock.width;
 const e=spawnEnemy(w,c.stage.boss,{x:x+vw*(w.player.x>x+vw*.5?.22:.78),y:w.floor,scale:BOSS_TUNING.scale*1.1});
 if(!e)throw Error('守层首领生成失败');
 e.hp=e.maxHp=c.stage.bossHp;e.damageFactor=c.stage.bossDamageFactor;e.attackScale*=1.3;e.soloRange=1.3;
 e.attackTempo=Math.min(1.3,.9+c.tower.floor*.008);e.ai.readyAt=w.time+1.5;
 c.bossIds=[e.id];c.bossId=e.id;c.encounter=2;c.state='boss';c.queue=[];
 say(w,'第'+c.tower.floor+'层 · 守层首领降临');
}

function spawnWave(w){const c=w.campaign;for(const s of c.queue.filter(s=>!s.done&&s.at<=w.time)){
 const e=spawnEnemy(w,s.kind,{x:s.x,y:s.y-1});if(!e)continue;
 s.done=true;e.hp=e.maxHp=c.stage.minionHp+(c.mode==='tutorial'?0:(c.encounter-1)*3);e.damageFactor=c.stage.damageFactor;e.meleeOnly=s.role==='melee';e.themeStyle=c.mode==='tutorial'?'stone':c.stage.chapter===2?undefined:c.stage.theme==='sand'?'rock':c.stage.theme;e.flankOffset=s.side?40:-40;e.campaignRole=s.role;
 e.fallingSpawn=true;e.y=s.y-125-(s.side?25:0);e.prevY=e.y;e.vy=35;e.grounded=false;e.platformId=null;e.ai.readyAt=Infinity;c.spawned.push({id:e.id,kind:e.enemyKind,role:s.role,side:s.side,x:e.x,y:e.y,landingY:s.y,platformId:s.platformId,wave:c.encounter});
}}
export function addCampaignHazard(w,{x,kind=w.campaign.stage.theme,delay=.95}={}){const c=w.campaign;if(c.stage.environmentHazards===false)return null;const xx=clamp(x??w.player.x,50,w.width-50),surface=w.platforms.filter(p=>p.active&&xx>=p.x&&xx<=p.x+p.w&&p.y>=w.player.y-2).sort((a,b)=>a.y-b.y)[0],h={id:++w.serial,x:xx,y:surface?.y??w.floor,kind,born:w.time,delay,fall:.32/BOSS_TUNING.fallSpeed,radius:kind==='lava'?61:38,damage:c.stage.hazardDamage,impacted:false,nextTick:0};c.hazards.push(h);return h;}
function hazards(w){const c=w.campaign,p=w.player;for(const h of c.hazards){const age=w.time-h.born;if(age<h.delay+h.fall)continue;
 if(!h.impacted){h.impacted=true;w.shake=Math.max(w.shake,4);w.events.push({type:'enemyAttack',enemyStyle:h.kind==='lava'?'lava':h.kind==='ice'?'ice':h.kind,heavy:true});if(Math.abs(p.x-h.x)<h.radius+p.w&&Math.abs(p.y-h.y)<85)hitPlayer(w,h.damage,h.x);if(w.companion?.hp>0&&Math.abs(w.companion.x-h.x)<h.radius+w.companion.w&&Math.abs(w.companion.y-h.y)<85)hitCompanion(w,h.damage,h.x);h.nextTick=w.time+.75;}
 const life=h.kind==='lava'?5:h.kind==='venom'?3:.55;
 if((h.kind==='lava'||h.kind==='venom')&&age<h.delay+h.fall+life&&w.time>=h.nextTick){h.nextTick=w.time+.75;if(Math.abs(p.x-h.x)<h.radius+p.w&&Math.abs(p.y-h.y)<40){hitPlayer(w,Math.max(2,Math.round(h.damage*.45)),h.x,{dot:true,label:h.kind==='lava'?'岩浆':'毒池'});}if(w.companion?.hp>0&&Math.abs(w.companion.x-h.x)<h.radius+w.companion.w&&Math.abs(w.companion.y-h.y)<40)hitCompanion(w,Math.max(2,Math.round(h.damage*.45)),h.x);}
 }c.hazards=c.hazards.filter(h=>w.time-h.born<h.delay+h.fall+(h.kind==='lava'?5:h.kind==='venom'?3:.55));
}
function constrain(w){const c=w.campaign;if(!c.lock)return;const left=c.lock.x+32,right=c.lock.x+c.lock.width-32;for(const e of [w.player,...(w.companion?.hp>0?[w.companion]:[]),...w.targets.filter(e=>e.hp>0)]){const x=clamp(e.x,left+e.w,right-e.w);if(x!==e.x){e.x=x;e.prevX=x;e.vx=0;}}}
export function stepCampaign(w,dt,input={}){
 const c=w.campaign;if(c.state==='complete'||c.state==='defeat'||c.state==='tower-clear')return;
 if(c.mode==='endless'&&input.finishRun){c.state='complete';c.cleared=true;c.dirty=true;return;}
 input=tutorialTrainingInput(w,input);if(Number.isInteger(input.switchSlot))switchTeamHero(w,input.switchSlot);const trainingBefore=c.training?tutorialActionSnapshot(w):null;
 const previousTime=w.time;step(w,dt,input);if(trainingBefore)observeTutorialTraining(w,trainingBefore,input);tickReserve(w,w.time-previousTime);soloTick(w,dt,{damage});stepArtifact(w,dt,input,{damage});if(input.pickup)pickupSolo(w);constrain(w);
 if(w.player.hp<=0&&rescueWithReserve(w))return;
 if(w.player.hp<=0){captureCampaignDefeat(w);c.state='defeat';c.defeated=true;c.queue=[];say(w,'挑战失败 · 调整节奏，再试一次');return;}
 if(c.state==='pet'){stepPets(w,dt,{damage,hitPlayer},input);if(c.petOutcome){c.state='portal';c.portal={x:c.lock.x+c.lock.width*.76,y:w.floor,born:w.time};w.projectiles=w.projectiles.filter(p=>p.owner!=='enemy');}return;}
 if(c.state==='intermission'&&w.time>=c.nextRoundAt){c.stage={...STAGE_BY_ID[21],...endlessRoster(c.endless.round,c.random)};c.attackBudget=c.stage.attackBudget;c.encounter=0;c.bossLooted=false;w.targets=[];w.projectiles=[];w.enemyZones=[];w.enemyWaves=[];c.soloFields=[];c.state='travel';c.lock=null;c.triggers=[w.player.x,w.player.x,w.player.x,w.player.x];say(w,'轮回 '+c.endless.round+' · 敌势增强');}
 if(c.state==='travel'&&w.player.x>=c.triggers[c.encounter])beginEncounter(w);
 if(c.state==='wave'||c.state==='boss'){
  spawnWave(w);
  if(c.stage.environmentHazards!==false&&w.time>=c.nextHazard){addCampaignHazard(w,{x:w.player.x});c.nextHazard=w.time+(c.stage.id<=2?7:c.mode?5:Math.max(3.2,6-(c.stage.chapterIndex||c.stage.id)*.2));}
  hazards(w);
  const bossDown=c.state==='boss'&&!w.targets.some(e=>(c.bossIds||[c.bossId]).includes(e.id)&&e.hp>0);
  if(bossDown)for(const e of w.targets)if((e.enemyKind||e.egg)&&e.hp>0){e.hp=0;e.diedAt=w.time;e.deadUntil=Infinity;}
  const remaining=w.targets.filter(e=>(e.enemyKind||e.egg)&&e.hp>0);
  if(c.queue.every(s=>s.done)&&!remaining.length){
   c.hazards=[];w.enemyZones=[];w.enemyWaves=[];w.projectiles=w.projectiles.filter(p=>p.owner!=='enemy');
   if(c.mode==='tower'){if(c.state==='wave')beginTowerBoss(w);else{c.state='tower-clear';c.tower.completed=true;c.dirty=true;say(w,'第'+c.tower.floor+'层通过 · 选择继续或结束挑战');}}
   else if(c.encounter===4&&c.mode==='endless'){c.endless.completed++;c.endless.round++;c.state='intermission';c.nextRoundAt=w.time+3;const profile=c.progression;if(profile){profile.challenges={...normalizeChallenges(profile.challenges),endlessBest:Math.max(normalizeChallenges(profile.challenges).endlessBest,c.endless.completed)};c.dirty=true;}say(w,'第 '+c.endless.completed+' 轮完成 · 下一轮即将开始');}
   else if(c.mode==='tutorial'&&c.encounter===c.stage.waveCount){c.state='portal';c.portal={x:c.lock.x+c.lock.width*.76,y:w.floor,born:w.time};say(w,'演练完成 · 靠近传送门结算');}
   else if(c.encounter===4&&c.petDungeon){spawnWildPet(w);}
   else if(c.encounter===4){c.state='portal';c.portal={x:c.lock.x+c.lock.width*.76,y:w.floor,born:w.time};say(w,'首领已击败 · 走入传送门完成关卡');}
   else{c.state='travel';c.lock=null;if(c.mode==='endless')c.triggers[c.encounter]=w.player.x;say(w,c.mode==='endless'?'本波已清理 · 下一波即将到来':'第 '+c.encounter+' 波清理完成 · 继续向右前进');}
  }
 }else if(c.state==='portal'&&tutorialTrainingComplete(w)&&input.settle&&Math.abs(w.player.x-c.portal.x)<65&&w.player.y>w.floor-80){soloActivity(w,'clears');c.state='complete';c.cleared=true;c.dirty=true;if(c.progression&&!c.petDungeon)markPetRest(c.progression,c.stage.id);say(w,'秘境通关 · 新的道路已解锁');}
}


