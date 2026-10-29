import {RosterPainter} from './roster-painter-v2.mjs?v=20261029-combat7';
import {WIDTH,HEIGHT,FLOOR,HEROES,clamp,lerp} from './simulation.mjs?v=20261029-combat7';
import {RIGS,basePose as coherentBase,targetPose as coherentPose,blendPose,bodyFrame,partTransform,armChain,jointEnd,solveLimb,weaponTip} from './character-rig.mjs?v=20261029-combat7';
import {ScenePainter} from './scene-painter.mjs?v=20261029-combat7';
import {CombatPainter} from './combat-painter.mjs?v=20261029-combat7';
import {cameraView,updateCamera} from './camera.mjs?v=20261029-combat7';
const TAU=Math.PI*2;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const rgba=(hex,a)=>{let n=parseInt(hex.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';};
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);c.fill();}
function line(c,points,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();}
function glow(c,x,y,r,color,a=.7){if(![x,y,r].every(Number.isFinite))throw new Error('Invalid glow '+JSON.stringify({x,y,r}));const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,rgba(color,a));g.addColorStop(1,rgba(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);}
function ring(c,x,y,rx,ry,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.stroke();}
function rune(c,x,y,r,color,rot=0){
  c.save();c.translate(x,y);c.rotate(rot);ring(c,0,0,r,r,color,1.2);ring(c,0,0,r*.77,r*.77,color,.7);
  c.strokeStyle=color;c.beginPath();for(let i=0;i<=6;i++){const a=i/6*TAU-Math.PI/2;if(i)c.lineTo(Math.cos(a)*r*.7,Math.sin(a)*r*.7);else c.moveTo(Math.cos(a)*r*.7,Math.sin(a)*r*.7);}c.stroke();
  line(c,[[-r,0],[r,0]],color,.6);line(c,[[0,-r],[0,r]],color,.6);c.restore();
}
function leaf(c,x,y,len,angle,color){
  c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(len*.7,-len*.6,len,0);c.quadraticCurveTo(len*.6,len*.5,0,0);c.fill();line(c,[[0,0],[len*.9,0]],'rgba(231,229,154,.45)',.6);c.restore();
}
function artImage(src){return new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('素材加载失败：'+src));i.src=src;});}
export async function loadAssets(progress=()=>{},{scenes=true}={}){
  const entries=[['fire','assets/fire-rig.png'],['nature','assets/nature-rig.png'],['fireCore','assets/fire-core-v2.png'],['natureCore','assets/nature-core-v2.png'],['backdrop','assets/moon-backdrop.png'],['title','assets/title-screen.png']];
  for(const key of ['fire-vfx-v2','nature-vfx-v2','wood-stag-v2','stone-covers-v2'])entries.push([key,'assets/combat/'+key+'.png']);
  if(scenes)for(const scene of ['moon','lava','garden'])entries.push([scene+'Field','assets/scenes/'+scene+'-field-v1.png'],[scene+'Props','assets/scenes/'+scene+'-props-v1.png']);
  let count=0;const images={};
  await Promise.all(entries.map(async([key,url])=>{images[key]=await artImage(url);progress(++count,entries.length);}));
  const response=await fetch('assets/rig-bounds.json');if(!response.ok)throw new Error('角色部件信息加载失败');
  const coreResponse=await fetch('assets/core-bounds-v2.json');if(!coreResponse.ok)throw new Error('角色主体信息加载失败');
  const sceneBounds=scenes?await (await fetch('assets/scenes/prop-bounds-v1.json')).json():null;
  const combatBounds=await (await fetch('assets/combat/bounds-v2.json')).json();
  const rosterBounds=await (await fetch('assets/heroes/bounds-v1.json')).json();
  const refinementBounds=await (await fetch('assets/heroes/refinement-bounds-v2.json')).json();
  for(const [hero,bounds] of Object.entries(refinementBounds)){rosterBounds[hero].fx=bounds.fx;if(bounds.core)rosterBounds[hero].coreV2=bounds.core;}
  return {...images,rosterBounds,bounds:await response.json(),coreBounds:await coreResponse.json(),sceneBounds,combatBounds};
}
export async function ensureHeroAssets(hero,assets){
  if(assets[hero])return;
  assets.pending||={};
  return assets.pending[hero]||=(async()=>{try{const [rig,fx,core]=await Promise.all([artImage('assets/heroes/'+hero+'-rig-v1.png'),artImage('assets/heroes/'+hero+'-fx-v2.png'),hero==='lightning'?artImage('assets/heroes/lightning-core-v2.png'):null]);assets[hero]=rig;assets[hero+'Core']=core||rig;assets[hero+'Fx']=fx;assets.bounds[hero]=assets.rosterBounds[hero];assets.coreBounds[hero]=assets.rosterBounds[hero].coreV2||assets.rosterBounds[hero].core;}catch(e){delete assets.pending[hero];throw e;}})();
}
export class Renderer {
  constructor(canvas,assets){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.assets=assets;this.poses=Object.fromEntries(Object.keys(HEROES).map(h=>[h,coherentBase()]));this.lastTime=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;this.scenePainter=new ScenePainter(assets,this.ctx);this.combat=new CombatPainter(this.ctx,assets,this.scenePainter);this.roster=new RosterPainter(this.ctx,assets);}
  resize(){const rect=this.canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);if(this.canvas.width!==Math.round(rect.width*d)||this.canvas.height!==Math.round(rect.height*d)){this.canvas.width=Math.round(rect.width*d);this.canvas.height=Math.round(rect.height*d);}}
  cape(c,hero,o,time,speed,frame){
    const b=this.assets.bounds[hero].cape,r=RIGS[hero].cape,s=r.height/b.h,anchor=r.attach==='waist'?{x:-3,y:0}:frame.local(RIGS[hero].nearShoulder);
    c.save();c.translate(frame.origin.x,frame.origin.y);c.rotate(o.lean);c.translate(anchor.x+3,anchor.y+6);c.rotate(o.cape*.45);
    c.scale(r.flip*r.widthScale,1);
    for(let i=0;i<20;i++){
      const f=i/20,sh=b.h/20,sway=(Math.sin(time*3.7-f*3.2)*f*1.8-Math.abs(speed)/340*f*6)*r.flip;
      c.drawImage(this.assets[hero],b.x,b.y+b.h*f,b.w,sh+.5,-b.w*s*r.anchor[0]+sway,(f-r.anchor[1])*r.height,b.w*s,r.height/20+.4);
    }c.restore();
  }
  bone(c,hero,key,start,end){
    const b=this.assets.bounds[hero][key],a=partTransform(b,RIGS[hero][key],start,end);
    c.save();
    if(key==='upperArm'){
      // Keep the painted sleeve inside its shoulder-to-elbow corridor. In particular,
      // the old flared shoulder fabric must not fly behind the torso when lifted.
      const length=Math.hypot(end.x-start.x,end.y-start.y),ux=(end.x-start.x)/length,uy=(end.y-start.y)/length,half=RIGS[hero].upperArmWidth/2;
      c.beginPath();c.moveTo(start.x-ux*2-uy*half,start.y-uy*2+ux*half);
      c.lineTo(start.x-ux*2+uy*half,start.y-uy*2-ux*half);
      c.lineTo(end.x+ux*5+uy*half,end.y+uy*5-ux*half);
      c.lineTo(end.x+ux*5-uy*half,end.y+uy*5+ux*half);c.closePath();c.clip();
    }
    c.translate(start.x,start.y);c.rotate(a.angle);c.scale(a.scale,a.scale);
    c.drawImage(this.assets[hero],b.x,b.y,b.w,b.h,-a.anchor.x,-a.anchor.y,b.w,b.h);c.restore();
  }
  hero(w,alpha,dt,{poseOverride=null}={}){
    const c=this.ctx,p=w.player,hero=w.hero;
    const desired=poseOverride||coherentPose(w),o=poseOverride||blendPose(this.poses[hero],desired,dt,p.cast?.key==='r');
    const x=lerp(p.prevX,p.x,alpha),y=lerp(p.prevY,p.y,alpha);
    if(!poseOverride)ellipse(c,x,y+3,27,6,'rgba(1,4,12,.4)');
    if(p.passiveGlow>0)glow(c,x,y-60,80,HEROES[hero].color,p.passiveGlow*.16);
    c.save();c.translate(x,y);c.scale(p.face*(w.characterScale||1),w.characterScale||1);c.scale(o.sx,o.sy);
    if(p.invuln>0&&Math.sin(w.time*45)>.8)c.globalAlpha*=.7;
    const core=this.assets.coreBounds[hero],r=RIGS[hero],frame=bodyFrame(hero,o,core);
    this.cape(c,hero,o,w.time,p.vx*p.face,frame);
    const leg=(a,knee,back)=>{
      c.save();if(back)c.globalAlpha*=.79;
      const hip={x:back?7:-5,y:frame.origin.y+3};let upper=a,lower=a-knee;
      if(p.grounded&&p.dash<=0&&p.dead<=0){
        const phase=p.cycle+(back?Math.PI:0),v=clamp(Math.abs(p.vx)/340,0,1);
        const stride=({frost:23,lightning:32,shadow:30,star:25})[hero]||28,lift=({frost:17,lightning:25,shadow:19,star:18})[hero]||21;
        [upper,lower]=solveLimb(Math.sin(phase)*stride*v+(back?1:5),-Math.max(0,Math.cos(phase))*lift*v-hip.y,41,43,1);
      }
      const k=jointEnd(hip,41,upper),ankle=jointEnd(k,43,lower);
      this.bone(c,hero,'thigh',hip,k);this.bone(c,hero,'shin',k,ankle);c.restore();
    };
    leg(o.legB,o.kneeB,true);leg(o.legA,o.kneeA,false);
    const far=armChain(frame.far,o.armB,o.elbowB,o.lean),near=armChain(frame.near,o.armA,o.elbowA,o.lean);
    c.save();c.globalAlpha*=.80;this.bone(c,hero,'upperArm',far.shoulder,far.elbow);this.bone(c,hero,'forearm',far.elbow,far.hand);c.restore();
    // Crown, neck, collar and torso are one unbroken image, rotated as one piece.
    c.save();c.translate(frame.origin.x,frame.origin.y);c.rotate(o.lean);c.scale(frame.scale,frame.scale);
    c.drawImage(this.assets[hero+'Core'],core.x,core.y,core.w,core.h,-r.hip[0]*core.w,-r.hip[1]*core.h,core.w,core.h);c.restore();
    // Reveal the relaxed free hand without giving it a casting gesture.
    if(p.cast){c.save();c.globalAlpha*=.96;this.bone(c,hero,'forearm',far.elbow,far.hand);c.restore();}
    if(hero==='shadow'){const dagger=this.assets.bounds.shadow.gear,scale=46/dagger.h;c.save();c.translate(far.hand.x,far.hand.y);c.rotate(-.4+o.lean);c.scale(scale,scale);c.drawImage(this.assets.shadow,dagger.x,dagger.y,dagger.w,dagger.h,-dagger.w*.53,-dagger.h*.8,dagger.w,dagger.h);c.restore();}
    this.bone(c,hero,'upperArm',near.shoulder,near.elbow);
    const weapon=this.assets.bounds[hero].weapon,ws=r.weapon.height/weapon.h,angle=o.weapon+o.lean;
    if(!r.weapon.skip){c.save();c.translate(near.hand.x,near.hand.y);c.rotate(angle);c.scale(ws,ws);
    c.drawImage(this.assets[hero],weapon.x,weapon.y,weapon.w,weapon.h,-r.weapon.grip[0]*weapon.w,-r.weapon.grip[1]*weapon.h,weapon.w,weapon.h);c.restore();}
    this.bone(c,hero,'forearm',near.elbow,near.hand);
    if(p.cast){
      const strength=Math.sin(clamp(p.cast.age/p.cast.duration,0,1)*Math.PI);
      const tip=weaponTip(hero,near.hand,angle);
      if(hero==='nature')glow(c,tip.x,tip.y,14+strength*12,'#b9dc74',strength*.55);
      else glow(c,tip.x,tip.y,20+strength*13,HEROES[hero].color,.25+strength*.25);
    }
    c.restore();
  }
  portrait(canvas,hero){const c=canvas.getContext('2d'),b=this.assets.coreBounds[hero],p=RIGS[hero].portrait;c.clearRect(0,0,canvas.width,canvas.height);c.drawImage(this.assets[hero+'Core'],b.x+b.w*p[0],b.y+b.h*p[1],b.w*p[2],b.h*p[3],0,0,canvas.width,canvas.height);}
  platform(b,t){
    if(!b.active)return;const c=this.ctx;
    if(b.type==='root'){
      const grad=c.createLinearGradient(0,b.y,0,b.y+19);grad.addColorStop(0,'#a2a56a');grad.addColorStop(.2,'#716e42');grad.addColorStop(1,'#263c2c');
      c.fillStyle=grad;c.beginPath();c.roundRect(b.x,b.y,b.w,18,7);c.fill();
      for(let x=b.x+5;x<b.x+b.w;x+=14){line(c,[[x,b.y+15],[x+9,b.y+4]],'#c8ce87',1);leaf(c,x,b.y+2,12,Math.sin(x)*.6-1,'#77995b');}return;
    }
    if(b.type==='wood'){
      line(c,[[b.x,b.y+16],[b.x+b.w,b.y+16]],'#332622',9);
      for(let x=b.x;x<b.x+b.w;x+=26){c.fillStyle=(Math.floor(x/26)%2)?'#86634b':'#72563f';c.fillRect(x,b.y,24,13);line(c,[[x+2,b.y+3],[x+22,b.y+5]],'#c5a078',1);line(c,[[x+5,b.y+10],[x+18,b.y+9]],'#4b3729',.8);}
      for(let x=b.x;x<b.x+b.w;x+=70){line(c,[[x,b.y-31],[x,b.y+4]],'#6c665b',3);ellipse(c,x,b.y-32,3,3,'#d9c294');}
      line(c,[[b.x,b.y-29],[b.x+b.w,b.y-29]],'#ae9569',2);
      if(b.hp<b.maxHp){c.strokeStyle='#211b22';c.lineWidth=2;c.beginPath();c.moveTo(b.x+b.w*.45,b.y);c.lineTo(b.x+b.w*.49,b.y+8);c.lineTo(b.x+b.w*.52,b.y+4);c.lineTo(b.x+b.w*.54,b.y+15);c.stroke();}
      return;
    }
    const depth=b.id==='ground'?100:31,gr=c.createLinearGradient(0,b.y,0,b.y+depth);
    gr.addColorStop(0,'#a5a39e');gr.addColorStop(.08,'#666c80');gr.addColorStop(.27,'#3b435b');gr.addColorStop(1,'#1b263f');
    c.fillStyle=gr;c.fillRect(b.x,b.y,b.w,depth);
    c.strokeStyle='#1b253c';c.lineWidth=2;
    for(let row=0;row<Math.ceil(depth/18);row++)for(let x=b.x-30+(row%2)*25;x<b.x+b.w;x+=52){
      const xx=Math.max(b.x,x),ww=Math.min(51,b.x+b.w-xx);if(ww<=0)continue;
      c.strokeRect(xx,b.y+row*18,ww,17);
      c.fillStyle='rgba(188,193,196,'+(.035+Math.abs(Math.sin(x*3+row))*.06)+')';c.fillRect(xx+3,b.y+row*18+3,ww-6,3);
    }
    line(c,[[b.x,b.y+1],[b.x+b.w,b.y+1]],'#d3c6a1',1.8);
    line(c,[[b.x+3,b.y+5],[b.x+b.w-3,b.y+5]],'rgba(220,206,167,.25)',1);
    if(b.id!=='ground'){
      for(let x=b.x+20;x<b.x+b.w-10;x+=49){
        leaf(c,x,b.y-1,9,Math.sin(x)*1.3-1.5,'#687f66');leaf(c,x+3,b.y+4,7,.8,'#4b675b');
        if(Math.sin(x)>0){c.strokeStyle='#4e6e5d';c.lineWidth=1.5;c.beginPath();c.moveTo(x,b.y+12);c.quadraticCurveTo(x+8,b.y+35,x-5,b.y+55);c.stroke();leaf(c,x+1,b.y+31,8,.5,'#5c7862');}
      }
      const cx=b.x+b.w/2;c.fillStyle='#c5ac77';c.beginPath();c.moveTo(cx-10,b.y+9);c.lineTo(cx,b.y+18);c.lineTo(cx+10,b.y+9);c.lineTo(cx,b.y+27);c.closePath();c.fill();
    }
  }
  dummy(w,t){
    const c=this.ctx,dead=t.deadUntil>w.time;
    if(dead){const a=clamp((t.deadUntil-w.time)/2.5,0,1);glow(c,t.x,t.y-30,30,'#b7a0eb',a*.2);return;}
    c.save();c.translate(t.x,t.y);c.rotate(t.hit*Math.sin(w.time*55)*.3);
    ellipse(c,0,1,25,5,'rgba(0,0,0,.35)');
    const wood=c.createLinearGradient(-17,0,17,0);wood.addColorStop(0,'#655a56');wood.addColorStop(.5,'#c7b494');wood.addColorStop(1,'#726563');
    c.fillStyle=wood;c.strokeStyle='#3b3540';c.lineWidth=2;
    for(const side of [-1,1]){c.save();c.translate(side*11,-29);c.rotate(side*-.1);c.fillRect(-5,0,10,28);c.strokeRect(-5,0,10,28);c.restore();}
    c.beginPath();c.moveTo(-18,-63);c.lineTo(18,-63);c.lineTo(13,-30);c.lineTo(-12,-30);c.closePath();c.fill();c.stroke();
    ellipse(c,0,-76,13,15,wood);ring(c,0,-76,13,15,'#dbc7a0',1);
    for(const s of [-1,1]){line(c,[[s*17,-60],[s*26,-40],[s*30,-30]],'#a08f7c',8);ellipse(c,s*20,-56,5,5,'#d4c29d');}
    glow(c,0,-48,19,t.burnUntil>w.time?'#ff9c45':'#ae8cea',.25);rune(c,0,-48,9,t.burnUntil>w.time?'#ffd38d':'#d8bcff',w.time*.2);
    if(t.hit>0){c.globalAlpha=t.hit/.15*.55;c.fillStyle='#fff1c6';c.fillRect(-17,-63,34,32);c.globalAlpha=1;}
    if(t.rootUntil>w.time){for(let j=0;j<4;j++){c.strokeStyle=j%2?'#b1ce79':'#557650';c.lineWidth=3;c.beginPath();c.moveTo(-25,-4-j*9);c.bezierCurveTo(20,-12-j*6,-20,-20-j*5,25,-10-j*10);c.stroke();}}
    if(t.burnUntil>w.time){for(let i=0;i<7;i++){const phase=(w.time*1.6+i*.13)%1,x=Math.sin(i*7.4)*15;ellipse(c,x,-20-phase*70,2.5*(1-phase)+.5,6*(1-phase)+1,rgba('#ffb34d',1-phase));}}
    c.restore();
    c.fillStyle='rgba(4,8,20,.8)';c.fillRect(t.x-30,t.y-108,60,5);c.fillStyle=t.burnUntil>w.time?'#eeb574':'#b3a5ce';c.fillRect(t.x-30,t.y-108,60*t.hp/t.maxHp,5);
  }
  fox(w){this.combat.stag(w);}
  tree(w,t){this.combat.tree(w,t);}
  props(w){
    const c=this.ctx,m=w.mirror,s=w.spring;
    line(c,[[m.x-15,m.y+34],[m.x+15,m.y+34]],'#8b7f65',5);line(c,[[m.x,m.y+34],[m.x,m.y+20]],'#b6a16a',5);
    c.save();c.translate(m.x,m.y);c.rotate(m.angle);const gr=c.createLinearGradient(-11,0,11,0);gr.addColorStop(0,'#4d5c8d');gr.addColorStop(.5,'#c2d9f8');gr.addColorStop(1,'#6175a1');ellipse(c,0,0,13,29,gr);ring(c,0,0,15,31,'#d4bc82',3);line(c,[[-7,-12],[7,8]],'rgba(255,255,255,.7)',2);c.restore();
    for(let i=0;i<8;i++){const a=i/8*TAU;leaf(c,s.x,s.y-3,28+(Math.sin(a)*3),a+Math.sin(w.time*2+i)*.03,'#a3bc82');}
    const pressure=clamp(s.charge/.16,0,1);ellipse(c,s.x,s.y-6+pressure*5,20,7-pressure*3,'#e5daa1');glow(c,s.x,s.y-8,48,'#ceea93',.16+pressure*.35);
    c.font='12px "Microsoft YaHei", sans-serif';c.textAlign='center';c.fillStyle='#ddd0a6';c.fillText('月镜 · F 转向',m.x,m.y+57);c.fillText('弹跳花',s.x,s.y+31);
  }
  particles(w,e){
    if(this.roster.effect(w,e))return;
    if(this.combat.effect(w,e))return;
    const c=this.ctx,t=e.age/e.duration;
    if(['fireHit','leafHit','enemyHit','muzzle','seedCast','chips','leaves','foxBite','enemyCast'].includes(e.kind)){
      const color=e.kind.includes('fire')||e.kind==='muzzle'?'#ffb35d':e.kind==='enemyHit'||e.kind==='enemyCast'?'#c2a1ec':e.kind==='chips'?'#b3a081':'#c8de89';
      glow(c,e.x,e.y,(e.kind==='muzzle'?28:40)*(1-t*.4),color,(1-t)*.45);
      for(let i=0;i<12;i++){const a=i*2.399+(e.seed||0),r=(10+25*t)*(1+(i%3)*.3),x=e.x+Math.cos(a)*r,y=e.y+Math.sin(a)*r+t*t*18;c.globalAlpha=1-t;if(e.kind==='leafHit'||e.kind==='leaves')leaf(c,x,y,6,a+t*3,color);else ellipse(c,x,y,(i%3)+.8,2.2,color);}c.globalAlpha=1;
    }
    if(e.kind==='dust'||e.kind==='airRing'||e.kind==='spring'){ring(c,e.x,e.y-3,15+t*42,4+t*6,rgba(e.color||'#e3dbb7',(1-t)*.65),2);for(let i=0;i<8;i++)ellipse(c,e.x+Math.cos(i*6)*t*40,e.y-5-Math.sin(i)*t*9,2,2,rgba('#c8c6ae',(1-t)*.5));}
    if(e.kind==='dash'){c.save();c.globalAlpha=(1-t)*.25;for(let i=0;i<5;i++)line(c,[[e.x-e.face*(20+i*9),e.y-30+i*12],[e.x-e.face*(90+i*13),e.y-30+i*12]],e.color,3-i*.3);c.restore();}
    if(e.kind==='eruption'){
      if(e.age<e.delay){const a=e.age/e.delay;rune(c,e.x,e.y-3,50+12*a,'rgba(255,176,87,'+(.4+a*.5)+')',0);ring(c,e.x,e.y-2,95,12,'#ef9a5b',1.8);}
      else{const a=(e.age-e.delay)/(e.duration-e.delay);glow(c,e.x,e.y-45,140,'#ff9e43',(1-a)*.55);for(let i=0;i<11;i++){const xx=e.x+Math.sin(i*9)*80,hh=(80+Math.sin(i*4)*35)*Math.sin(a*Math.PI);this.flame(c,xx,e.y,hh,12+Math.sin(i)*5,1-a,w.time+i);}ring(c,e.x,e.y,90+a*35,13,'rgba(255,204,125,'+(1-a)+')',3);}
    }
    if(e.kind==='meteor'){
      const warn=clamp(e.age/e.delay,0,1);ring(c,e.x,e.y,130,20,'rgba(255,168,94,.75)',2);rune(c,e.x,e.y,50,'rgba(255,183,106,.55)',w.time*.3);
      if(e.age<e.delay){const y=lerp(-180,e.y-25,smooth(warn));glow(c,e.x,y,70,'#ff9b44',.6);c.save();c.translate(e.x,y);c.rotate(-.5);ellipse(c,0,0,32,40,'#7c402f');ring(c,0,0,31,39,'#ffd583',3);for(let i=0;i<5;i++)this.flame(c,(i-2)*13,-20,130-i*11,10,.9,w.time+i);c.restore();}
      else{const a=(e.age-e.delay)/(e.duration-e.delay);glow(c,e.x,e.y-40,220,'#ffbf6a',(1-a)*.6);for(let i=0;i<15;i++)this.flame(c,e.x+(i-7)*17,e.y,(1-a)*(90+Math.sin(i*7)*45),13,1-a,w.time+i);ring(c,e.x,e.y,150*a+50,25,'rgba(255,212,148,'+(1-a)+')',4);}
    }
    if(e.kind==='fireZone'||e.kind==='stompHit'){
      for(let i=0;i<11;i++)this.flame(c,e.x+(i-5)*14,e.y,18+Math.sin(w.time*13+i*4)*6,7,(1-t)*.85,w.time+i);
      if(e.kind==='stompHit'){glow(c,e.x,e.y-10,160,'#ffbc62',(1-t)*.5);ring(c,e.x,e.y,30+t*120,10+t*13,rgba('#ffd99a',1-t),3);}
    }
    if(e.kind==='fireLeap'){const a=1-t;for(let i=0;i<12;i++){const x=e.x-e.face*t*75+Math.sin(i*7)*15,y=e.y+t*85+Math.sin(i)*15;ellipse(c,x,y,2*a+1,5*a+1,rgba('#ffbb62',a));}glow(c,e.x,e.y,60,'#ff9c4b',a*.35);}
    if(e.kind==='roots'){
      const growth=smooth(e.age/.4),end=lerp(e.x,e.to,growth),dir=Math.sign(e.to-e.x);
      c.strokeStyle='rgba(117,153,83,'+Math.min(1,(e.duration-e.age)*2)+')';c.lineWidth=4;c.beginPath();c.moveTo(e.x,e.y);for(let x=0;x<Math.abs(end-e.x);x+=12)c.lineTo(e.x+x*dir,e.y-Math.sin(x*.045)*7-3);c.stroke();
      for(let x=0;x<Math.abs(end-e.x);x+=36){const xx=e.x+x*dir;leaf(c,xx,e.y-4,16,-1.1+Math.sin(x)*.5,'#a7c775');}
    }
    if(e.kind==='sprout'||e.kind==='treeBirth'){rune(c,e.x,e.y,20+t*42,rgba('#d2e6a0',1-t),w.time*.25);glow(c,e.x,e.y-15,60,'#a4da76',(1-t)*.4);}
    if(e.kind==='healMote'){const x=lerp(e.x,e.toX,t),y=lerp(e.y,e.toY,t)-Math.sin(t*Math.PI)*50;glow(c,x,y,18,'#c6e89b',.5);leaf(c,x,y,7,t*4,'#dcebb0');}
    if(e.kind==='mirrorFlash'||e.kind==='respawn'){glow(c,e.x,e.y,70,'#c5dafa',(1-t)*.5);ring(c,e.x,e.y,20+t*30,30+t*25,rgba('#d9e7fb',1-t),2);}
    if(e.kind==='breakBridge'){
      for(let i=0;i<12;i++){c.save();c.translate(e.x+i*e.w/12,e.y+t*t*260);c.rotate(t*(i%2?2:-3));c.fillStyle='#9d7951';c.globalAlpha=1-t;c.fillRect(-8,-4,21,10);c.restore();}
    }
  }
  flame(c,x,y,h,w,alpha,time){
    if(h<1||alpha<=0)return;c.save();c.globalAlpha=clamp(alpha,0,1);
    const g=c.createLinearGradient(0,y,0,y-h);g.addColorStop(0,'#fff3b4');g.addColorStop(.35,'#ffb54d');g.addColorStop(1,'rgba(246,91,51,0)');
    c.fillStyle=g;c.beginPath();c.moveTo(x-w,y);c.bezierCurveTo(x-w*1.2,y-h*.4,x+Math.sin(time*8)*w,y-h*.65,x+w*.15,y-h);c.bezierCurveTo(x+w*1.4,y-h*.45,x+w,y-h*.2,x+w,y);c.closePath();c.fill();c.restore();
  }
  draw(w,alpha=1,dt=.016){
    this.resize();updateCamera(w,dt);const view=cameraView(w),c=this.ctx,height=w.height||HEIGHT,sx=this.canvas.width/view.width,sy=this.canvas.height/height;c.setTransform(sx,0,0,sy,0,0);
    c.save();c.translate(-view.x,0);
    const authored=w.sceneId&&w.sceneId!=='training';
    c.fillStyle='#0b1023';c.fillRect(view.x,0,view.width,height);
    if(authored){c.save();c.filter='saturate(0.88) contrast(0.92) brightness(0.98)';this.scenePainter.background(w);c.restore();}else{
      c.drawImage(this.assets.backdrop,0,0,WIDTH,HEIGHT);
      const shade=c.createLinearGradient(0,0,0,HEIGHT);shade.addColorStop(0,'rgba(5,10,27,.09)');shade.addColorStop(.6,'rgba(5,12,30,.3)');shade.addColorStop(1,'rgba(3,8,22,.65)');c.fillStyle=shade;c.fillRect(0,0,WIDTH,HEIGHT);
    }
    c.save();if(!this.reduced&&w.shake>.2)c.translate(Math.sin((w.fxTime||w.time)*119)*w.shake,Math.cos((w.fxTime||w.time)*97)*w.shake*.45);
    for(const b of w.platforms)if(!authored&&b.type!=='ice')this.platform(b,w.time);
    if(authored){c.save();c.filter='saturate(0.88) contrast(0.92) brightness(0.98)';for(const b of w.obstacles||[])this.scenePainter.cover(w,b);this.scenePainter.back(w);c.restore();}else this.props(w);
    this.combat.target(w);this.roster.before(w);
    for(const t of w.trees)this.tree(w,t);
    for(const t of w.targets)this.dummy(w,t);
    for(const e of w.effects)if(['roots','fireZone','treeBirth'].includes(e.kind))this.particles(w,e);
    this.fox(w);
    for(const g of w.ghosts||[]){c.save();c.globalAlpha=Math.pow(Math.max(0,1-g.age/(g.duration||.8)),1.1)*(w.hero==='shadow'?.62:.32);c.filter=w.hero==='shadow'?'brightness(1.7) sepia(.8) hue-rotate(215deg) saturate(2.1)':'brightness(1.5) saturate(.8)';c.shadowColor=w.hero==='shadow'?'#c9a6ff':'#fff0ba';c.shadowBlur=4;this.hero({...w,player:{...w.player,x:g.x,prevX:g.x,y:g.y,prevY:g.y,face:g.face,cycle:g.cycle,grounded:g.grounded,invuln:0,passiveGlow:0}},1,0,{poseOverride:g.pose});c.restore();}
    this.hero(w,alpha,dt);this.roster.passive(w);
    for(const s of w.projectiles){
      if(this.roster.projectile(w,s)||this.combat.projectile(w,s))continue;
      const color=s.kind==='fireball'?'#ffb35d':s.kind==='seed'?'#c4df85':'#c4a8f2';
      glow(c,s.x,s.y,25,color,.5);
      const a=Math.atan2(s.vy,s.vx);c.save();c.translate(s.x,s.y);c.rotate(a);
      if(s.kind==='seed')leaf(c,-8,0,15,0,color);
      else{const g=c.createLinearGradient(-44,0,8,0);g.addColorStop(0,rgba(color,0));g.addColorStop(.8,color);g.addColorStop(1,'#fff2c7');c.fillStyle=g;c.beginPath();c.moveTo(-44,0);c.quadraticCurveTo(-10,-11,7,0);c.quadraticCurveTo(-10,11,-44,0);c.fill();}c.restore();
    }
    for(const e of w.effects)if(!['roots','fireZone','treeBirth'].includes(e.kind)&&!(authored&&e.kind==='breakBridge'))this.particles(w,e);
    if(authored)this.scenePainter.front(w);
    if(w.debugGeometry)this.scenePainter.geometry(w);
    c.textAlign='center';for(const t of w.texts){c.globalAlpha=clamp((t.duration-t.age)*2,0,1);c.font='600 '+t.size+'px "Microsoft YaHei", sans-serif';c.strokeStyle='#142036';c.lineWidth=3;c.strokeText(t.text,t.x,t.y);c.fillStyle=t.color;c.fillText(t.text,t.x,t.y);}c.globalAlpha=1;
    c.restore();
    const aim=w.aim;c.strokeStyle='rgba(239,224,180,.6)';c.lineWidth=1;ring(c,aim.x,aim.y,8,8,'rgba(239,224,180,.45)',1);line(c,[[aim.x-13,aim.y],[aim.x-9,aim.y]],c.strokeStyle,1);line(c,[[aim.x+9,aim.y],[aim.x+13,aim.y]],c.strokeStyle,1);
    c.restore();
    if(!this.reduced&&w.flash>0){c.fillStyle='rgba(255,197,118,'+Math.min(.17,w.flash*1.2)+')';c.fillRect(0,0,view.width,height);}
    if((w.width||WIDTH)>WIDTH){
      const x=view.width-210,y=height-47,mw=182,mh=28,scale=mw/w.width;
      c.fillStyle='#06101cce';c.fillRect(x-8,y-16,mw+16,mh+22);c.strokeStyle='#bda16c';c.lineWidth=1;c.strokeRect(x,y,mw,mh);
      c.fillStyle='#e4d096';c.font='10px sans-serif';c.textAlign='left';c.fillText('2304 · 双侧回廊',x,y-5);
      c.strokeStyle='#c6d9e877';c.strokeRect(x+view.x*scale,y,view.width*scale,mh);
      c.fillStyle=HEROES[w.hero].color;c.fillRect(x+w.player.x*scale-2,y+mh*.6,4,6);
      for(const t of w.targets)if(t.hp>0){c.fillStyle='#ef8e98';c.fillRect(x+t.x*scale-2,y+mh*(t.y/height)-2,4,4);}
      const off=w.targets.find(t=>t.hp>0&&(t.x<view.x||t.x>view.x+view.width));
      if(off){const right=off.x>view.x+view.width,xx=right?view.width-28:28;c.fillStyle='#f2c78e';c.font='14px sans-serif';c.textAlign=right?'right':'left';c.fillText(right?'对手 →':'← 对手',xx,height-100);}
    }
  }
}
