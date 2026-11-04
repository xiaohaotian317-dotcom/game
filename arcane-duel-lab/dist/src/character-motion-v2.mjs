// campaign11 remains intact. ?motion=legacy restores its complete motion path.
import * as legacy from './character-rig-legacy.mjs';
export const {RIGS,rotatePoint,jointEnd,solveLimb,partTransform,armChain,weaponTip}=legacy;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
let version=(typeof location!=='undefined'&&new URLSearchParams(location.search).get('motion')==='legacy')||(typeof window!=='undefined'&&window.arcaneDesktop?.motionVersion==='legacy')?'legacy':'v2';
export const characterMotionVersion=()=>version;
// Comparison viewer only: no profile, gameplay or save changes.
export function setCharacterMotionVersion(value){version=value==='legacy'?'legacy':'v2';}
export const basePose=()=>({...legacy.basePose(),head:0,hair:0,cloth:0,spread:0,twist:0});
const STYLE={
 fire:{lean:.13,crouch:2.7,breath:2.25,phase:0,head:-.04,tuck:1.15,split:.68,double:'staff'},
 nature:{lean:.115,crouch:3.4,breath:1.85,phase:.8,head:-.035,tuck:1.27,split:.76,double:'bound'},
 frost:{lean:.10,crouch:2.3,breath:2.05,phase:1.5,head:-.035,tuck:1.10,split:.48,double:'fold'},
 lightning:{lean:.12,crouch:5,breath:2.6,phase:2.1,head:-.025,tuck:1.55,split:.95,double:'kick'},
 shadow:{lean:.085,crouch:5.2,breath:2.35,phase:2.9,head:-.012,tuck:1.75,split:1.05,double:'scissor'},
 star:{lean:.095,crouch:2.4,breath:1.7,phase:3.7,head:-.035,tuck:1.12,split:.57,double:'orbit'}
};
export function flightPose(hero,p,time=0){
 if(version==='legacy')return legacy.flightPose(hero,p,time);
 const f=STYLE[hero]||STYLE.fire,vy=p.vy||0,age=Math.max(0,time-(p.jumpAt??-99));
 const launch=smooth((-vy-420)/260),fall=smooth((vy+140)/580),hang=Math.exp(-((vy/210)**2));
 const gather=smooth(age/.11)*(1-smooth((age-.27)/.3));
 const o={air:1,legA:mix(.40,.08,fall)+gather*.24,kneeA:mix(f.tuck,.20,fall)*(1-launch*.48),
  legB:mix(-.25,-.14,fall)-gather*.12,kneeB:mix(.65,.16,fall),
  armA:.25+hang*.10,elbowA:1.1+hang*.14,armB:-.22-f.split*.22+fall*.22,elbowB:.18+fall*.3,
  weapon:.25-fall*.12,cape:-.14-launch*.12+fall*.10,head:-.012+fall*.028,twist:0,cloth:-launch*.9+fall*.6};
 // Gather -> asymmetric re-launch -> open -> landing. Triggered by real input,
 // independent of frame count, and preserved by snapshots/pause/hero switches.
 if(p.jumps>1){
  const curl=smooth(age/.065)*(1-smooth((age-.16)/.17));
  const open=smooth((age-.10)/.15)*(1-smooth((age-.33)/.25)),sign=f.double==='scissor'?-1:1;
  o.legA+=f.split*curl*sign;o.kneeA+=.75*curl;
  o.legB-=f.split*.55*curl*sign;o.kneeB+=.85*curl;
  if(f.double==='kick'){o.legA+=open*.58;o.kneeA-=open*.72;o.legB-=open*.32;}
  else if(f.double==='scissor'){o.legA+=open*1.1;o.legB-=open*.65;o.kneeA-=open*.6;o.kneeB+=open*.2;}
  else if(f.double==='bound'){o.legA+=open*.26;o.legB-=open*.46;o.kneeB-=open*.22;}
  else if(f.double==='fold'){o.legA-=open*.24;o.kneeB+=open*.48;}
  else if(f.double==='orbit'){o.legA+=open*.30;o.legB+=open*.20;o.twist=.075*curl;}
  else{o.legA+=open*.2;o.legB-=open*.22;o.weapon-=open*.20;}
  o.armA+=.22*curl-.08*open;o.elbowA+=.16*curl+.20*open;
  o.armB-=.35*curl;o.elbowB-=.26*curl;o.head-=curl*.035;
  o.twist+=.055*curl*sign-.035*open;o.cloth-=curl*1.5;
  o.cape-=.16*curl;o.hair=-1.2*curl+.5*open;
 }
 return o;
}
export function attackPhases(c){
 const r=Math.max(.001,c.releaseAt),end=Math.max(.001,c.duration-r),a=Math.max(0,c.age);
 return {load:smooth(a/(r*.65))*(1-smooth((a-r*.5)/(r*.5))),
  reach:smooth((a-r*.45)/(r*.55))*(1-smooth((a-r)/end)),recover:smooth((a-r)/end)};
}
export function targetPose(w){
 if(version==='legacy')return {...basePose(),...legacy.targetPose(w)};
 const p=w.player,f=STYLE[w.hero],t=w.time,move=clamp(p.vx*p.face/340,-1,1),v=Math.abs(move),phase=p.cycle||0;
 const breath=Math.sin(t*f.breath+f.phase),o=basePose();
 Object.assign(o,{lean:f.lean+move*.055+breath*.009,bob:f.crouch+breath*.65,spread:1,
  head:f.head+Math.sin(t*f.breath-.65+f.phase)*.016,hair:Math.sin(t*1.9+f.phase)*.55-move*.9,
  cloth:Math.sin(t*1.65+f.phase-.6)*.7-move*.6,cape:-move*.15+Math.sin(t*1.4+f.phase)*.025,
  armA:.25+breath*.018,elbowA:1.12+breath*.028,armB:.05+Math.sin(t*f.breath-.55)*.035,
  elbowB:.55+breath*.025,weapon:.22+breath*.015});
 if(w.hero==='lightning')Object.assign(o,{armA:.35+breath*.025,elbowA:1.9+breath*.035,armB:.25,elbowB:2,weapon:0});
 if(w.hero==='shadow')Object.assign(o,{armA:.22+breath*.025,elbowA:.75,armB:.05,elbowB:.8,weapon:.5});
 if(w.hero==='frost')o.weapon=.08;
 if(w.hero==='star')Object.assign(o,{armA:.5,elbowA:1.25,armB:.05,elbowB:.6,weapon:.08});
 if(p.grounded){
  o.bob+=(2+Math.cos(phase*2)*1.2)*v;o.lean+=Math.sin(phase)*.012*v;
  o.armA+=Math.sin(phase)*.17*v;o.elbowA-=Math.sin(phase)*.13*v;
  o.armB-=Math.sin(phase)*.32*v;o.elbowB-=Math.sin(phase)*.23*v;o.head-=Math.cos(phase*2)*.012*v;
 }else{
  Object.assign(o,flightPose(w.hero,p,t));o.lean=f.lean+move*.07+o.twist;
  if(w.hero==='lightning'){o.armA=.4;o.elbowA=1.8;}
  if(w.hero==='shadow'){o.armA=.38;o.elbowA=.85;o.weapon=.55;}
 }
 if(p.land>0){const s=Math.sin(clamp(p.land/.18,0,1)*Math.PI);o.bob+=s*(4+3*(p.landImpact??.7));o.lean+=s*.035;o.head-=s*.025;o.cloth+=s*.8;}
 if(p.cast){
  const c=p.cast,{load,reach}=attackPhases(c),n=w.hero==='nature';
  if(c.key==='attack'){
   const a=Math.atan2(w.aim.y-(p.y-119),Math.max(24,(w.aim.x-p.x)*p.face));
   if(w.hero==='lightning'){
    const punch=solveLimb(46,22,28,29,-1);
    o.armA=.35-.48*load+(punch[0]-.35)*reach;o.elbowA=1.9+.62*load+(punch[1]-1.9)*reach;
    o.armB=.25-.18*load+.1*reach;o.elbowB=2+.12*load;
    o.shift=-3*load+5*reach;o.bob+=2*load-1.5*reach;o.lean+=-.035*load+.07*reach;o.strike=reach;
   }else if(w.hero==='shadow'){
    o.armA=.22-.40*load+1.18*reach;o.elbowA=.75+.35*load+.82*reach;
    o.weapon=.5-.55*load+.8*reach;o.armB=.05-.15*load+.32*reach;o.elbowB=.8+.18*reach;
    o.shift=-2*load+5*reach;o.lean+=-.035*load+.075*reach;o.bob+=1.6*load;o.strike=reach;
   }else{
    const aim=solveLimb(Math.cos(a)*44,Math.sin(a)*21+10,28,29,-1);
    o.armA+=-.20*load+(aim[0]-o.armA)*reach;o.elbowA+=.23*load+(aim[1]-o.elbowA)*reach;
    o.weapon+=-.12*load+(a+Math.PI/2-.07-o.weapon)*reach;
    o.shift=-2*load+2.8*reach;o.lean+=-.025*load+.045*reach;o.bob+=1.2*load-.5*reach;o.strike=.45*reach;
   }
  }else{
   // Preserve calibrated skill-arm limits and relaxed staff-user free hands.
   const old=legacy.targetPose(w),weight=smooth(c.age/Math.max(.001,c.releaseAt))*(1-smooth((c.age-c.releaseAt)/Math.max(.001,c.duration-c.releaseAt)));
   for(const k of ['armA','elbowA','weapon'])o[k]=old[k];
   o.armA-=.075*load;o.elbowA+=.09*load;o.weapon-=.05*load;
   o.lean+=weight*(c.key==='r'?.018:.04);o.shift+=weight*1.5;o.bob+=weight*(n&&c.key==='q'?5:-.7);
   if(!['fire','nature'].includes(w.hero)){o.armB=old.armB;o.elbowB=old.elbowB;}
  }
  if(['fire','nature'].includes(w.hero)){o.armB=.05;o.elbowB=.55;}
  o.head+=.018*load-.035*reach;o.hair+=.7*load-1.2*reach;o.cloth+=load-.8*reach;
 }
 if(p.dash>0||p.burst){o.lean=.28;o.legA=.65;o.kneeA=.9;o.legB=-.58;o.kneeB=.35;o.cape=-.32;o.head=-.025;o.cloth=-2;}
 if(p.stomp){o.lean=.20;o.armA=1.35;o.elbowA=2.25;o.weapon=.08;o.legA=.40;o.kneeA=.7;o.legB=-.2;o.kneeB=.35;}
 if(p.hurt>0){const h=clamp(p.hurt/.24,0,1);o.lean-=.12*h;o.bob+=2*h;o.head+=.04*h;}
 if(p.dead>0)Object.assign(o,{bob:22,lean:-.25,legA:.65,kneeA:1.5,legB:-.35,kneeB:1.2,armA:.15,elbowA:.3,weapon:.75,head:.035});
 return o;
}
export function blendPose(current,target,dt,isR=false,isPunch=false){
 if(version==='legacy')return legacy.blendPose(current,target,dt,isR,isPunch);
 const delta=clamp(Number.isFinite(dt)?dt:1/60,0,.05);if(!delta)return current;
 const limits={armA:isR?2.4:isPunch?18:10,armB:isR?2.4:9,elbowA:isR?3.2:isPunch?20:14,elbowB:12,weapon:isR?1.5:9,lean:2,legA:11,legB:11,kneeA:14,kneeB:14,bob:100,cape:3,shift:100,strike:16,head:1.1,hair:22,cloth:22,twist:2,spread:6};
 for(const k of Object.keys(current)){const rate=['hair','cloth','cape'].includes(k)?12:k==='head'?18:k==='air'?40:isPunch&&['armA','elbowA'].includes(k)?48:30;
  const change=((target[k]??0)-current[k])*(1-Math.exp(-rate*delta)),max=(limits[k]??100)*delta;current[k]+=clamp(change,-max,max);}
 return current;
}
export function legChain(w,pose,back=false){
 if(version==='legacy')return legacy.legChain(w,pose,back);
 const p=w.player,hip={x:(back?-6:5)+(pose.shift||0),y:-83.5+pose.bob},phase=(p.cycle||0)+(back?Math.PI:0),v=clamp(Math.abs(p.vx)/340,0,1);
 const stride=({frost:23,lightning:32,shadow:30,star:25})[w.hero]||28,lift=({frost:17,lightning:25,shadow:19,star:18})[w.hero]||21;
 const a=back?pose.legB:pose.legA,k=back?pose.kneeB:pose.kneeA,knee=jointEnd(hip,41,a),air=jointEnd(knee,43,a-k),strike=pose.strike||0;
 const ground={x:hip.x+Math.sin(phase)*stride*v+(back?-13:16)*(pose.spread??1)*(1-v*.8)+(back?-5:12)*strike,y:-Math.max(0,Math.cos(phase))*lift*v-(back?0:3*Math.sin(strike*Math.PI))};
 const weight=p.dash>0||p.dead>0||p.burst?1:clamp(pose.air||0,0,1),foot={x:mix(ground.x,air.x,weight),y:mix(ground.y,air.y,weight)};
 if(p.grounded&&p.dash<=0&&p.dead<=0){
  foot.y=Math.min(0,foot.y);
  // A planted foot cannot be pulled off the ground by an unreachable stride.
  const dy=foot.y-hip.y,maxX=Math.sqrt(Math.max(0,83.98**2-dy**2));
  foot.x=hip.x+clamp(foot.x-hip.x,-maxX,maxX);
 }
 const [upper,lower]=solveLimb(foot.x-hip.x,foot.y-hip.y,41,43,1),joint=jointEnd(hip,41,upper);
 return {hip,knee:joint,ankle:jointEnd(joint,43,lower)};
}
// Continuous neck weights keep the painted head/neck/collar connected.
const NECK={fire:[.69,.355],nature:[.70,.35],frost:[.75,.35],lightning:[.62,.35],shadow:[.71,.39],star:[.72,.38]};
const HEAD_RANGE={fire:[.34,.415],nature:[.33,.43],frost:[.32,.445],lightning:[.33,.445],shadow:[.40,.535],star:[.36,.535]};
export const headSkinRegion=hero=>({neck:NECK[hero],range:HEAD_RANGE[hero]});
export function corePoint(hero,pose,uv,bounds){
 const r=RIGS[hero],s=r.coreHeight/bounds.h,point={x:(uv[0]-r.hip[0])*bounds.w*s,y:(uv[1]-r.hip[1])*r.coreHeight};
 if(version==='legacy')return point;
 const neck=NECK[hero],pivot={x:(neck[0]-r.hip[0])*bounds.w*s,y:(neck[1]-r.hip[1])*r.coreHeight};
 const range=HEAD_RANGE[hero],weight=1-smooth((uv[1]-range[0])/(range[1]-range[0])),angle=(pose.head||0)*weight;
 const q=rotatePoint({x:point.x-pivot.x,y:point.y-pivot.y},angle);
 const long=['fire','nature','frost'].includes(hero),edge=1-smooth((uv[0]-.12)/.12),rear=long?edge*smooth(uv[1]/.20)*(1-smooth((uv[1]-.57)/.14)):edge*(1-smooth((uv[1]-.10)/.13))*.20;
 return {x:pivot.x+q.x,y:pivot.y+q.y+(pose.hair||0)*rear*2.4};
}
export function bodyFrame(hero,pose,bounds){
 if(version==='legacy')return legacy.bodyFrame(hero,pose,bounds);
 const r=RIGS[hero],origin={x:pose.shift||0,y:-86.5+pose.bob},local=uv=>corePoint(hero,pose,uv,bounds);
 const point=uv=>{const q=rotatePoint(local(uv),pose.lean);return{x:q.x+origin.x,y:q.y+origin.y};};
 return {origin,scale:r.coreHeight/bounds.h,local,point,near:point(r.nearShoulder),far:point(r.farShoulder)};
}
export function castMuzzle(w){
 if(version==='legacy')return legacy.castMuzzle(w);
 const o=targetPose(w),r=RIGS[w.hero],frame=bodyFrame(w.hero,o,{w:r.aspect,h:1}),arm=armChain(frame.near,o.armA,o.elbowA,o.lean),tip=weaponTip(w.hero,arm.hand,o.weapon+o.lean),s=w.characterScale||1;
 return {x:w.player.x+tip.x*w.player.face*s,y:w.player.y+tip.y*s};
}
