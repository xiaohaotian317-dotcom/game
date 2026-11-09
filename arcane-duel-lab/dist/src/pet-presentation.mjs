import META from '../assets/pets/presentation/presentation-meta-v2.json' with {type:'json'};
import {drawFrameBlend} from './fx-animation.mjs';
const folder='assets/pets/presentation/';
export const PET_PRESENTATION_RESOURCES=META.files.length;
export async function loadPetPresentation(art,progress=()=>{}){
 art.petPresentation={images:{}};await Promise.all(META.files.map(file=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{art.petPresentation.images[file]=image;progress();resolve();};image.onerror=()=>reject(Error('灵宠素材载入失败：'+file));image.src=folder+file;})));
}
export function petPresentationStyle(kind,index,{portrait=false}={}){
 const f=portrait?META.juveniles[kind]?.portrait:META.skills[kind]?.[index]?.icon;if(!f)return null;const [x,y,w,h]=f.rect,[sw,sh]=f.size;
 return `background-image:url('${folder+f.file}');background-size:${sw/w*100}% ${sh/h*100}%;background-position:${x/Math.max(1,sw-w)*100}% ${y/Math.max(1,sh-h)*100}%;aspect-ratio:${w}/${h}`;
}
export function petVisualPhase(age,duration,field=false){
 const t=Math.max(0,Math.min(1,age/Math.max(.001,duration)));let position=t*3;
 if(field){if(age<.24)position=age/.24*2;else if(duration-age<.28)position=2+(1-(duration-age)/.28);else position=1.8+Math.sin(age*8)*.2;}
 position=Math.max(0,Math.min(3,position));const a=Math.floor(position);return {a,b:Math.min(3,a+1),mix:position-a};
}
export function drawPetSkill(c,w,pet,fx,art){
 const m=META.skills[pet.petKind]?.[fx.index],image=art.petPresentation?.images[m?.file];if(!m||!image)return false;
 const age=w.time-fx.born;if(age<0||age>=fx.duration)return true;const phase=petVisualPhase(age,fx.duration,fx.mode==='field');
 c.save();c.translate(fx.x,fx.y);if(!m.grounded)c.scale(fx.face||pet.face||1,1);
 drawFrameBlend(c,image,m.frames,phase,0,0,fx.size||180,{reference:m.referenceWidth,ground:m.grounded&&fx.mode!=='impact'&&fx.mode!=='muzzle',alpha:Math.min(1,age*18,(fx.duration-age)*10)});c.restore();return true;
}
export function drawPetProjectile(c,w,pet,shot,art){
 const m=META.skills[pet.petKind]?.[Math.max(0,shot.skillIndex||0)],image=art.petPresentation?.images[m?.file];if(!image)return false;
 const mix=(Math.sin((shot.age||0)*18)+1)/2;c.save();c.translate(shot.x,shot.y);c.rotate(Math.atan2(shot.y-shot.py,shot.x-shot.px));drawFrameBlend(c,image,m.frames,{a:1,b:2,mix},0,0,62,{reference:m.referenceWidth,alpha:.95});c.restore();return true;
}
export function juvenilePose(e,time){
 if(e.hp<=0)return time-(e.diedAt??time)<.3?14:15;
 if(e.hit>0)return 12;if(e.attackAt)return 7;
 if(e.attackPoseUntil>time)return e.pendingSkill===2?11:e.pendingSkill===1?10:8;
 if(e.recoverUntil>time)return 9;return 6;
}
export function hasJuvenilePet(e,art){const m=META.juveniles[e.petKind];return (e.form||0)===0&&!!art.petPresentation?.images[m?.file];}
export function drawJuvenilePet(c,w,e,art,alpha=1){
 const m=META.juveniles[e.petKind],image=art.petPresentation?.images[m?.file];if((e.form||0)!==0||!m||!image)return false;
 const frame=juvenilePose(e,w.time),phase=((e.walkPhase??(e.cycle||0)*40/130)*6)%6,walking=e.state==='walk'&&frame===6;
 c.save();c.translate(e.prevX+(e.x-e.prevX)*alpha,e.prevY+(e.y-e.prevY)*alpha);c.scale(e.face||1,1);c.globalAlpha*=Math.max(.1,Math.min(1,(w.time-(e.recalledAt??e.born))*3));
 drawFrameBlend(c,image,m.frames,walking?{a:Math.floor(phase),b:(Math.floor(phase)+1)%6,mix:phase%1}:{a:frame,b:frame,mix:0},0,0,m.naturalHeight,{reference:m.referenceSourceHeight,ground:true});c.restore();return true;
}
