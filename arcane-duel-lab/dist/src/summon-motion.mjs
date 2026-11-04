import {SUMMON_RECTS,SUMMON_REGIONS,POOLS,portraitPlacement} from './summon-pools.mjs';

// Static portraits: repaint only after image load, a pool change or resize.
// The former motion preference is intentionally ignored for every hero.
export class SummonPortrait{
 constructor(canvas){
  this.canvas=canvas;this.c=canvas.getContext('2d');this.hero='fire';this.textures={};this.frame=0;
  this.ready=new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('英雄立绘载入失败'));im.src='assets/lobby/hero-splashes-v1.png';}).then(im=>{
   for(const [hero,r]of Object.entries(SUMMON_RECTS)){const tile=document.createElement('canvas');tile.width=r[2];tile.height=r[3];const ctx=tile.getContext('2d');ctx.beginPath();for(const [x,y,w,h]of SUMMON_REGIONS[hero])ctx.rect(x-r[0],y-r[1],w,h);ctx.clip();ctx.drawImage(im,...r,0,0,r[2],r[3]);this.textures[hero]=tile;}
   this.request();
  });
 }
 setHero(hero){this.hero=hero;this.canvas.setAttribute('aria-label',POOLS[hero].title+' · 英雄静态立绘');this.request();}
 request(){if(!this.frame)this.frame=requestAnimationFrame(()=>{this.frame=0;this.draw();});}
 draw(){
  if(!this.textures[this.hero])return;
  const canvas=this.canvas,c=this.c,r=canvas.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1);
  if(r.width<1||r.height<1)return;
  const width=Math.round(r.width*dpr),height=Math.round(r.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,r.width,r.height);
  const p=portraitPlacement(this.hero,r.width,r.height);c.drawImage(this.textures[this.hero],p.x,p.y,p.w,p.h);
 }
 destroy(){cancelAnimationFrame(this.frame);this.frame=0;}
}
