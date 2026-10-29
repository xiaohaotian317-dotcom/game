import {EXTRA_HEROES} from './hero-roster.mjs?v=20261029-combat7';
import {groundTarget,resolveGroundTarget} from './targeting.mjs?v=20261029-combat7';
import {segmentBox,clearLine} from './collision.mjs?v=20261029-combat7';
import {targetPose} from './character-rig.mjs?v=20261029-combat7';
import {RECAST_WINDOWS} from './controls.mjs?v=20261029-combat7';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function initExtra(w,hero){
  w.fields=[];w.constructs=[];w.iceMirrors=[];w.portals=[];w.ghosts=[];w.roleState={nextShield:8,backstabAt:0,starLastCast:0,starCasts:[]};
  w.player.shield=w.hero==='frost'?18:0;w.player.charge=0;w.player.stars=0;
  w.player.maxHp=hero.maxHp||120;w.player.hp=w.player.maxHp;
}
function recast(w,key,data={}){const r=EXTRA_HEROES[w.hero].recast;w.player.recast={...r,key,name:r.name,until:w.time+r.window,start:w.time,...data};}
function point(w,c){const x=clamp(c.x,w.player.x-520,w.player.x+520);return resolveGroundTarget(w,c.target&&Math.abs(c.target.x-w.player.x)<=520?c.target:null)||groundTarget(w,x,c.y);}
function field(w,kind,t,data={}){const f={id:++w.serial,kind,x:t.x,y:t.y,anchor:t,age:0,until:w.time+(data.duration||2.5),nextTick:w.time+(data.delay||0),...data};w.fields.push(f);return f;}
function burst(w,c,data){w.player.burst={id:++w.serial,age:0,until:w.time+data.duration,hitIds:[],source:c.key,variant:c.variant,...data};}
function teleport(w,a,x,y){a.x=a.prevX=x;a.y=a.prevY=y;a.vx=0;a.vy=0;a.grounded=false;a.platformId=null;if(a===w.player)a.invuln=Math.max(a.invuln,.15);}
export function releaseExtra(w,c,api){
  if(!EXTRA_HEROES[w.hero])return false;
  const p=w.player,h=w.hero,s=api.castMuzzle(w),dx=w.aim.x-s.x,dy=w.aim.y-s.y,length=Math.hypot(dx,dy)||1,d={x:dx/length,y:dy/length};
  if(c.key==='attack'){
    if(h==='shadow'||h==='lightning'){
      const thunder=h==='lightning',reach=thunder?100:110;
      api.effect(w,thunder?'thunderPunch':'shadowSlash',{x:p.x+p.face*26,y:p.y-57,face:p.face,originX:p.x,duration:thunder?.38:.35});
      for(const t of w.targets)if(t.hp>0&&(t.x-p.x)*p.face>-8&&(t.x-p.x)*p.face<reach&&Math.abs(t.y-p.y)<85&&clearLine(w,p.x,p.y-45,t.x,t.y-40))api.damage(w,t,thunder?20:18,{school:h,basic:true,knock:p.face*(thunder?95:75)});
      api.damageBridge(w,p.x+p.face*55,p.y-25,60,thunder?20:18);
    }else{
      const enhanced=h==='star'&&p.stars>=3;
      api.projectile(w,h==='frost'?'iceNeedle':h==='lightning'?'arc':'starBolt',s.x,s.y,d.x,d.y,h==='lightning'?900:h==='frost'?820:700,enhanced?27:h==='lightning'?20:16,{owner:'player',school:h,basic:true,homing:enhanced,life:h==='lightning'?.5:3.5});
      if(enhanced)p.stars=0;
      api.effect(w,h+'Cast',{x:s.x,y:s.y,angle:Math.atan2(d.y,d.x),duration:.24});
    }
    api.emit(w,'attack',{hero:h});return true;
  }
  if(c.variant==='iceShatter'){
    const platform=w.platforms.find(b=>b.id===c.data?.platformId);
    if(platform){platform.active=false;w.platforms=w.platforms.filter(b=>b!==platform);w.constructs=w.constructs.filter(b=>b.platformId!==platform.id);api.area(w,platform.x+platform.w/2,platform.y-25,160,30,{school:h,root:.35});api.effect(w,'iceShatter',{x:platform.x+platform.w/2,y:platform.y,duration:.75});}
    api.emit(w,'iceShatter');return true;
  }
  if(c.variant==='shadowReturn'){
    const mark=w.roleState.shadowMark;
    if(mark){const target=resolveGroundTarget(w,mark.anchor)||groundTarget(w,mark.x,mark.y);api.effect(w,'shadowFlash',{x:p.x,y:p.y-50,duration:.45});teleport(w,p,target?.x??mark.x,target?.y??mark.y);api.effect(w,'shadowFlash',{x:p.x,y:p.y-50,duration:.45});w.roleState.shadowMark=null;}
    api.emit(w,'shadowReturn');return true;
  }
  if(c.variant==='starRepulse'){
    const f=w.fields.find(f=>f.id===c.data?.fieldId);if(f){f.until=w.time;api.area(w,f.x,f.y-45,210,30,{school:h,knock:480,castId:c.id});api.effect(w,'starRepulse',{x:f.x,y:f.y-45,duration:.8});}api.emit(w,'starRepulse');return true;
  }
  const target=point(w,c);
  if(h==='frost'){
    if(c.key==='q'){
      const x=clamp(c.x,p.x-420,p.x+420),y=clamp(c.y,125,w.floor-65),id='ice-'+(++w.serial);
      w.platforms.push({id,x:clamp(x-75,8,w.width-158),y,w:150,type:'ice',active:false,hp:Infinity,maxHp:Infinity});w.constructs.push({id,kind:'icePlatform',platformId:id,x,y,age:0,until:w.time+6});recast(w,'q',{data:{platformId:id}});api.effect(w,'frostCast',{x,y,duration:.55});
    }
    if(c.key==='e'){w.iceMirrors.push({id:++w.serial,x:clamp(p.x+p.face*90,25,w.width-25),y:p.y-62,until:w.time+2.7});api.effect(w,'frostCast',{x:p.x+p.face*90,y:p.y-62,duration:.45});}
    if(c.key==='r'&&target)field(w,'frostDomain',target,{r:185,duration:3.2,delay:.18,castId:c.id});
    api.emit(w,'frostSkill',{key:c.key});
  }
  if(h==='lightning'){
    if(c.key==='q'){
      const turn=c.variant==='thunderTurn',ax=turn?clamp(c.x-p.x,-420,420):p.face*240,ay=turn?clamp(c.y-p.y+45,-200,200):0,l=Math.hypot(ax,ay)||1;
      burst(w,c,{kind:'thunderRush',duration:.2,vx:ax/l*1050,vy:ay/l*1050,damage:turn?27:24,phase:true,dodgeProjectiles:true,canRecast:!turn});p.invuln=Math.max(p.invuln,.23);api.effect(w,'thunderRush',{x:p.x,y:p.y-55,face:p.face,duration:.4});
    }
    if(c.key==='e'){
      const candidates=w.platforms.filter(b=>b.active&&b.y<p.y-35&&Math.abs(b.x+b.w/2-p.x)<560).sort((a,b)=>Math.abs(a.x+a.w/2-c.x)+Math.abs(a.y-c.y)-Math.abs(b.x+b.w/2-c.x)-Math.abs(b.y-c.y)),b=candidates[0];
      const tx=b?clamp(c.x,b.x+22,b.x+b.w-22):clamp(p.x+p.face*100,30,w.width-30),ty=b?b.y-5:p.y-180;
      api.effect(w,'thunderTether',{x:p.x,y:p.y-55,toX:tx,toY:ty-12,duration:.4});burst(w,c,{kind:'magnetLeap',duration:.28,vx:(tx-p.x)/.28,vy:(ty-p.y)/.28,phase:true,target:b?{x:tx,y:b.y,platformId:b.id,offsetX:tx-b.x}:null});
    }
    if(c.key==='r'&&target){
      const enemy=w.targets.filter(t=>t.hp>0&&Math.abs(t.x-p.x)<560&&Math.hypot(t.x-c.x,t.y-40-c.y)<155).sort((a,b)=>Math.hypot(a.x-c.x,a.y-40-c.y)-Math.hypot(b.x-c.x,b.y-40-c.y))[0];
      const face=Math.sign((enemy?.x??target.x)-p.x)||p.face;
      const landing=enemy?(groundTarget(w,clamp(enemy.x-face*54,25,w.width-25),enemy.y-.1)||target):target;
      p.face=face;p.invuln=Math.max(p.invuln,.29);
      api.effect(w,'thunderTether',{x:p.x,y:p.y-60,toX:landing.x,toY:landing.y-40,duration:.4});
      burst(w,c,{kind:'thunderDive',duration:.24,vx:(landing.x-p.x)/.24,vy:(landing.y-p.y)/.24,phase:true,dodgeProjectiles:true,target:landing});
    }
    api.emit(w,'thunderSkill',{key:c.key});
  }
  if(h==='shadow'){
    if(c.key==='q'){burst(w,c,{kind:'shadowRush',duration:.21,vx:p.face*1000,vy:0,damage:25,phase:true,dodgeProjectiles:true});p.invuln=Math.max(p.invuln,.24);api.effect(w,'shadowRush',{x:p.x,y:p.y-55,face:p.face,duration:.5});}
    if(c.key==='e'&&target){const anchor=groundTarget(w,p.x,p.y);w.roleState.shadowMark={x:p.x,y:p.y,face:p.face,anchor,until:w.time+RECAST_WINDOWS.shadow};api.effect(w,'shadowFlash',{x:p.x,y:p.y-50,duration:.45});teleport(w,p,target.x,target.y);recast(w,'e');api.effect(w,'shadowFlash',{x:p.x,y:p.y-50,duration:.45});}
    if(c.key==='r'&&target)field(w,'shadowStorm',target,{r:190,duration:1.4,delay:.1,castId:c.id});
    api.emit(w,'shadowSkill',{key:c.key});
  }
  if(h==='star'){
    if(c.key==='q'&&target){const f=field(w,'gravityWell',target,{r:185,duration:RECAST_WINDOWS.star+.7,castId:c.id});recast(w,'q',{data:{fieldId:f.id}});}
    if(c.key==='e'&&target){w.portals.push({id:++w.serial,a:{x:p.x,y:p.y,anchor:groundTarget(w,p.x,p.y)},b:{...target,anchor:target},until:w.time+4});api.effect(w,'portalFlash',{x:p.x,y:p.y-55,duration:.5});}
    if(c.key==='r'&&target)field(w,'starCollapse',target,{r:205,duration:1.4,delay:.55,castId:c.id});
    api.emit(w,'starSkill',{key:c.key});
  }
  return true;
}
export function extraOnHit(w,t,amount,opts,api){
  const p=w.player;
  if(w.hero==='frost'&&opts.basic)t.slowUntil=w.time+1.2;
  if(w.hero==='lightning'&&opts.basic&&p.charge>=100){p.charge=0;p.passiveGlow=.8;api.damage(w,t,13,{school:'lightning',source:'overload',knock:p.face*90});api.effect(w,'electricBurst',{x:t.x,y:t.y-45,duration:.6});api.emit(w,'chargedHit');}
  if(w.hero==='shadow'&&opts.basic&&w.time>=w.roleState.backstabAt&&(p.x-t.x)*(t.face||-1)<0){w.roleState.backstabAt=w.time+1;p.passiveGlow=.65;api.damage(w,t,7,{school:'shadow',label:'7 背袭',source:'backstab'});}
  if(w.hero==='star'&&!opts.basic&&opts.castId&&!w.roleState.starCasts.includes(opts.castId)){w.roleState.starCasts.push(opts.castId);if(w.roleState.starCasts.length>64)w.roleState.starCasts.shift();p.stars=Math.min(3,p.stars+1);p.passiveGlow=.6;}
}
export function extraBefore(w,dt,api){
  if(!w.roleState)return;const p=w.player;
  for(const t of w.targets)t.fieldForce=0;
  if(w.hero==='frost'&&w.time>=w.roleState.nextShield){w.roleState.nextShield=w.time+8;if(p.shield<=0){p.shield=18;p.passiveGlow=.75;api.effect(w,'frostCast',{x:p.x,y:p.y-55,duration:.6});}}
  if(w.hero==='lightning'){const before=p.charge;p.charge=clamp(p.charge+Math.abs(p.x-p.prevX)*.1,0,100);if(before<100&&p.charge>=100){p.passiveGlow=.8;api.emit(w,'charged');}}
  for(const a of w.constructs){a.age+=dt;const b=w.platforms.find(b=>b.id===a.platformId);if(b)b.active=a.age>=.22&&w.time<a.until;}
  const expired=w.constructs.filter(a=>w.time>=a.until);for(const a of expired){w.platforms=w.platforms.filter(b=>b.id!==a.platformId);api.effect(w,'iceShatter',{x:a.x||0,y:a.y||0,duration:.5});}w.constructs=w.constructs.filter(a=>w.time<a.until);
  w.iceMirrors=w.iceMirrors.filter(m=>w.time<m.until);
  for(const f of w.fields){
    f.age+=dt;const supported=w.platforms.some(b=>b.id===f.anchor?.platformId&&b.active),anchor=supported?resolveGroundTarget(w,f.anchor):null;if(anchor){f.x=anchor.x;f.y=anchor.y;}else f.until=w.time;
    if(w.time>=f.until)continue;
    const targets=w.targets.filter(t=>t.hp>0&&Math.hypot(t.x-f.x,t.y-45-(f.y-45))<f.r);
    if(f.kind==='gravityWell'||(f.kind==='starCollapse'&&f.age<.55))for(const t of targets)t.fieldForce+=clamp((f.x-t.x)*9,-1600,1600);
    if(f.kind==='frostDomain')for(const t of targets)t.slowUntil=w.time+.65;
    if(w.time>=f.nextTick){
      if(f.kind==='frostDomain'){for(const t of targets)api.damage(w,t,f.triggered?5:24,{school:'frost',root:f.triggered?0:.8,impact:!f.triggered,castId:f.castId});f.triggered=true;f.nextTick=w.time+.48;}
      if(f.kind==='shadowStorm'){for(const t of targets)api.damage(w,t,11,{school:'shadow',castId:f.castId,impact:false});api.effect(w,'shadowSlash',{x:f.x+Math.sin(f.age*25)*60,y:f.y-55,face:f.age%1>.5?1:-1,duration:.22});f.nextTick=w.time+.23;}
      if(f.kind==='gravityWell'){for(const t of targets)api.damage(w,t,4,{school:'star',castId:f.castId,impact:false});f.nextTick=w.time+.5;}
      if(f.kind==='starCollapse'&&!f.triggered){f.triggered=true;api.area(w,f.x,f.y-45,f.r,60,{school:'star',knock:240,castId:f.castId});api.effect(w,'starCollapseBurst',{x:f.x,y:f.y-45,duration:1});w.shake=13;w.hitstop=.065;api.emit(w,'starCollapse');f.nextTick=Infinity;}
    }
  }
  w.fields=w.fields.filter(f=>w.time<f.until);
  w.portals=w.portals.filter(f=>w.time<f.until);
  for(const pair of w.portals){
    for(const n of [pair.a,pair.b]){const anchor=resolveGroundTarget(w,n.anchor);if(anchor){n.x=anchor.x;n.y=anchor.y;}}
    for(const a of [p,...w.targets,...(w.fox?[w.fox]:[])])if(w.time>=(a.portalAt||0)&&a.hp>0){const entry=[pair.a,pair.b].find(n=>Math.abs(a.x-n.x)<27&&Math.abs(a.y-n.y)<65);if(entry){const exit=entry===pair.a?pair.b:pair.a;a.portalAt=w.time+.75;api.effect(w,'portalFlash',{x:a.x,y:a.y-55,duration:.4});teleport(w,a,clamp(exit.x+(a.face||1)*32,30,w.width-30),exit.y-2);api.effect(w,'portalFlash',{x:a.x,y:a.y-55,duration:.4});api.emit(w,'portalTravel');}}
  }
  for(const g of w.ghosts)g.age+=dt;w.ghosts=w.ghosts.filter(g=>g.age<(g.duration||.65));
}
export function extraAfter(w,dt,api){
  const p=w.player,b=p.burst;if(!b)return;b.age+=dt;
  if(b.damage){for(const t of w.targets)if(t.hp>0&&!b.hitIds.includes(t.id)&&segmentBox(p.prevX,p.prevY-50,p.x,p.y-50,{x:t.x-t.w,y:t.y-t.h,w:t.w*2,h:t.h},24)!==null){b.hitIds.push(t.id);api.damage(w,t,b.damage,{school:w.hero,knock:Math.sign(b.vx)*150});if(b.canRecast&&!b.opened){b.opened=true;recast(w,'q');}}}
  if((w.hero==='shadow'||w.hero==='lightning')&&(!b.lastGhost||w.time-b.lastGhost>.027)){b.lastGhost=w.time;w.ghosts.push({x:p.x,y:p.y,face:p.face,age:0,duration:w.hero==='shadow'?.8:.42,cycle:p.cycle,grounded:p.grounded,pose:targetPose(w)});if(w.ghosts.length>10)w.ghosts.shift();}
  if(w.time>=b.until){
    if(b.kind==='magnetLeap'&&b.target){const t=resolveGroundTarget(w,b.target);if(t)teleport(w,p,t.x,t.y-2);}
    if(b.kind==='thunderDive'){const t=resolveGroundTarget(w,b.target)||b.target;teleport(w,p,t.x,t.y-1);api.area(w,t.x,t.y-40,165,58,{school:'lightning',knock:290});api.effect(w,'thunderImpact',{x:t.x,y:t.y,duration:.85});w.shake=14;w.hitstop=.065;api.emit(w,'thunderImpact');}
    p.burst=null;
  }
}
export function extraMirrorContact(w,s){
  if(s.owner!=='enemy')return null;let hit=null;for(const m of w.iceMirrors||[]){if(s.iceMirrorId===m.id)continue;const t=segmentBox(s.px,s.py,s.x,s.y,{x:m.x-8,y:m.y-58,w:16,h:116},s.r);if(t!==null&&(!hit||t<hit.t))hit={t,type:'iceMirror',mirror:m};}return hit;
}
export function reflectExtra(w,s,m,api){s.vx*=-1;s.x+=Math.sign(s.vx)*12;s.owner='player';s.school='frost';s.fire=false;s.damage=Math.round(s.damage*1.15);s.iceMirrorId=m.id;s.life=Math.max(s.life,s.age+2);api.effect(w,'frostHit',{x:m.x,y:s.y,duration:.5});api.emit(w,'iceReflect');}
