// One painted head/neck/torso core. All limb anchors belong to that body transform.
export const RIGS={
  fire:{coreHeight:98,aspect:881/1181,restLean:.065,upperArmWidth:14,hip:[.70,.85],nearShoulder:[.34,.42],farShoulder:[.86,.45],portrait:[.48,.03,.39,.35],
    upperArm:{start:[.534,.112],end:[.442,.919]},forearm:{start:[.374,.09],end:[.724,.94]},
    thigh:{start:[.36,.086],end:[.516,.935]},shin:{start:[.316,.06],end:[.397,.976]},
    weapon:{grip:[.408,.756],tip:[.49,.102],height:134},cape:{anchor:[.66,.06],height:78,widthScale:.62,flip:1}},
  nature:{coreHeight:98,aspect:764/1168,restLean:.055,upperArmWidth:13,hip:[.65,.85],nearShoulder:[.25,.44],farShoulder:[.90,.44],portrait:[.47,.02,.43,.36],
    upperArm:{start:[.57,.084],end:[.656,.929]},forearm:{start:[.418,.074],end:[.555,.924]},
    thigh:{start:[.224,.089],end:[.448,.945]},shin:{start:[.284,.084],end:[.414,.983]},
    weapon:{grip:[.395,.71],tip:[.52,.13],height:111},cape:{anchor:[.104,.048],height:73,widthScale:.65,flip:-1}}
};
Object.assign(RIGS,{
  frost:{coreHeight:98,aspect:387/536,restLean:.045,upperArmWidth:14,hip:[.69,.86],nearShoulder:[.39,.46],farShoulder:[.91,.46],portrait:[.57,.07,.36,.30],upperArm:{start:[.64,.05],end:[.59,.94]},forearm:{start:[.52,.05],end:[.70,.92]},thigh:{start:[.51,.07],end:[.70,.93]},shin:{start:[.22,.06],end:[.47,.94]},weapon:{grip:[.5,.73],tip:[.5,.04],height:87,aspect:72/403},cape:{attach:'waist',anchor:[.63,.06],height:70,widthScale:.76,flip:1}},
  lightning:{coreHeight:98,aspect:354/514,restLean:.10,upperArmWidth:18,hip:[.50,.82],nearShoulder:[.12,.45],farShoulder:[.81,.48],portrait:[.52,.08,.42,.32],upperArm:{start:[.48,.22],end:[.56,.94]},forearm:{start:[.50,.05],end:[.61,.94]},thigh:{start:[.21,.10],end:[.64,.91]},shin:{start:[.48,.06],end:[.49,.92]},weapon:{skip:true,grip:[.5,.9],tip:[.5,.1],height:20,aspect:.5},cape:{attach:'waist',anchor:[.61,.06],height:60,widthScale:.7,flip:1}},
  shadow:{coreHeight:98,aspect:373/499,restLean:.13,upperArmWidth:15,hip:[.57,.86],nearShoulder:[.40,.55],farShoulder:[.86,.55],portrait:[.62,.13,.32,.30],upperArm:{start:[.55,.15],end:[.62,.94]},forearm:{start:[.54,.06],end:[.63,.94]},thigh:{start:[.46,.09],end:[.57,.94]},shin:{start:[.39,.06],end:[.41,.94]},weapon:{grip:[.48,.79],tip:[.13,.07],height:55,aspect:142/461},cape:{anchor:[.76,.11],height:86,widthScale:.66,flip:1}},
  star:{coreHeight:98,aspect:301/518,restLean:.04,upperArmWidth:15,hip:[.66,.87],nearShoulder:[.24,.55],farShoulder:[.86,.55],portrait:[.48,.06,.46,.30],upperArm:{start:[.43,.28],end:[.49,.93]},forearm:{start:[.41,.08],end:[.72,.92]},thigh:{start:[.47,.08],end:[.59,.94]},shin:{start:[.39,.07],end:[.38,.93]},weapon:{grip:[.50,.93],tip:[.50,.40],height:54,aspect:292/373},cape:{attach:'waist',anchor:[.65,.06],height:74,widthScale:.65,flip:1}}
});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const basePose=()=>({bob:0,lean:.055,legA:0,legB:0,kneeA:0,kneeB:0,armA:.25,armB:.05,elbowA:1.12,elbowB:.55,weapon:.22,cape:0,sx:1,sy:1});
export function rotatePoint(p,a){return{x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)};}
export function jointEnd(p,length,angle){return{x:p.x+Math.sin(angle)*length,y:p.y+Math.cos(angle)*length};}
export function solveLimb(dx,dy,l1,l2,bend=1){
  const raw=Math.hypot(dx,dy)||1,d=clamp(raw,Math.abs(l1-l2)+.01,l1+l2-.02),x=dx*d/raw,y=dy*d/raw;
  const a=Math.atan2(x,y)+bend*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
  return[a,Math.atan2(x-Math.sin(a)*l1,y-Math.cos(a)*l1)];
}
export function targetPose(w){
  const p=w.player,n=w.hero==='nature',v=clamp(Math.abs(p.vx)/340,0,1),phase=p.cycle,t=w.time,o=basePose();
  o.bob=Math.sin(t*(n?2.2:2.6))*.45;o.lean=RIGS[w.hero].restLean+(n?.045:.065)*p.vx*p.face/340;
  o.armB=.05+Math.sin(t*2.2)*.02;o.cape=-p.vx*p.face/340*.10;
  if(p.grounded){
    o.bob-=Math.abs(Math.sin(phase))*2*v;
    o.armA=.25+Math.sin(phase)*.12*v;o.elbowA=1.12-Math.sin(phase)*.1*v;
    o.armB=.05-Math.sin(phase)*.32*v;o.elbowB=.55-Math.sin(phase)*.28*v;o.weapon=.22+Math.sin(phase)*.07*v;
  }else if(p.vy<0){
    o.legA=.48;o.kneeA=1.1;o.legB=-.24;o.kneeB=.62;o.armA=.30;o.elbowA=1.2;o.armB=-.62;o.elbowB=-.42;o.weapon=.36;o.cape=-.20;
  }else{
    o.legA=.25;o.kneeA=.48;o.legB=-.30;o.kneeB=.20;o.armA=.22;o.elbowA=1.02;o.armB=-.52;o.elbowB=-.16;o.weapon=.17;o.cape=-.14;
  }
  if(p.land>0){const f=Math.sin(clamp(p.land/.18,0,1)*Math.PI);o.bob+=f*6;o.lean+=f*.04;}
  if(p.dash>0){o.lean=.28;o.legA=.65;o.kneeA=.9;o.legB=-.58;o.kneeB=.35;o.armA=.05;o.elbowA=.80;o.armB=-.70;o.elbowB=-.35;o.weapon=.50;o.cape=-.32;}
  if(p.cast){
    const c=p.cast,wind=smooth(c.age/c.releaseAt),recover=1-smooth((c.age-c.releaseAt)/(c.duration-c.releaseAt)),s=wind*recover;
    if(c.key==='attack'){
      const a=Math.atan2(w.aim.y-(p.y-119),Math.max(24,(w.aim.x-p.x)*p.face));
      const arm=solveLimb(Math.cos(a)*42,Math.sin(a)*23+13,28,29,-1);
      o.armA=lerp(o.armA,arm[0],s);o.elbowA=lerp(o.elbowA,arm[1],s);o.weapon=lerp(o.weapon,a+Math.PI/2-.07,s);o.lean+=s*.07;
    }else if(c.key==='q'){
      o.bob+=s*(n?8:3);o.lean+=s*(n?.15:.08);
      o.armA=lerp(o.armA,n?.35:.65,s);o.elbowA=lerp(o.elbowA,n?.75:1.5,s);o.weapon=lerp(o.weapon,n?.08:.50,s);
    }else if(c.key==='e'){
      o.armA=lerp(o.armA,n?.35:.10,s);o.elbowA=lerp(o.elbowA,n?1.35:.60,s);o.weapon=lerp(o.weapon,n?.12:.60,s);o.lean+=s*.06;
    }else{
      // Only the staff arm performs the small lift.
      o.armA=lerp(o.armA,.86,s);o.elbowA=lerp(o.elbowA,1.72,s);o.weapon=lerp(o.weapon,.14,s);
      o.bob-=s*.7;o.lean+=s*.018;
    }
    // The free hand stays relaxed and visible; it has no casting gesture.
    o.armB=.05;o.elbowB=.55;
  }
  if(p.stomp){o.lean=.12;o.armA=1.35;o.elbowA=2.25;o.weapon=.08;o.legA=.40;o.kneeA=.70;o.legB=-.20;o.kneeB=.35;}
  if(['frost','lightning','shadow','star'].includes(w.hero)){
    const c=p.cast,s=c?smooth(c.age/c.releaseAt)*(1-smooth((c.age-c.releaseAt)/(c.duration-c.releaseAt))):0;
    if(w.hero==='frost'){o.armA=lerp(o.armA,.38,s);o.elbowA=lerp(o.elbowA,c?.key==='r'?1.8:1.2,s);o.weapon=lerp(o.weapon,.04,s);o.lean=RIGS.frost.restLean+v*.055+s*.035;}
    if(w.hero==='lightning'){o.armA=lerp(.35,1.45,s);o.elbowA=lerp(1.9,1.55,s);o.armB=.25;o.elbowB=2.0;o.lean=.10+v*.11+s*.08;o.weapon=0;}
    if(w.hero==='shadow'){o.bob+=3+v*2;o.lean=.13+v*.12+s*.06;o.armA=lerp(.22,1.3,s);o.elbowA=lerp(.75,1.7,s);o.armB=.05;o.elbowB=.8;o.weapon=lerp(.5,1.05,s);}
    if(w.hero==='star'){o.armA=lerp(.5,.9,s);o.elbowA=lerp(1.25,1.5,s);o.weapon=.08;o.bob-=Math.sin(t*2.5)*.5;o.lean=.04+v*.045;o.armB=.05;o.elbowB=.6;}
    if(!p.grounded){
      if(w.hero==='frost'){o.legA=.22;o.kneeA=p.vy<0?.8:.38;o.legB=-.2;o.kneeB=.22;}
      if(w.hero==='lightning'){o.legA=.7;o.kneeA=1.25;o.legB=-.4;o.kneeB=.42;}
      if(w.hero==='shadow'){o.legA=.62;o.kneeA=1.35;o.legB=-.5;o.kneeB=.6;}
      if(w.hero==='star'){o.legA=.25;o.kneeA=.65;o.legB=-.24;o.kneeB=.55;}
    }
    if(p.burst){o.lean=w.hero==='shadow'?.3:.24;o.legA=.6;o.kneeA=.9;o.legB=-.6;o.kneeB=.3;}
  }
  if(p.hurt>0){const f=p.hurt/.24;o.lean-=.16*f;o.armB=-.45;o.elbowB=-.70;o.bob+=2*f;}
  if(p.dead>0){o.bob=22;o.lean=-.25;o.legA=.65;o.kneeA=1.5;o.legB=-.35;o.kneeB=1.2;o.armA=.15;o.elbowA=.30;o.weapon=.75;}
  return o;
}
export function blendPose(current,target,dt,isR=false){
  const deltaTime=clamp(Number.isFinite(dt)?dt:1/60,0,.05);
  // A queued RAF timestamp can predate a start/resume event. Do not multiply
  // an unlimited joint rate by zero (Infinity * 0 would poison the whole pose).
  if(deltaTime===0)return current;
  const blend=1-Math.exp(-26*deltaTime);
  const limits={armA:isR?2.4:6,armB:isR?2.4:6,elbowA:isR?3.2:9,elbowB:isR?3.2:9,weapon:isR?1.5:5,lean:1.3};
  for(const key of Object.keys(current)){
    const change=(target[key]-current[key])*blend,maxStep=(limits[key]??Infinity)*deltaTime;
    current[key]+=clamp(change,-maxStep,maxStep);
  }
  return current;
}
export function bodyFrame(hero,pose,coreBounds){
  const r=RIGS[hero],s=r.coreHeight/coreBounds.h,origin={x:0,y:-86.5+pose.bob};
  const local=uv=>({x:(uv[0]-r.hip[0])*coreBounds.w*s,y:(uv[1]-r.hip[1])*r.coreHeight});
  const point=uv=>{const q=rotatePoint(local(uv),pose.lean);return{x:q.x+origin.x,y:q.y+origin.y};};
  return {origin,scale:s,local,point,near:point(r.nearShoulder),far:point(r.farShoulder)};
}
// Uniform scale and a source joint-to-joint axis preserve the painted part's shape.
export function partTransform(bounds,anchors,start,end){
  const a={x:anchors.start[0]*bounds.w,y:anchors.start[1]*bounds.h},b={x:anchors.end[0]*bounds.w,y:anchors.end[1]*bounds.h};
  return {anchor:a,scale:Math.hypot(end.x-start.x,end.y-start.y)/Math.hypot(b.x-a.x,b.y-a.y),angle:Math.atan2(end.y-start.y,end.x-start.x)-Math.atan2(b.y-a.y,b.x-a.x)};
}
export function armChain(shoulder,a,b,bodyAngle=0){const elbow=jointEnd(shoulder,28,a-bodyAngle),hand=jointEnd(elbow,29,b-bodyAngle);return{shoulder,elbow,hand};}
export function weaponTip(hero,hand,angle){
  const r=RIGS[hero].weapon,ratio=r.aspect||(hero==='fire'?120/422:134/423);
  const q=rotatePoint({x:(r.tip[0]-r.grip[0])*r.height*ratio,y:(r.tip[1]-r.grip[1])*r.height},angle);
  return{x:hand.x+q.x,y:hand.y+q.y};
}
export function castMuzzle(w){
  const o=targetPose(w),r=RIGS[w.hero],frame=bodyFrame(w.hero,o,{w:r.aspect,h:1}),arm=armChain(frame.near,o.armA,o.elbowA,o.lean);
  const tip=weaponTip(w.hero,arm.hand,o.weapon+o.lean);
  const scale=w.characterScale||1;
  return {x:w.player.x+tip.x*w.player.face*scale,y:w.player.y+tip.y*scale};
}
