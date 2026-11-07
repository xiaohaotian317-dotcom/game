// Read-only runtime audit: source/assets/saves are never written.
// Run from arcane-duel-lab with the bundled Node runtime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createCampaign,beginEncounter,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {ENEMIES} from '../dist/src/enemy-roster.mjs';
import {enemyMeleeReady,enemyMeleeReach} from '../dist/src/enemy-simulation.mjs';
import {STEP} from '../dist/src/simulation.mjs';
import {STAGES} from '../dist/src/campaign-data.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'validation/campaign17-boss-audit.json');
const sourceNames=['enemy-simulation.mjs','enemy-roster.mjs','enemy-tuning.mjs','simulation.mjs','campaign-simulation.mjs','campaign-data.mjs','combat-numbers.mjs'];
const sourceHashes=()=>Object.fromEntries(sourceNames.map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'dist/src',name))).digest('hex')]));
const beforeHashes=sourceHashes();
const round=n=>Math.round(n*1000)/1000;
const duration=45,distances=[180,400,700],phases=[1,2],playerX=4800;
const bossIds=Object.keys(ENEMIES).filter(id=>ENEMIES[id].boss);
const allRuns=[];

function runCase(id,distance,phase){
 const stage=STAGES.find(s=>s.boss===id);
 // No profile means no persistent storage, equipment, pet, or passive regen.
 // beginEncounter still supplies the actual stage HP, range, damage and tempo.
 const w=createCampaign('fire',stage.id,{seed:42,random:()=>.99});
 w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];
 w.player.x=playerX;w.player.y=w.floor;w.camera.x=4500;
 w.campaign.encounter=3;beginEncounter(w);
 w.campaign.nextHazard=Infinity;w.campaign.hazards=[];
 const e=w.targets.find(t=>t.id===w.campaign.bossId),p=w.player;
 e.x=playerX+distance;e.prevX=e.x;
 if(phase===2)e.hp=Math.floor(e.maxHp*.49);
 const start={x:e.x,y:e.y,hp:e.hp,maxHp:e.maxHp,scale:e.scale,attackScale:e.attackScale,soloRange:e.soloRange,attackTempo:e.attackTempo,frequency:e.frequency,damageFactor:e.damageFactor};
 const hpLimit=1e6;let hp=hpLimit,inStep=false;
 p.maxHp=hpLimit;
 const damages=[],plans=[],steps=[],pursuits=[],waitingLinks=[],trace=[],errors=[];
 let activeRecord=null,activeAttack=null,stepRecord=null,lastStepKey=null,serial=0;
 let totalTravelX=0,totalTravel2D=0,minGap=distance,maxGap=distance,lastX=e.x,lastY=e.y;
 let previousPursuit=false,previousWaiting=false,nextTrace=0,lastHpDamageIndex=0;
 Object.defineProperty(p,'hp',{enumerable:true,configurable:true,get:()=>hp,set:value=>{
  if(inStep&&value<hp){
   const stack=new Error().stack||'';
   const via=stack.includes('statusTick')?'status-dot':stack.includes('updateZones')?'ground-zone':stack.includes('traitOnHit')?'trait-extra':stack.includes('updateProjectiles')?'projectile':stack.includes('updateAttack')?'direct-attack':'other';
   damages.push({time:round(w.time),actualHpDeduction:hp-value,integer:Number.isInteger(hp-value),via,bossPlan:e.ai.attack?.plan.id??null,bossStep:e.ai.attack?.index??null,bossGap:round(Math.abs(e.x-playerX)),bossX:round(e.x),summonsAlive:w.targets.filter(t=>t.owner===e.id&&t.hp>0).length});
  }
  hp=value;
 }});
 const pin=()=>{p.x=playerX;p.prevX=playerX;p.y=w.floor;p.prevY=w.floor;p.vx=0;p.vy=0;p.grounded=true;p.platformId='ground';};
 function inspectAttack(){
  const a=e.ai.attack;
  if(a!==activeAttack){
   if(activeRecord){activeRecord.endTime=round(w.time);activeRecord.endGap=round(Math.abs(e.x-playerX));activeRecord.endX=round(e.x);}
   activeAttack=a;activeRecord=null;stepRecord=null;lastStepKey=null;
   if(a){
    activeRecord={serial:++serial,time:round(w.time),pattern:a.plan.id,name:a.plan.name,kind:a.plan.kind,passive:!!a.plan.passive,firstType:a.plan.steps[0]?.type,x:round(e.x),y:round(e.y),gap:round(Math.abs(e.x-playerX)),phase:e.ai.phase,rangeStreak:e.ai.rangeStreak||0,speed:a.speed,meleeReadyAtStart:enemyMeleeReady(w,e,a.plan.steps[0]),steps:a.plan.steps.map(s=>({type:s.type,windup:s.windup,active:s.active,recover:s.recover,damage:s.damage,reach:s.reach}))};
    plans.push(activeRecord);
    if(a.plan.kind==='melee'&&!activeRecord.meleeReadyAtStart)errors.push({type:'melee-start-outside-ready',time:round(w.time),pattern:a.plan.id,gap:activeRecord.gap});
   }
  }
  if(!a)return;
  const s=a.plan.steps[a.index];if(!s)return;
  const key=`${serial}:${a.index}`;
  if(key!==lastStepKey){
   lastStepKey=key;
   stepRecord={planSerial:serial,pattern:a.plan.id,index:a.index,type:s.type,name:s.name,enteredAt:round(w.time),enteredGap:round(Math.abs(e.x-playerX)),reach:round(enemyMeleeReach(w,e,s)),damage:s.damage,windup:s.windup,active:s.active,recover:s.recover,playerAccepted:false};
   steps.push(stepRecord);
  }
  if(a.fired&&stepRecord.releasedAt===undefined){stepRecord.releasedAt=round(w.time);stepRecord.releaseGap=round(Math.abs(e.x-playerX));}
  if(a.victims.includes('player')&&!stepRecord.playerAccepted){stepRecord.playerAccepted=true;stepRecord.playerAcceptedAt=round(w.time);stepRecord.hitGap=round(Math.abs(e.x-playerX));}
 }
 try{
  for(let n=0;n<Math.round(duration/STEP);n++){
   pin();hp=hpLimit;
   const textSet=new Set(w.texts);
   inStep=true;stepCampaign(w,STEP,{});inStep=false;
   const newTexts=w.texts.filter(t=>!textSet.has(t)&&/^−/.test(String(t.text)));
   const pending=damages.slice(lastHpDamageIndex);
   for(let j=0;j<pending.length;j++)if(newTexts[j]){pending[j].label=String(newTexts[j].text);pending[j].labelAmount=Number(String(newTexts[j].text).match(/^−(\d+(?:\.\d+)?)/)?.[1]);}
   lastHpDamageIndex=damages.length;
   inspectAttack();
   totalTravelX+=Math.abs(e.x-lastX);totalTravel2D+=Math.hypot(e.x-lastX,e.y-lastY);lastX=e.x;lastY=e.y;
   const gap=Math.abs(e.x-playerX);minGap=Math.min(minGap,gap);maxGap=Math.max(maxGap,gap);
   const pursuing=e.ai.pursuitUntil>w.time;
   if(pursuing&&!previousPursuit)pursuits.push({start:round(w.time),x:round(e.x),gap:round(gap),streak:e.ai.rangeStreak||0});
   if(!pursuing&&previousPursuit)Object.assign(pursuits.at(-1),{end:round(w.time),endX:round(e.x),endGap:round(gap)});
   previousPursuit=pursuing;
   const waiting=!!e.ai.attack?.waitingLink;
   if(waiting&&!previousWaiting)waitingLinks.push({start:round(w.time),x:round(e.x),gap:round(gap),pattern:e.ai.attack.plan.id,index:e.ai.attack.index});
   if(!waiting&&previousWaiting)Object.assign(waitingLinks.at(-1),{end:round(w.time),endX:round(e.x),endGap:round(gap),closed:!!e.ai.attack});
   previousWaiting=waiting;
   if(w.time+1e-8>=nextTrace){trace.push({time:round(w.time),x:round(e.x),y:round(e.y),vx:round(e.vx),vy:round(e.vy),gap:round(gap),state:e.ai.state,plan:e.ai.attack?.plan.id??null,index:e.ai.attack?.index??null,waiting:!!e.ai.attack?.waitingLink,pursuing,streak:e.ai.rangeStreak||0});nextTrace+=.5;}
   if(![e.x,e.y,e.vx,e.vy,p.hp].every(Number.isFinite))throw Error('Nonfinite actor state');
   pin();hp=hpLimit;
  }
 }catch(error){inStep=false;errors.push({type:'runtime-error',message:error.message,stack:error.stack});}
 if(activeRecord&&!activeRecord.endTime)activeRecord.openAtAuditEnd=true;
 const meleePlans=plans.filter(q=>q.kind==='melee'),remotePlans=plans.filter(q=>!q.passive&&['projectile','zone'].includes(q.firstType));
 const meleeSteps=steps.filter(s=>['melee','dash'].includes(s.type));
 const remoteTransitions=remotePlans.filter(q=>q.endTime!==undefined).map(q=>{
  const next=meleePlans.find(m=>m.time>=q.endTime-.01),firstHit=meleeSteps.find(s=>s.playerAccepted&&s.playerAcceptedAt>=q.endTime-.01);
  return {fromSerial:q.serial,pattern:q.pattern,endedAt:q.endTime,gapAtEnd:q.endGap,nextMeleeSerial:next?.serial??null,nextMeleeAt:next?.time??null,nextMeleeGap:next?.gap??null,secondsToMelee:next?round(next.time-q.endTime):null,firstMeleeHitAt:firstHit?.playerAcceptedAt??null,windowTruncatedByAuditEnd:q.endTime>duration-8};
 });
 const firstCompletedRemote=remoteTransitions[0];
 const warnings=[];
 if(!meleeSteps.some(s=>s.playerAccepted))warnings.push('No accepted boss melee/dash hit in 45 seconds');
 if(distance>=400&&(!firstCompletedRemote||firstCompletedRemote.nextMeleeSerial===null))warnings.push('No observed melee plan after first completed remote plan');
 if(!damages.length)warnings.push('No actual encounter HP deduction');
 if(damages.some(d=>!d.integer||!Number.isInteger(d.labelAmount)||d.actualHpDeduction!==d.labelAmount))errors.push({type:'noninteger-or-label-mismatch',damages:damages.filter(d=>!d.integer||!Number.isInteger(d.labelAmount)||d.actualHpDeduction!==d.labelAmount)});
 const summary={id,name:ENEMIES[id].name,stage:stage.id,initialDistance:distance,initialPhase:phase,simulatedSeconds:round(w.time),planCount:plans.length,remotePlanCount:remotePlans.length,meleePlanCount:meleePlans.length,meleeReleased:meleeSteps.filter(s=>s.releasedAt!==undefined).length,meleeAcceptedHits:meleeSteps.filter(s=>s.playerAccepted).length,damageHits:damages.length,totalActualDamage:damages.reduce((n,d)=>n+d.actualHpDeduction,0),damageValues:[...new Set(damages.map(d=>d.actualHpDeduction))].sort((a,b)=>a-b),integerDamage:damages.every(d=>d.integer&&Number.isInteger(d.labelAmount)&&d.actualHpDeduction===d.labelAmount),minGap:round(minGap),maxGap:round(maxGap),netX:round(e.x-start.x),totalTravelX:round(totalTravelX),totalTravel2D:round(totalTravel2D),firstMeleeAt:meleePlans[0]?.time??null,firstMeleeHitAt:meleeSteps.find(s=>s.playerAccepted)?.playerAcceptedAt??null,remotePlansBeforeFirstMelee:remotePlans.filter(q=>q.time<(meleePlans[0]?.time??Infinity)).length,firstCompletedRemote,uncensoredRemoteWithoutLaterMelee:remoteTransitions.filter(q=>!q.windowTruncatedByAuditEnd&&q.nextMeleeSerial===null).length,pursuitWindows:pursuits.length,waitingLinkWindows:waitingLinks.length,warnings,errors};
 return {summary,start,plans,steps,remoteTransitions,pursuits,waitingLinks,damageEvents:damages,positionTrace:trace};
}

for(const id of bossIds)for(const phase of phases)for(const distance of distances){
 const result=runCase(id,distance,phase);allRuns.push(result);
 const s=result.summary;
 console.log(`${id} phase${phase} gap${distance}: remote=${s.remotePlanCount} melee=${s.meleePlanCount}/${s.meleeAcceptedHits}hit minGap=${s.minGap} damage=${s.totalActualDamage} integer=${s.integerDamage} warnings=${s.warnings.length} errors=${s.errors.length}`);
}
const afterHashes=sourceHashes(),sourceStable=JSON.stringify(beforeHashes)===JSON.stringify(afterHashes);
const summaries=allRuns.map(r=>r.summary);
const report={schema:1,generatedAt:new Date().toISOString(),kind:'read-only constructed simulation audit; not natural campaign completion',method:{durationSeconds:duration,step:STEP,distances,phases,stageMatchedBoss:true,spawn:'createCampaign + beginEncounter, no manual attack sequence or cooldown changes',geometry:'flat actual campaign ground; upper platforms/obstacles excluded to isolate pursuit',player:'stationary fire player at x4800, 1,000,000 QA HP restored between ticks; normal hit invulnerability, statuses, collision and integer hitPlayer remain active',profile:'none; no persistent saves, equipment, passives or companion',environmentHazards:'disabled to isolate boss and legitimate summons; native boss zones/projectiles/passives stay active',damage:'actual HP setter deductions plus real floating-text number; encounter totals include legitimate boss summons, while boss melee hits use that boss attack.victims',sampling:'every simulation tick for attack/releases/hits/HP; position trace every 0.5 seconds',limitations:['QA player pin cancels knockback, gravity and control movement but preserves status timers.','This audit does not test upper platform navigation, cover, dodging, natural progression or subjective art/balance.','Remote transitions ending within final eight seconds may be censored by the 45 second observation window.']},sourceHashes:{before:beforeHashes,after:afterHashes,stable:sourceStable},checks:{runCount:allRuns.length,bossCount:bossIds.length,allSourceStable:sourceStable,allFiniteAndNoErrors:summaries.every(s=>!s.errors.length),allIntegerActualDamage:summaries.every(s=>s.integerDamage),allHaveAcceptedBossMelee:summaries.every(s=>s.meleeAcceptedHits>0),allFarRunsReachMeleeAfterFirstRemote:summaries.filter(s=>s.initialDistance>=400).every(s=>s.firstCompletedRemote?.nextMeleeSerial!==null&&s.firstCompletedRemote?.nextMeleeSerial!==undefined)},summary:summaries,runs:allRuns};
report.passed=sourceStable&&report.checks.allFiniteAndNoErrors&&report.checks.allIntegerActualDamage&&report.checks.allHaveAcceptedBossMelee&&report.checks.allFarRunsReachMeleeAfterFirstRemote;
report.interpretation={passedMeaning:'All mechanically measured checks pass; this does not approve subjective pursuit timing, difficulty or appearance.',observations:[{type:'pursuit-tempo-review',id:'B07',message:'Current B07 far-distance pursuit timings are measured in evidence below. Compare these timings when tuning pressure; no subjective acceptance is implied.',evidence:summaries.filter(s=>s.id==='B07'&&s.initialDistance===700).map(s=>({phase:s.initialPhase,firstMeleeAt:s.firstMeleeAt,secondsAfterFirstRemote:s.firstCompletedRemote?.secondsToMelee,remotePlansBeforeFirstMelee:s.remotePlansBeforeFirstMelee,minGap:s.minGap}))},{type:'branch-coverage-limit',message:'The stationary 66-case audit never naturally enters waitingLink. The corrected attack.waitingLink reference is visible in the source, but this branch needs a separate moving-player/forced-range regression if branch coverage is required.',waitingLinkWindows:summaries.reduce((n,s)=>n+s.waitingLinkWindows,0)}],totals:{actualDamageEvents:allRuns.reduce((n,r)=>n+r.damageEvents.length,0),acceptedBossMeleeOrDashHits:summaries.reduce((n,s)=>n+s.meleeAcceptedHits,0)}};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({output,passed:report.passed,checks:report.checks,warningRuns:summaries.filter(s=>s.warnings.length).map(s=>({id:s.id,phase:s.initialPhase,gap:s.initialDistance,warnings:s.warnings})),errorRuns:summaries.filter(s=>s.errors.length).map(s=>({id:s.id,phase:s.initialPhase,gap:s.initialDistance,errors:s.errors}))}));
process.exitCode=report.passed?0:1;
