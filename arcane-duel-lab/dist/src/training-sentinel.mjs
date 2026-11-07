import {drawFrameBlend,phaseFrames} from './fx-animation.mjs';
const image=src=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('训练傀儡素材加载失败'));im.src=src;});
export async function loadSentinel(assets){if(assets.sentinel)return;const [img,meta]=await Promise.all([image('assets/training/training-sentinel-v1.png'),fetch('assets/training/sentinel-meta-v1.json').then(r=>{if(!r.ok)throw Error('训练傀儡信息加载失败');return r.json();})]);assets.sentinel={img,frames:meta.frames.map(f=>({rect:f.sourceRect,pivot:f.pivotLocal})),reference:meta.referenceBodyHeightPixels||403};}
export function drawSentinel(c,w,t,assets){const art=assets.sentinel;if(!art)return false;const age=Math.max(0,(w.fxTime||w.time)-(t.lastHitFx??-100)),dead=t.deadUntil>w.time;let phase;
 if(dead){const deathAge=2.5-(t.deadUntil-w.time);phase=deathAge<1.8?{a:6,b:6,mix:0}:{a:7,b:0,mix:Math.max(0,Math.min(1,(deathAge-1.8)/.7))};}
 else if(age<.32){const heavy=(t.lastHitDamage||0)>=30,seq=heavy?[3,4,5,0]:[2,5,0],v=age/.32*(seq.length-1),i=Math.floor(v);phase={a:seq[i],b:seq[Math.min(seq.length-1,i+1)],mix:v-i};}
 else{const mix=(Math.sin((w.fxTime||w.time)*1.6)+1)*.5;phase={a:0,b:1,mix};}
 c.save();c.translate(t.x,t.y);c.scale(t.face||-1,1);drawFrameBlend(c,art.img,art.frames,phase,0,0,100,{reference:art.reference,alpha:dead?.75:1});c.restore();
 if(!dead){const ratio=Math.max(0,t.hp/t.maxHp);c.fillStyle='#06121cea';c.fillRect(t.x-35,t.y-118,70,7);c.fillStyle=age<.22?'#f9e4a9':'#75c5bf';c.fillRect(t.x-34,t.y-117,68*ratio,5);c.fillStyle='#e0cf9d';c.font='11px serif';c.textAlign='center';c.fillText('秘铜试炼傀儡',t.x,t.y-125);}
 return true;
}
