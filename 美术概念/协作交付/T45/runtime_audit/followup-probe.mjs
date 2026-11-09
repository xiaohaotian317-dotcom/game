import {readFileSync,writeFileSync} from 'node:fs';
import {loadCampaignArt} from '../../../../arcane-duel-lab/dist/src/campaign-painter.mjs';
import {STAGE_BY_ID} from '../../../../arcane-duel-lab/dist/src/campaign-data.mjs';
import {loadEnemyAssets} from '../../../../arcane-duel-lab/dist/src/enemy-painter.mjs';
import {ENEMIES} from '../../../../arcane-duel-lab/dist/src/enemy-roster.mjs';
import {preloadBossHud} from '../../../../arcane-duel-lab/dist/src/boss-hud-art.mjs';
import {createDuel,stepDuel,STEP} from '../../../../arcane-duel-lab/dist/src/duel-simulation.mjs';
import {freshSolo} from '../../../../arcane-duel-lab/dist/src/campaign-profile.mjs';
import {createCampaign} from '../../../../arcane-duel-lab/dist/src/campaign-simulation.mjs';
import {stepCompanion} from '../../../../arcane-duel-lab/dist/src/campaign-companion.mjs';
import {drawDawnlion} from '../../../../arcane-duel-lab/dist/src/dawnlion-art.mjs';
import {renderDuelWorld} from '../../../../arcane-duel-lab/dist/src/duel-visual-clock.mjs';
import {createWorld,step} from '../../../../arcane-duel-lab/dist/src/simulation.mjs';
import {placeEncounter} from '../../../../arcane-duel-lab/dist/src/enemy-simulation.mjs';

const base=new URL('../../../../arcane-duel-lab/dist/',import.meta.url),requests=[];
globalThis.fetch=async url=>({ok:true,json:async()=>JSON.parse(readFileSync(new URL(url,base)))});
globalThis.Image=class {set src(url){this.url=url;requests.push(url);queueMicrotask(()=>this.onload?.());} get src(){return this.url;} decode(){return Promise.resolve();}};
const result={measuredAt:new Date().toISOString(),campaignLoads:[]};
for(const id of [1,12])for(const team of [['fire'],['fire','star']]){const progress=[],before=requests.length,art=await loadCampaignArt(STAGE_BY_ID[id],(n,t)=>progress.push([n,t]),team);result.campaignLoads.push({id,team,lastProgress:progress.at(-1),progressCalls:progress.length,imageRequests:requests.length-before,allResourcesReported:progress.length===requests.length-before+11,refinedHeroes:team.filter(h=>!!art['refined-'+h]),refinedMetadata:!!art.refinedMeta});}
{
 const before=requests.length,assets={},progress=[];await loadEnemyAssets(Object.keys(ENEMIES),assets,(n,t)=>progress.push([n,t]));await Promise.all(Object.keys(ENEMIES).filter(id=>ENEMIES[id]?.boss).map(preloadBossHud));result.endlessBossHudRequests=[...new Set(requests.slice(before).filter(v=>v.includes('boss-hud')))];result.enemyLoadProgress=progress.at(-1);
}
{
 const match=createDuel(['star','fire']),[w,rival]=match.worlds,p=rival.player,from=p.x;
 w.portals=[{id:'audit',a:{x:p.x,y:p.y},b:{x:p.x-200,y:p.y},until:10}];stepDuel(match,STEP);
 result.opponentPortal={beforeX:from,afterX:p.x,playerHero:p.hero??null,duelHero:p.duelHero??null,effects:w.effects.filter(e=>e.kind==='heroMovement').map(e=>({hero:e.hero,arrival:e.arrival,x:e.x,y:e.y}))};
}
{
 const profile=freshSolo();profile.pets=[{id:'audit',kind:'dawnlion',form:0,exp:0,skillRanks:[0,0,0]}];profile.activePetId='audit';
 const w=createCampaign('fire',17,{profile}),f=w.companion;w.campaign.state='wave';w.time=5;f.attackAt=4.99;f.pendingSkill=0;f.targetId='audit-target';
 w.targets=[{id:'audit-target',enemyKind:'M01',x:f.x+30,y:f.y,w:25,h:100,hp:500,maxHp:500}];
 stepCompanion(w,STEP,{physics(){},damage(w,t,n){t.hp-=n;}});
 const meta=JSON.parse(readFileSync(new URL('assets/pets/dawnlion/pet-meta-v1.json',base))),a={dawnlion:{images:Object.fromEntries(Object.values(meta.motion).map(m=>[m.file,{}]))}},draws=[];
 const c=new Proxy({globalAlpha:1,drawImage(image,...args){draws.push(meta.motion[0].frames.findIndex(f=>JSON.stringify(f.spriteRect||f.rect)===JSON.stringify(args.slice(0,4))));}},{get(o,k){return k in o?o[k]:(()=>{});}});
 w.time=5.3;drawDawnlion(c,w,f,a);result.dawnlionRecovery={attackPoseUntil:f.attackPoseUntil,readyAt:f.readyAt,recoverUntil:f.recoverUntil??null,draws:[...draws]};
 draws.length=0;f.state='walk';f.walkPhase=.25;f.hit=.2;drawDawnlion(c,w,f,a);result.dawnlionWalkingHurt={hit:f.hit,draws};
}
{
 const source={time:1,fxTime:1,player:{cast:{age:.1},burst:{age:.2}},effects:[{age:.3}],constructs:[{age:.4}],projectiles:[]},render=renderDuelWorld(source,.03);result.visualClock={cast:render.player.cast.age,burst:render.player.burst.age,effect:render.effects[0].age,construct:render.constructs[0].age,sourceCastUnchanged:source.player.cast.age===.1};
}
{
 const w=createWorld('fire','moon');w.player.hp=w.player.maxHp=50000;Object.assign(w.player,{x:850,y:w.floor,prevX:850,prevY:w.floor,platformId:'ground'});const [e]=placeEncounter(w,['M11'],{x:1280,y:w.floor});for(let n=0;n<20/STEP;n++){step(w,STEP);w.events=[];}result.m11={sequence:e.ai.sequence,attacks:w.enemyEvents.filter(event=>event.type==='attackStarted'&&event.id===e.id).length,x:e.x,hpTaken:50000-w.player.hp};
}
writeFileSync(new URL('followup-verified-report.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
