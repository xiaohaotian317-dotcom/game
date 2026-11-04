import {GROUND_EFFECT_DELAYS as DELAYS} from './match-rules.mjs?v=20261030-duel12';
import {BOSS_TUNING} from './enemy-tuning.mjs';
import {resolveGroundTarget,groundTarget,lightningLandingTarget} from './targeting.mjs?v=20261030-duel12';
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const COLORS={fire:'#ffc078',nature:'#d1e5a0',frost:'#d4f4ff',lightning:'#ffe5a0',shadow:'#d5b6ff',star:'#efcfff'};

export const warningProgress=(age,lead,delay)=>clamp((age+(lead||0))/Math.max(.001,(lead||0)+delay));
export function castWarning(w,cast=w.player.cast){
 if(!cast||cast.released||cast.variant)return null;
 let radius=({fire:{q:100,r:155},nature:{r:160},frost:{q:150,r:185},lightning:{r:165},shadow:{r:190},star:{q:185,r:205}})[w.hero]?.[cast.key];
 let target=resolveGroundTarget(w,cast.target);
 if(w.hero==='lightning'&&cast.key==='r'&&!cast.soloSkill?.column)target=lightningLandingTarget(w,cast,target);
 if(cast.soloSkill?.column){
  const row=cast.soloSkill.row;
  radius=row===2?(w.hero==='lightning'?165:215):row===0&&w.hero==='fire'?150:null;
  if(radius)target=w.hero==='lightning'&&row===2?{x:w.player.x,y:w.player.y}:groundTarget(w,clamp(cast.x,w.player.x-580,w.player.x+580),cast.y);
 }
 const tail=cast.soloSkill?.column?0:({fire:{q:DELAYS.fireBlast,r:DELAYS.meteorBase/BOSS_TUNING.fallSpeed},nature:{r:DELAYS.treeGrowth},frost:{r:DELAYS.frostDomain},lightning:{r:DELAYS.thunderDive},shadow:{r:DELAYS.shadowStorm},star:{r:DELAYS.starCollapse}})[w.hero]?.[cast.key]||0;
 return radius&&target?{hero:w.hero,...target,radius,progress:clamp(cast.age/Math.max(.001,cast.releaseAt+tail)),alpha:.68}:null;
}

export function drawLandingWarning(c,assets,{hero,x,y,radius,progress=0,clock=0,alpha=1}){
 const meta=assets.feedbackMeta?.warnings,frame=meta?.frames?.[hero],im=assets.landingRings;
 if(!frame||!im)return false;
 const color=COLORS[hero],p=clamp(progress),rx=radius,ry=Math.max(10,radius*.18),scale=rx/frame.radius;
 c.save();c.translate(x,y-2);c.globalAlpha*=alpha;
 const draw=()=>c.drawImage(im,...frame.rect,-frame.center[0]*scale,-frame.center[1]*scale,frame.rect[2]*scale,frame.rect[3]*scale);
 // The material rim defines the exact radius; an overlaid sweep shows charge.
 c.save();c.scale(1,ry/rx);c.rotate(Math.sin(clock*.22)*.035);c.globalAlpha*=.54;draw();c.restore();
 c.save();c.scale(1,ry/rx);c.beginPath();c.moveTo(0,0);c.arc(0,0,rx*1.12,-Math.PI/2,-Math.PI/2+TAU*p);c.closePath();c.clip();c.globalAlpha*=.82;draw();c.restore();
 c.strokeStyle=color;c.lineWidth=1.4;c.beginPath();c.ellipse(0,0,rx*.92,ry*.92,0,-Math.PI/2,-Math.PI/2+TAU*p);c.stroke();
 // Sparse rising embers/ice motes intensify as impact approaches, without flashing.
 for(let i=0;i<8;i++){const a=i*TAU/8,q=(clock*.6+i*.17)%1;c.globalAlpha=alpha*(.15+p*.35)*(1-q);c.fillStyle=color;c.beginPath();c.ellipse(Math.cos(a)*rx*.9,Math.sin(a)*ry*.9-q*(7+p*18),1.2,2.2,0,0,TAU);c.fill();}
 c.restore();return true;
}

export function punchFrame(c,assets,index,x,y,{face=1,alpha=1,sx=.46,sy=.28}={}){
 const f=assets.feedbackMeta?.punch?.frames?.[index],im=assets.lightningPunch;if(!f||!im)return false;
 c.save();c.translate(x,y);c.scale(face*sx,sy);c.globalAlpha*=clamp(alpha);c.drawImage(im,...f.rect,-f.anchor[0],-f.anchor[1],f.rect[2],f.rect[3]);c.restore();return true;
}
export function drawPunchCharge(c,assets,x,y,progress){
 return punchFrame(c,assets,progress<.65?0:1,x,y,{sx:.22,sy:.19,alpha:clamp(progress)*.7});
}
export function drawPunchStrike(c,assets,x,y,face,age,duration=.34,scale=1){
 const p=clamp(age/duration),frame=2+p*5,lo=Math.min(7,Math.floor(frame)),hi=Math.min(7,lo+1),mix=frame-lo,fade=1-Math.pow(p,2);
 const options={face,sx:.46*scale,sy:.28*scale,alpha:fade*(1-mix)};
 const painted=punchFrame(c,assets,lo,x,y,options);if(hi!==lo)punchFrame(c,assets,hi,x,y,{...options,alpha:fade*mix});return painted;
}
export function drawPunchContact(c,assets,x,y,age,duration=.28){
 const meta=assets.feedbackMeta?.punch,im=assets.lightningPunch;if(!meta||!im)return false;
 const r=meta.frames[3].rect,p=clamp(age/duration),size=48+26*Math.sin(Math.PI*p);
 c.save();c.translate(x,y);c.globalAlpha*=Math.pow(1-p,1.4);c.drawImage(im,r[0]+180,r[1]+55,105,160,-size*.5,-size*.55,size,size*1.12);c.restore();return true;
}
