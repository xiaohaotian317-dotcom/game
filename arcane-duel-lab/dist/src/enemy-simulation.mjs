import {ENEMIES,enemyDefinition} from './enemy-roster.mjs';
import {BOSS_TUNING,bossReachScale} from './enemy-tuning.mjs';
import {clearLine,firstTerrainHit,resolveSolidSides} from './collision.mjs?v=20261030-duel12';
import {groundTarget,resolveGroundTarget} from './targeting.mjs?v=20261030-duel12';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const alive=a=>a.hp>0&&!(a.dead>0);
const serial=w=>++w.serial;
export function spawnEnemy(w,kind,{x=w.player.x+400,y=w.player.y,scale,owner=null,baby=false}={}){
 const d=enemyDefinition(kind);w.enemyMode=true;w.enemyZones||=[];w.enemyEvents||=[];
 const living=w.targets.filter(e=>e.enemyKind&&e.hp>0);
 if(living.length>=(w.campaign?28:18))return null;
 scale??=d.boss?BOSS_TUNING.scale:1;
 scale=clamp(scale,.35,1.25);x=clamp(Number.isFinite(x)?x:w.player.x+400,50,w.width-50);
 let support=groundTarget(w,x,Number.isFinite(y)?y:0);
 if(!support)return null;
 // Do not place a large boss on a ledge narrower than its collision footprint.
 const deck=w.platforms.find(p=>p.id===support.platformId);
 if(deck.w<d.w*scale*2+12)support=groundTarget(w,x,support.y+1);
 if(!support)return null;
 let ey=support.y;if(d.flying)ey=Math.max(d.h*scale+35,support.y-85);
 const e={id:'enemy-'+serial(w),enemyKind:kind,x,y:ey,prevX:x,prevY:ey,spawnX:x,spawnY:ey,
  w:d.w*scale,h:d.h*scale,hp:Math.round(d.hp*(baby?.32:1)),maxHp:Math.round(d.hp*(baby?.32:1)),scale,attackScale:d.boss?bossReachScale(d):scale,frequency:d.boss?BOSS_TUNING.frequency:1,visual:d.visual*scale,damageFactor:1,
  face:-1,vx:0,vy:0,grounded:!d.flying,platformId:d.flying?null:support.platformId,cycle:0,
  hit:0,deadUntil:0,burnUntil:0,nextBurn:0,rootUntil:0,slowUntil:0,frostSnareUntil:0,
  owner,baby,expires:owner?w.time+30:Infinity,ai:{state:'spawn',stateAt:w.time,readyAt:w.time+.65,attack:null,cooldowns:{},sequence:0,phase:1,
   nextPassive:w.time+(kind==='B07'?7:kind==='B02'?6:9),stagger:0,poise:0,jumpAt:0,passiveAt:0}};
 w.targets.push(e);return e;
}
export function clearEnemies(w){
 w.targets=w.targets.filter(e=>!e.enemyKind&&!e.egg);w.projectiles=w.projectiles.filter(p=>!p.enemySource);
 w.enemyZones=[];w.enemyEggs=[];w.player.enemyStatus=null;w.player.enemyControl=null;w.enemyEvents=[];
}
export function placeEncounter(w,kinds,opts={}){
 clearEnemies(w);w.targets=[];w.enemyMode=true;
 const origin=opts.x??clamp(w.player.x+410,180,w.width-200);
 return kinds.map((kind,i)=>spawnEnemy(w,kind,{x:origin+i*125,y:opts.y??w.player.y,scale:opts.scale})).filter(Boolean);
}
export function enemyOnDamage(w,e,amount,{impact=true}={}){
 if(!e.enemyKind&&!e.egg)return;
 if(e.hp<=0){e.deadUntil=Infinity;e.diedAt=w.time;e.vx=0;if(e.ai){e.ai.attack=null;e.ai.state='dead';}return;}
 if(e.egg)return;
 const d=ENEMIES[e.enemyKind];
 if(impact){
  if(d.boss){e.ai.poise+=amount;if(e.ai.poise>=110){e.ai.poise=0;e.ai.stagger=.65;e.ai.attack=null;e.ai.state='stagger';e.ai.readyAt=w.time+.75;e.ai.passiveUntil=0;}}
  else{e.ai.stagger=.2;e.ai.attack=null;e.ai.state='hurt';e.ai.readyAt=Math.max(e.ai.readyAt,w.time+.4);}
 }
}
function fx(w,hooks,style,data={}){return hooks.effect(w,'enemyVfx',{style,duration:.6,...data});}
function notice(w,type,data={}){(w.enemyEvents||=[]).push({type,time:w.time,...data});if(w.enemyEvents.length>80)w.enemyEvents.shift();}
const statusSpec={poison:{duration:3.6,interval:.75,damage:3,color:'#b5d45d'},burn:{duration:3,interval:.75,damage:3,color:'#ffb16f'}};
export function applyEnemyStatus(w,kind,source,hooks){
 const p=w.player;if(!alive(p))return;
 if(statusSpec[kind]){const spec=statusSpec[kind];p.enemyStatus||={};const prior=p.enemyStatus[kind],actor=w.targets.find(e=>e.id===source),factor=w.campaign?(actor?.damageFactor??w.campaign.stage.damageFactor):1;p.enemyStatus[kind]={until:w.time+spec.duration,next:prior?.next>w.time?prior.next:w.time+spec.interval,source,damage:Math.max(1,Math.round(spec.damage*factor))};return;}
 if(kind==='snare'){p.enemySnareUntil=Math.max(p.enemySnareUntil||0,w.time+1.4);return;}
 if(kind==='freeze'||kind==='petrify'){
  const key=kind+'ImmuneUntil';if((p[key]||0)>w.time||p.enemyControl?.until>w.time)return;
  const duration=kind==='petrify'?2:1.25;p.enemyControl={kind,until:w.time+duration};p[key]=w.time+duration+5;
  p.cast=null;p.buffer=null;p.recast=null;p.burst=null;p.vx=0;p.vy=Math.max(0,p.vy);p.dash=0;p.stomp=false;p.jumpBuffer=0;p.queuedDash=false;
  fx(w,hooks,kind==='freeze'?'ice':'stone',{x:p.x,y:p.y-p.h*.5,radius:55,duration:.7});notice(w,'control',{kind,duration});
 }
}
function traitOnHit(w,e,step,hooks){
 if(step.status&&step.status!=='freeze')applyEnemyStatus(w,step.status,e.id,hooks);
 const p=w.player;
 if(e.enemyKind==='B06'){
  if((p.petrifyImmuneUntil||0)<=w.time){p.stoneStacks=(p.stoneStackUntil||0)>w.time?(p.stoneStacks||0)+1:1;p.stoneStackUntil=w.time+7;
   if(p.stoneStacks>=3){p.stoneStacks=0;applyEnemyStatus(w,'petrify',e.id,hooks);}}
 }
 if(e.enemyKind==='B08'){
  p.enemySnareUntil=w.time+1.8;
  if((p.freezeImmuneUntil||0)<=w.time){p.frostStacks=(p.frostStackUntil||0)>w.time?(p.frostStacks||0)+1:1;p.frostStackUntil=w.time+7;
   if(p.frostStacks>=3){p.frostStacks=0;applyEnemyStatus(w,'freeze',e.id,hooks);}}
 }
 if(e.enemyKind==='B03'&&w.time>e.ai.passiveAt){e.ai.passiveAt=w.time+1.5;e.hp=Math.min(e.maxHp,e.hp+8);fx(w,hooks,'heal',{x:e.x,y:e.y-e.h*.55,duration:.7,enemyKind:e.enemyKind});}
 if(e.enemyKind==='B09'){e.ai.charges=(e.ai.charges||0)+1;if(e.ai.charges%3===0)hooks.hitPlayer(w,5,e.x,{dot:true});}
}
export function enemyProjectileContact(w,s,actor,hooks,accepted){
 const source=w.targets.find(e=>e.id===s.enemySource);
 if(accepted&&actor===w.player&&source?.hp>0)traitOnHit(w,source,{status:s.enemyStatus},hooks);
 if(s.enemyPool){const support=groundTarget(w,s.x,s.y),style=source?.themeStyle||'venom';if(support&&Math.abs(support.y-s.y)<140)addZone(w,source||{id:s.enemySource},style,support,{radius:48,life:style==='lava'?5:3,damage:Math.max(1,Math.round(4*(source?.damageFactor??1))),status:style==='lava'?'burn':style==='venom'?'poison':null,delay:.2});}
 fx(w,hooks,s.enemyStyle,{x:s.x,y:s.y,radius:36,duration:.5,enemyKind:s.enemyKind||source?.enemyKind});
}
function addZone(w,e,style,anchor,opts={}){
 const z={id:serial(w),owner:e.id,enemyKind:e.enemyKind,style,anchor:{...anchor},x:anchor.x,y:anchor.y,created:w.time,
  delay:opts.delay??.65,warning:opts.warning,fall:opts.fall,radius:opts.radius??80,life:opts.life??3,damage:opts.damage??9,status:opts.status,
  gravity:opts.gravity||false,next:0,hits:0};(w.enemyZones||=[]).push(z);return z;
}
function statusTick(w,dt,hooks){
 const p=w.player;
 if(p.enemyControl&&p.enemyControl.until<=w.time){notice(w,'controlEnd',{kind:p.enemyControl.kind});p.enemyControl=null;}
 for(const [kind,s]of Object.entries(p.enemyStatus||{})){
  if(!alive(p)||s.until<=w.time){delete p.enemyStatus[kind];continue;}
  if(s.next<=w.time){s.next+=statusSpec[kind].interval;hooks.hitPlayer(w,s.damage??statusSpec[kind].damage,p.x,{dot:true,label:kind==='poison'?'毒伤':'灼烧'});}
 }
 if(!alive(p)){p.enemyControl=null;p.enemyStatus={};p.enemySnareUntil=0;p.stoneStacks=0;p.frostStacks=0;}
}
function spawnEgg(w,e,hooks){
 const count=w.targets.filter(t=>t.owner===e.id&&t.hp>0).length;if(count>=4)return;
 const a=groundTarget(w,clamp(e.x-e.face*70,50,w.width-50),e.y-5);if(!a)return;
 const egg={id:'egg-'+serial(w),egg:true,owner:e.id,x:a.x,y:a.y,prevX:a.x,prevY:a.y,w:25,h:52,hp:45,maxHp:45,
  bornAt:w.time,hatchAt:w.time+2.1,deadUntil:0,burnUntil:0,nextBurn:0,rootUntil:0,hit:0,vx:0,vy:0,grounded:true,face:e.face,platformId:a.platformId,anchor:a};
 w.targets.push(egg);fx(w,hooks,'web',{x:a.x,y:a.y,radius:70,duration:.9,enemyKind:e.enemyKind,ground:true});notice(w,'eggLaid',{owner:e.id,id:egg.id});
}
function updateEgg(w,e,dt,hooks){
 e.prevX=e.x;e.prevY=e.y;e.hit=Math.max(0,e.hit-dt);
 if(e.hp<=0)return;
 if(!w.targets.some(t=>t.id===e.owner&&t.hp>0)){e.hp=0;e.diedAt=w.time;e.deadUntil=Infinity;return;}
 const anchor=resolveGroundTarget(w,e.anchor);if(!anchor){e.hp=0;e.diedAt=w.time;return;}e.x=anchor.x;e.y=anchor.y;e.anchor=anchor;
 if(e.burnUntil>w.time&&w.time>=e.nextBurn){e.nextBurn+=.75;hooks.damage(w,e,4,{impact:false});}
 if(w.time>=e.hatchAt){
  let spawned=0;for(const dx of [-12,0,12]){if(w.targets.filter(t=>t.owner===e.owner&&t.enemyKind==='S01'&&t.hp>0).length>=6)break;
   const baby=spawnEnemy(w,'S01',{x:e.x+dx,y:e.y,scale:.6,baby:true,owner:e.owner});if(baby){baby.ai.state='hatch';baby.ai.readyAt=w.time+.55;baby.bornAt=w.time;baby.emergeDir=Math.sign(dx);baby.flankOffset=Math.sign(dx)*58;spawned++;}}
  e.hp=0;e.hatched=true;e.diedAt=w.time;e.deadUntil=Infinity;fx(w,hooks,'eggHatch',{x:e.x,y:e.y,radius:65,duration:1,enemyKind:'B02'});notice(w,'eggHatched',{count:spawned,owner:e.owner});
 }
}
function updateZones(w,dt,hooks){
 for(const z of w.enemyZones||[]){
  const a=resolveGroundTarget(w,z.anchor);if(!a){z.life=-1;continue;}z.x=a.x;z.y=a.y;z.anchor=a;
  const age=w.time-z.created;if(age<z.delay)continue;
  if(!z.activated){z.activated=true;fx(w,hooks,z.style,{x:z.x,y:z.y-12,radius:z.radius,duration:.75,enemyKind:z.enemyKind});notice(w,'zoneActivated',{style:z.style});}
  const p=w.player;
  if(z.gravity&&alive(p)&&Math.abs(p.x-z.x)<z.radius+70&&Math.abs(p.y-z.y)<140&&!p.enemyControl){p.vx+=(z.x-p.x)*dt*4;}
  if(age>z.delay+z.life)continue;
  if(alive(p)&&Math.abs(p.x-z.x)<z.radius+p.w&&Math.abs(p.y-z.y)<(z.style==='lightning'?210:95)&&w.time>=z.next){
   z.next=w.time+.75;const accepted=hooks.hitPlayer(w,z.damage,z.x);
   if(accepted){z.hits++;const source=w.targets.find(e=>e.id===z.owner);if(source?.hp>0)traitOnHit(w,source,{status:z.status},hooks);else if(z.status)applyEnemyStatus(w,z.status,z.owner,hooks);}
  }
  const f=w.fox;if(f&&Math.abs(f.x-z.x)<z.radius+f.w&&Math.abs(f.y-z.y)<90&&w.time>=(z.summonAt||0)){z.summonAt=w.time+.8;hooks.hitSummon(w,z.damage,z.x);}
 }
 w.enemyZones=(w.enemyZones||[]).filter(z=>w.time-z.created<z.delay+z.life);
}
function stepPlan(e){return e.ai.attack?.plan.steps[e.ai.attack.index];}
export function enemyCastOrigin(w,e){
 const metadata=w.enemyArt?.[e.enemyKind],socket=metadata?.socket;
 if(socket){const size=e.visual/.76;return {x:e.x+e.face*(socket.x-.5)*size,y:e.y+(socket.y-socket.ground)*size};}
 const d=ENEMIES[e.enemyKind],mouth=['serpent','bat','wolf','dragon'].includes(d?.form);
 return {x:e.x+e.face*(mouth?e.visual*.22:e.w*.7),y:e.y-(mouth?e.visual*.66:e.h*.72)};
}
export function enemyStrikeContact(w,e,t,s){
 const forward=(t.x-e.x)*e.face,overlap=Math.abs(t.x-e.x)<=e.w+t.w;
 return t.hp>0&&(overlap||forward>=0)&&forward<s.reach*(e.attackScale??e.scale)+t.w&&Math.abs(t.y-e.y)<Math.max(88,e.h*.72)&&clearLine(w,e.x,e.y-Math.min(e.h*.42,75),t.x,t.y-Math.min(t.h*.45,55));
}
function choosePlan(w,e,d){
 const ai=e.ai,distance=Math.abs(w.player.x-e.x),available=d.patterns.filter(p=>(!e.meleeOnly||p.kind==='melee')&&(ai.cooldowns[p.id]||0)<=w.time);
 if(w.campaign&&!d.boss&&w.targets.filter(t=>t!==e&&t.hp>0&&t.ai?.attack).length>=w.campaign.attackBudget)return null;
 const specials=available.filter(p=>p.kind==='special');if(specials.length&&ai.sequence%3===2)return specials[Math.floor(ai.sequence/3)%specials.length];
 const preferred=available.filter(p=>p.kind===(distance<(d.boss?230:145)?'melee':'range'));
 if(preferred.length)return preferred[ai.sequence%preferred.length];
 const other=available.filter(p=>p.kind==='range'||(p.kind==='melee'&&distance<240));return other[0]||null;
}
function startPlan(w,e,plan){
 if(e.damageFactor!==undefined||e.themeStyle){plan={...plan,steps:plan.steps.map(s=>({...s,damage:s.damage===undefined?undefined:Math.max(1,Math.round(s.damage*(e.damageFactor??1))),radius:s.radius===undefined?undefined:s.radius*(ENEMIES[e.enemyKind].boss?(e.attackScale??e.scale):1),style:!ENEMIES[e.enemyKind].boss&&e.themeStyle?e.themeStyle:s.style,status:!ENEMIES[e.enemyKind].boss&&e.themeStyle?(e.themeStyle==='ice'?'snare':e.themeStyle==='venom'?'poison':e.themeStyle==='lava'?'burn':null):s.status}))};}
 e.ai.attack={plan,index:0,age:0,fired:false,victims:[],speed:(e.ai.phase===2?1.1:1)*(e.attackTempo||1)*(e.frequency||1)};
 e.ai.state='windup';e.face=Math.sign(w.player.x-e.x||e.face);e.ai.cooldowns[plan.id]=w.time+plan.cd/(e.frequency||1);e.ai.sequence++;
 e.ai.attack.aim={x:w.player.x,y:w.player.y-w.player.h*.5};
 notice(w,'attackStarted',{id:e.id,enemyKind:e.enemyKind,pattern:plan.id,source:plan.passive?'passive':'active'});
}
function fireStep(w,e,s,hooks){
 const a=e.ai.attack;
 if(s.type==='projectile'){
  const {x:sx,y:sy}=enemyCastOrigin(w,e),dx=a.aim.x-sx,dy=a.aim.y-sy;
  const angle=Math.atan2(dy,dx),count=s.shots||1;
  for(let i=0;i<count;i++){const ang=angle+(i-(count-1)/2)*(s.spread||.18),speed=s.speed||360;
   const extra={owner:'enemy',enemySource:e.id,enemyKind:e.enemyKind,enemyStyle:s.style,enemyStatus:s.status,enemyPool:s.pool,life:4*(ENEMIES[e.enemyKind].boss?BOSS_TUNING.range*(e.soloRange||1):1),r:(s.style==='sonic'?14:9)*(ENEMIES[e.enemyKind].boss?BOSS_TUNING.range*(e.soloRange||1):1)};
   hooks.projectile(w,'enemyAbility',sx,sy,Math.cos(ang),Math.sin(ang),speed,s.damage,extra);
   if(s.lob){const p=w.projectiles.at(-1),speedup=ENEMIES[e.enemyKind].boss?BOSS_TUNING.fallSpeed:1,travel=clamp(Math.abs(dx)/300,.55,1.2)/speedup;p.vx=dx/travel;p.vy=(dy-.5*700*speedup*speedup*travel*travel)/travel;p.enemyGravity=700*speedup*speedup;}
  }
  fx(w,hooks,s.style,{x:sx,y:sy,face:e.face,radius:38,duration:.42,enemyKind:e.enemyKind});
 }else if(s.type==='zone'){
  const anchor=groundTarget(w,clamp(a.aim.x,45,w.width-45),a.aim.y+12);
  if(anchor){const fall=s.falling?.45/BOSS_TUNING.fallSpeed:0;addZone(w,e,s.style,anchor,{radius:s.radius,life:s.life,damage:s.damage,status:s.status,gravity:s.gravity,delay:.55+fall,warning:s.falling?.55:undefined,fall:fall||undefined});}
 }else if(s.type==='leap'){
  const range=380*BOSS_TUNING.range*(e.soloRange||1),landing=groundTarget(w,clamp(a.aim.x,e.x-range,e.x+range),a.aim.y+10);
  if(landing){e.vx=(landing.x-e.x)/.69;e.vy=-650;e.grounded=false;a.leaping=true;a.landed=false;fx(w,hooks,'web',{x:e.x,y:e.y,radius:70,duration:.5,enemyKind:e.enemyKind});}
 }else if(s.type==='egg')spawnEgg(w,e,hooks);
 else if(s.type==='summon'){
  let count=w.targets.filter(t=>t.owner===e.id&&t.hp>0).length;
  for(const dx of [-100,100])if(count<4){const t=spawnEnemy(w,'M06',{x:e.x+dx,y:e.y,scale:.8,owner:e.id});if(t){t.ai.readyAt=w.time+.75;t.bornAt=w.time;t.flankOffset=Math.sign(dx)*65;count++;fx(w,hooks,'bone',{x:t.x,y:t.y,radius:65,duration:.9,enemyKind:e.enemyKind,ground:true});}}
 }else if(s.type==='melee'||s.type==='dash'){
  fx(w,hooks,s.style,{x:e.x+e.face*(e.w+35),y:e.y-e.h*.4,face:e.face,radius:s.reach*(e.attackScale??e.scale),duration:.42,melee:true,enemyKind:e.enemyKind});
 }
 if(s.lava){a.lastLava=e.x;const anchor=groundTarget(w,e.x+e.face*65,e.y-2);if(anchor)addZone(w,e,'lava',anchor,{radius:86*(e.attackScale??e.scale),life:5,damage:Math.max(2,Math.round(7*(e.damageFactor??1))),status:'burn',delay:.25});}
 hooks.emit(w,'enemyAttack',{enemyStyle:s.style,heavy:s.damage>=18||s.type==='summon'||s.type==='egg'});
}
function updateAttack(w,e,d,dt,hooks){
 const a=e.ai.attack,s=stepPlan(e);if(!s){e.ai.attack=null;return;}
 const previous=a.age;a.age+=dt*a.speed;
 if(a.age<s.windup){e.ai.state='windup';e.vx*=Math.exp(-12*dt);return;}
 if(!a.fired){a.fired=true;fireStep(w,e,s,hooks);}
 if(s.type==='leap'&&a.leaping&&!a.landed){
  if(!e.grounded)a.age=Math.min(a.age,s.windup+s.active-.00001);
  else{const reach=130*BOSS_TUNING.range*(e.soloRange||1);a.landed=true;e.vx=0;fx(w,hooks,'web',{x:e.x,y:e.y-15,radius:reach,duration:.85,enemyKind:e.enemyKind});w.shake=Math.max(w.shake,8);if(Math.abs(w.player.x-e.x)<reach+w.player.w&&Math.abs(w.player.y-e.y)<100)hooks.hitPlayer(w,s.damage,e.x);if(w.fox&&Math.abs(w.fox.x-e.x)<reach+15&&Math.abs(w.fox.y-e.y)<100)hooks.hitSummon(w,s.damage,e.x);notice(w,'leapLanded',{id:e.id});}
 }
 if(a.age<s.windup+s.active){
  e.ai.state=s.type==='projectile'||s.type==='zone'?'cast':s.type==='egg'||s.type==='summon'?'summon':'attack';
  if(s.type==='dash'){
   e.vx=e.face*(s.speed||350)*(d.boss?BOSS_TUNING.range*BOSS_TUNING.frequency:1);if(d.flying)e.vy=clamp((w.player.y-20-e.y)*4,-300,300);
   if(s.lava&&Math.abs(e.x-(a.lastLava??e.x))>75){a.lastLava=e.x;const p=groundTarget(w,e.x,e.y);if(p)addZone(w,e,'lava',p,{radius:50*(e.attackScale??e.scale),life:5,damage:Math.max(1,Math.round(6*(e.damageFactor??1))),status:'burn',delay:.35});}
  }
  if(s.type==='melee'||s.type==='dash')for(const t of [w.player,...(w.fox?[w.fox]:[])]){
   const key=t===w.player?'player':'stag';if(a.victims.includes(key)||!enemyStrikeContact(w,e,t,s))continue;
   a.victims.push(key);const accepted=t===w.player?hooks.hitPlayer(w,s.damage,e.x):hooks.hitSummon(w,s.damage,e.x);
   if(accepted&&t===w.player)traitOnHit(w,e,s,hooks);
  }
 }else{e.ai.state='recover';e.vx*=Math.exp(-10*dt);}
 if(a.age>=s.windup+s.active+s.recover){
  a.index++;a.age=0;a.fired=false;a.victims=[];a.aim={x:w.player.x,y:w.player.y-w.player.h*.5};
  if(a.index>=a.plan.steps.length){e.ai.attack=null;e.ai.state='idle';e.ai.readyAt=w.time+(d.boss?.45:.65)/(e.frequency||1);}
  else{e.face=Math.sign(w.player.x-e.x||e.face);e.ai.state='windup';notice(w,'comboStep',{id:e.id,index:a.index});}
 }
}
function passivePlan(w,e,d,hooks){
 if(w.time<e.ai.nextPassive)return null;
 if(d.id==='B07'){
  if(e.hp<e.maxHp*.94){e.ai.nextPassive=w.time+12;e.ai.passiveUntil=w.time+2.4;e.ai.healTick=w.time+.4;notice(w,'passive',{id:e.id,name:'不息生长'});}
  return null;
 }
 if(d.id==='B02'||d.id==='B11'){
  e.ai.nextPassive=w.time+12;
  return {id:'passive-summon',name:d.passive,kind:'passive',passive:true,steps:[{name:d.id==='B02'?'育巢产卵':'亡者敕令',type:d.id==='B02'?'egg':'summon',style:d.id==='B02'?'web':'bone',windup:1.05,active:.2,recover:.55}],cd:12};
 }
 return null;
}
function navigate(w,e,d,dt,hooks){
 const p=w.player,dx=p.x-e.x,abs=Math.abs(dx),root=e.rootUntil>w.time;
 const slow=Math.min(e.slowUntil>w.time?.45:1,e.frostSnareUntil>w.time?.65:1);
 if(d.flying){
  const tx=p.x-Math.sign(dx||e.face)*(d.ranged?280:90),ty=p.y-65;
  let desiredY=clamp(ty,60+e.h*.5,w.floor-45);
  const obstruction=firstTerrainHit(w,e.x,e.y-e.h*.5,tx,desiredY-e.h*.5);
  // Flying units can cross one-way decks just as a player can drop through
  // them. Only actual solid cover forces their navigation above the obstacle.
  if(obstruction&&!obstruction.box.source)desiredY=Math.max(e.h+25,e.y-140);
  e.vx=lerp(e.vx,root?0:clamp((tx-e.x)*2,-d.speed,d.speed)*slow,1-Math.exp(-5*dt));e.vy=lerp(e.vy,clamp((desiredY-e.y)*3,-200,200),1-Math.exp(-5*dt));
 }else{
  let tx=p.x+(e.flankOffset||0),ty=p.y;
  if(d.boss&&p.y<e.y-100){const ledges=w.platforms.filter(b=>b.active&&b.y<e.y-35&&b.y>=e.y-265&&b.w>e.w*2&&Math.abs(b.x+b.w/2-e.x)<470).sort((a,b)=>(Math.abs(a.x+a.w/2-p.x)+Math.abs(a.y-p.y))-(Math.abs(b.x+b.w/2-p.x)+Math.abs(b.y-p.y)));if(ledges[0]){tx=clamp(p.x,ledges[0].x+e.w,ledges[0].x+ledges[0].w-e.w);ty=ledges[0].y;}}
  if(p.y>e.y+95&&e.grounded){const ledge=w.platforms.find(b=>b.id===e.platformId);if(ledge&&ledge.id!=='ground')tx=dx>0?ledge.x+ledge.w+e.w+10:ledge.x-e.w-10;}
  const travel=tx-e.x,spacing=e.owner?8:d.ranged?280:d.boss?135:70;
  let dir=Math.abs(travel)>spacing?Math.sign(travel):d.ranged&&abs<190?-Math.sign(dx):0;
  // Ranged actors must advance around blocked sightlines, rather than parking
  // forever at their preferred spacing behind a short ledge or cover.
  const origin=enemyCastOrigin(w,e);
  if(d.ranged&&!clearLine(w,origin.x,origin.y,p.x,p.y-p.h*.5))dir=Math.sign(dx);
  if(!d.ranged&&!clearLine(w,e.x,e.y-Math.min(e.h*.42,75),p.x,p.y-45)&&abs>e.w+p.w)dir=Math.sign(dx);
  if(ty<e.y-50)dir=Math.abs(travel)>25?Math.sign(travel):0;
  e.vx=lerp(e.vx,root?0:dir*d.speed*slow,1-Math.exp(-10*dt));
  const wall=(w.obstacles||[]).some(b=>b.actor!==false&&b.active!==false&&b.y<e.y&&b.y+b.h>e.y-10&&Math.abs(b.x+b.w/2-e.x)<e.w+85&&Math.sign(b.x+b.w/2-e.x)===Math.sign(travel));
  if(d.boss&&!root&&e.grounded&&w.time>e.ai.jumpAt&&((ty<e.y-45&&Math.abs(travel)<380)||wall)){e.vy=-740;e.ai.jumpAt=w.time+.8;e.jumps=1;e.grounded=false;}
  else if(d.boss&&!root&&!e.grounded&&e.jumps===1&&e.vy>-80&&ty<e.y-55){e.vy=-650;e.jumps=2;}
 }
 if(abs>e.w*.5)e.face=Math.sign(dx||e.face);
 e.ai.state=Math.abs(e.vx)>15?'walk':'idle';
}
export function updateEnemies(w,dt,hooks){
 if(!w.enemyMode||w.duel)return;
 statusTick(w,dt,hooks);
 for(const e of [...w.targets]){
  if(e.egg){updateEgg(w,e,dt,hooks);continue;}if(!e.enemyKind)continue;
  const d=ENEMIES[e.enemyKind],ai=e.ai;e.hit=Math.max(0,e.hit-dt);ai.stagger=Math.max(0,ai.stagger-dt);ai.poise=Math.max(0,ai.poise-dt*8);
  if(e.hp<=0)continue;
  if(e.fallingSpawn){e.ai.state='spawn';e.vx=0;hooks.physics(w,e,dt);if(e.grounded){e.fallingSpawn=false;e.ai.readyAt=w.time+.7;notice(w,'spawnLanded',{id:e.id});fx(w,hooks,e.themeStyle||'rock',{x:e.x,y:e.y,radius:30,duration:.35});}continue;}
  if(w.time>e.expires){e.hp=0;e.diedAt=w.time;e.deadUntil=Infinity;ai.attack=null;continue;}
  if(e.burnUntil>w.time&&w.time>=e.nextBurn){e.nextBurn+=.75;hooks.damage(w,e,4,{impact:false});if(e.hp<=0)continue;}
  if(d.boss&&e.hp/e.maxHp<=.5&&ai.phase===1){ai.phase=2;notice(w,'phase',{id:e.id,phase:2});fx(w,hooks,d.form==='wolf'?'ice':'star',{x:e.x,y:e.y-e.h*.4,radius:85,duration:.8,enemyKind:e.enemyKind});}
  if(ai.passiveUntil>w.time&&e.hp>0&&ai.stagger<=0&&w.time>=ai.healTick){ai.healTick+=.4;const heal=Math.min(16,e.maxHp-e.hp);e.hp+=heal;if(heal){fx(w,hooks,'heal',{x:e.x,y:e.y-e.h*.6,radius:65,duration:.65,enemyKind:e.enemyKind,ground:true});notice(w,'healed',{id:e.id,amount:heal});}}
  if(d.id==='B10'&&alive(w.player)&&Math.abs(w.player.x-e.x)<260&&!w.player.enemyControl)w.player.vx+=(e.x-w.player.x)*dt*.25;
  if(!alive(w.player)){ai.attack=null;e.vx*=Math.exp(-8*dt);ai.state='idle';}
  else if(ai.stagger>0){e.vx*=Math.exp(-8*dt);ai.state='stagger';}
  else if(ai.state==='hatch'&&w.time<ai.readyAt){e.vx=e.emergeDir*85;}
  else if(ai.state==='spawn'&&w.time<ai.readyAt){e.vx=0;}
  else if(ai.attack)updateAttack(w,e,d,dt,hooks);
  else{
   const passive=passivePlan(w,e,d,hooks);if(passive)startPlan(w,e,passive);
   else{
    navigate(w,e,d,dt,hooks);
    const plan=w.time>=ai.readyAt?choosePlan(w,e,d):null;
    const origin=plan?.steps[0]?.type==='projectile'?enemyCastOrigin(w,e):{x:e.x,y:e.y-Math.min(e.h*.42,75)};
    const targetedArea=plan?.steps[0]?.type==='zone';
    if(plan&&Math.abs(w.player.y-e.y)<(plan.kind==='melee'?100:260)&&(targetedArea||clearLine(w,origin.x,origin.y,w.player.x,w.player.y-55)))startPlan(w,e,plan);
   }
  }
  if(e.rootUntil>w.time)e.vx=0;else e.vx+=(e.fieldForce||0)*dt;
  if(d.flying){e.prevX=e.x;e.prevY=e.y;e.x=clamp(e.x+e.vx*dt,e.w+12,w.width-e.w-12);e.y=clamp(e.y+e.vy*dt,e.h+18,w.floor-15);resolveSolidSides(w,e,e.prevX,e.prevY);e.grounded=false;}
  else{hooks.physics(w,e,dt);if(e.grounded)e.jumps=0;}
  e.cycle+=Math.abs(e.vx)*dt/Math.max(14,e.visual*.16);
 }
 updateZones(w,dt,hooks);
 w.targets=w.targets.filter(e=>!(e.enemyKind||e.egg)||e.hp>0||w.time-(e.diedAt??w.time)<2.2);
}
export function enemyAnimationFrame(e,time){
 if(e.hp<=0)return time-(e.diedAt??time)<.35?14:15;
 if(e.egg)return 0;
 if(e.ai.stagger>0)return 13;if(e.hit>.06)return 12;
 if(e.ai.state==='spawn')return 6;
 if(e.ai.state==='hatch')return 11;
 const a=e.ai.attack,s=stepPlan(e);
 if(a&&s){if(a.age<s.windup)return 7;if(a.age<s.windup+s.active)return s.type==='egg'||s.type==='summon'?11:s.type==='projectile'||s.type==='zone'?10:8;return 9;}
 if(e.ai.passiveUntil>time&&Math.abs(e.vx)<12)return 11;
 return Math.abs(e.vx)>12||ENEMIES[e.enemyKind]?.flying?Math.floor(e.cycle*1.7+time*(ENEMIES[e.enemyKind]?.flying?9:0))%6:6;
}
