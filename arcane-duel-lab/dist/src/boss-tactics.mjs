import {groundTarget,resolveGroundTarget} from './targeting.mjs?v=20261030-duel12';
import {enemyDamageFactor,ENEMY_DAMAGE} from './enemy-tuning.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const emit=(w,type,data)=>{(w.enemyEvents||=[]).push({type,time:w.time,...data});if(w.enemyEvents.length>80)w.enemyEvents.shift();};

// A promised destination is fixed when its windup begins. Moving supports may
// carry it; mouse/player motion cannot move the warning after the commitment.
export function prepareBossTactic(w,e,s){
 const a=e.ai.attack;if(!a)return;
 a.groundAnchor=null;a.teleportAnchor=null;a.summonAnchors=null;
 if(s?.type==='zone')a.groundAnchor=groundTarget(w,clamp(a.aim.x+(s.offsetX||0),45,w.width-45),a.aim.y+12);
 if(s?.type==='teleport'){
  const edge=w.campaign?.lock,lo=edge?edge.x+e.w+20:e.w+20,hi=edge?edge.x+edge.width-e.w-20:w.width-e.w-20;
  a.teleportAnchor=groundTarget(w,clamp(a.aim.x+(s.offset||140)*-Math.sign(a.aim.x-e.x||e.face),lo,hi),a.aim.y+w.player.h*.5-2);
 }
 if(['summon','clone'].includes(s?.type))a.summonAnchors=[-1,1].map(dir=>groundTarget(w,clamp(e.x+dir*(s.type==='clone'?165:100),50,w.width-50),e.y-2)).filter(Boolean);
}

export function fireBossTactic(w,e,s,hooks,spawn){
 const a=e.ai.attack;
 if(s.type==='veil'){
  e.ai.veilUntil=w.time+(s.duration||1.8);e.ai.veilStyle=s.style;
  hooks.effect(w,'enemyVfx',{style:s.style,x:e.x,y:e.y,radius:75,duration:.55,ground:true,enemyKind:e.enemyKind});
  emit(w,'enemyVeiled',{id:e.id,until:e.ai.veilUntil});return true;
 }
 if(s.type==='heal'){
  a.healNext=w.time+.18;a.healRemaining=4;a.healAmount=Math.max(1,Math.round(e.maxHp*(s.healFraction||.015)));
  emit(w,'enemyHealing',{id:e.id});return true;
 }
 if(s.type==='clone'){
  let count=w.targets.filter(t=>t.owner===e.id&&t.mirage&&t.hp>0).length;
  for(const promised of a.summonAnchors||[]){
   const anchor=resolveGroundTarget(w,promised);if(!anchor||count>=2)continue;
   const t=spawn(w,'M15',{x:anchor.x,y:anchor.y,scale:.8,owner:e.id});if(!t)continue;
   Object.assign(t,{appearanceKind:e.enemyKind,mirage:true,visual:e.visual*.85,w:e.w*.75,h:e.h*.85,hp:Math.max(1,Math.round(e.maxHp*.055)),maxHp:Math.max(1,Math.round(e.maxHp*.055)),damageFactor:enemyDamageFactor(e)*.42/ENEMY_DAMAGE.minion,expires:w.time+8,bornAt:w.time,flankOffset:0});
   t.ai.readyAt=w.time+.7;count++;
   hooks.effect(w,'enemyVfx',{style:s.style,x:t.x,y:t.y,radius:80,duration:.65,ground:true,enemyKind:e.enemyKind});
   emit(w,'mirrorCloneSpawned',{id:t.id,owner:e.id,expires:t.expires});
  }
  return true;
 }
 if(s.type==='wave'){
  const anchor=groundTarget(w,e.x+e.face*(e.w+20),e.y-2);if(!anchor)return true;
  const edge=w.campaign?.lock,lo=edge?edge.x+15:15,hi=edge?edge.x+edge.width-15:w.width-15;
  (w.enemyWaves||=[]).push({owner:e.id,enemyKind:e.enemyKind,style:s.style,x:anchor.x,prevX:anchor.x,y:anchor.y,face:e.face,speed:s.speed||340,radius:s.waveRadius||52,travel:0,distance:s.distance||600,damage:s.damage,push:s.push||0,status:s.status,created:w.time,lo,hi,victims:[]});
  emit(w,'groundWaveReleased',{id:e.id,x:anchor.x,y:anchor.y});return true;
 }
 return false;
}

export function tickBossTactic(w,e,s,hooks){
 const a=e.ai.attack;
 if(s.type==='heal'&&a.healRemaining>0&&w.time>=a.healNext){
  a.healNext=w.time+.45;a.healRemaining--;const amount=Math.min(a.healAmount,e.maxHp-e.hp);e.hp+=amount;
  if(amount>0){hooks.effect(w,'enemyVfx',{style:s.style,x:e.x,y:e.y-e.h*.5,radius:75,duration:.6,enemyKind:e.enemyKind});w.texts.push({x:e.x,y:e.y-e.h,vy:-35,text:'+'+amount,color:'#b8e69a',life:.85,max:.85});emit(w,'bossHealed',{id:e.id,amount});}
 }
}

export function revealBeforeStrike(w,e,s){
 if(e.ai.veilUntil>w.time&&s.damage>0&&e.ai.attack.age>=s.windup-.38*e.ai.attack.speed){e.ai.veilUntil=0;emit(w,'enemyRevealed',{id:e.id});}
}

export function updateBossTactics(w,dt,hooks,applyStatus){
 for(const t of w.targets)if(t.mirage&&t.hp>0){const owner=w.targets.find(e=>e.id===t.owner);if(!owner||owner.hp<=0){t.hp=0;t.diedAt=w.time;t.deadUntil=Infinity;t.ai.attack=null;}}
 for(const z of w.enemyWaves||[]){
  const owner=w.targets.find(e=>e.id===z.owner);if(!owner||owner.hp<=0){z.ended=true;continue;}
  z.prevX=z.x;const dx=z.face*z.speed*dt;z.x=clamp(z.x+dx,z.lo,z.hi);z.travel+=Math.abs(dx);
  const support=groundTarget(w,z.x,z.y-2);if(!support||Math.abs(support.y-z.y)>85){z.ended=true;continue;}z.y=support.y;
  for(const t of [w.player,w.fox,w.companion]){
   if(!t||t.hp<=0)continue;const key=t===w.player?'player':t===w.fox?'stag':'companion';
   if(z.victims.includes(key)||t.x<Math.min(z.prevX,z.x)-z.radius-(t.w||18)||t.x>Math.max(z.prevX,z.x)+z.radius+(t.w||18)||Math.abs(t.y-z.y)>80)continue;
   const accepted=t===w.player?hooks.hitPlayer(w,z.damage,z.x):t===w.fox?hooks.hitSummon(w,z.damage,z.x):hooks.hitCompanion?.(w,z.damage,z.x);
   z.victims.push(key);if(accepted&&t===w.player){if(z.status)applyStatus(w,z.status,z.owner,hooks);if(z.push)t.vx+=z.face*Math.abs(z.push);}
  }
  if(z.travel>=z.distance||z.x===z.lo||z.x===z.hi)z.ended=true;
 }
 w.enemyWaves=(w.enemyWaves||[]).filter(z=>!z.ended);
}

export function bossVisibility(e,time){return e.ai?.veilUntil>time ? .16 : e.mirage ? .57 : 1;}
