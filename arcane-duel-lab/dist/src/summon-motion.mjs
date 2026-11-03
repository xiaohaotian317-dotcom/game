import {POOLS,SUMMON_RECTS,portraitMotion} from './summon-pools.mjs';

function image(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('英雄立绘加载失败'));im.src=src;});}
function triangle(c,img,source,dest){
 const [s0,s1,s2]=source,[d0,d1,d2]=dest;
 const a=s1.x-s0.x,b=s1.y-s0.y,d=s2.x-s0.x,e=s2.y-s0.y,det=a*e-b*d;
 if(!det)return;
 const A=((d1.x-d0.x)*e-(d2.x-d0.x)*b)/det,C=((d2.x-d0.x)*a-(d1.x-d0.x)*d)/det;
 const B=((d1.y-d0.y)*e-(d2.y-d0.y)*b)/det,D=((d2.y-d0.y)*a-(d1.y-d0.y)*d)/det;
 c.save();c.beginPath();for(const [i,p]of dest.entries()){const cx=(d0.x+d1.x+d2.x)/3,cy=(d0.y+d1.y+d2.y)/3,x=cx+(p.x-cx)*1.006,y=cy+(p.y-cy)*1.006;i?c.lineTo(x,y):c.moveTo(x,y);}c.closePath();c.clip();c.transform(A,B,C,D,d0.x-A*s0.x-C*s0.y,d0.y-B*s0.x-D*s0.y);c.drawImage(img,0,0);c.restore();
}
export class SummonPortrait{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.hero='fire';this.enabled=true;this.textures={};this.transition=0;this.start=performance.now();this.previous=0;this.frame=0;this.ready=image('assets/lobby/hero-splashes-v1.png').then(im=>{for(const [hero,r]of Object.entries(SUMMON_RECTS)){const tile=document.createElement('canvas');tile.width=r[2];tile.height=r[3];tile.getContext('2d').drawImage(im,...r,0,0,r[2],r[3]);this.textures[hero]=tile;}this.draw(performance.now());});}
 setHero(hero){this.hero=hero;this.transition=performance.now();this.canvas.setAttribute('aria-label',POOLS[hero].title+' · 英雄动态立绘');this.request();}
 setMotion(enabled){this.enabled=enabled;if(!enabled){cancelAnimationFrame(this.frame);this.frame=0;this.previous=0;this.draw(performance.now());}else this.request();}
 request(){if(!this.frame)this.frame=requestAnimationFrame(t=>this.draw(t));}
 draw(now){
  this.frame=0;if(!this.textures[this.hero])return;if(this.enabled&&now-this.previous<1000/30){this.request();return;}this.previous=now;
  const c=this.c,canvas=this.canvas,r=canvas.getBoundingClientRect(),dpr=Math.min(1.5,devicePixelRatio||1);
  if(r.width<1||r.height<1)return;
  const width=Math.round(r.width*dpr),height=Math.round(r.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,r.width,r.height);
  const texture=this.textures[this.hero],scale=Math.min(r.width/(texture.width*1.07),r.height/(texture.height*1.03)),w=texture.width*scale,h=texture.height*scale;
  const t=this.enabled?(now-this.start)/1000:0,enter=Math.min(1,(now-this.transition)/450),x=(r.width-w)/2+(1-enter)*12,y=(r.height-h)/2;
  c.save();c.globalAlpha=enter;c.translate(x,y);c.scale(scale,scale);
  if(!this.enabled)c.drawImage(texture,0,0);else{
   const cols=12,rows=18,points=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){const u=i/cols,v=j/rows,m=portraitMotion(this.hero,u,v,t);points.push({s:{x:u*texture.width,y:v*texture.height},d:{x:u*texture.width+m.x,y:v*texture.height+m.y}});}
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=points[j*(cols+1)+i],b=points[j*(cols+1)+i+1],d=points[(j+1)*(cols+1)+i],e=points[(j+1)*(cols+1)+i+1];triangle(c,texture,[a.s,b.s,d.s],[a.d,b.d,d.d]);triangle(c,texture,[b.s,e.s,d.s],[b.d,e.d,d.d]);}
  }
  c.restore();
  if(this.enabled)this.effects(c,r.width,r.height,t,{x,y,w,h});
  if((this.enabled&&!document.hidden)||enter<1)this.request();
 }
 effects(c,width,height,t,placement){
  const d=POOLS[this.hero],color=d.color;
  c.save();c.globalCompositeOperation='screen';
  for(let i=0;i<19;i++){const phase=(t*(.026+i%4*.006)+i*.137)%1,angle=i*2.4+t*.06,x=width*(.5+Math.sin(angle)*(.2+i%5*.025)),y=height*(1-phase),alpha=Math.sin(phase*Math.PI)*.5;c.globalAlpha=alpha;c.fillStyle=color;c.shadowColor=color;c.shadowBlur=7;c.beginPath();c.ellipse(x,y,1+i%3*.3,this.hero==='nature'?2.5:1.4,angle,0,Math.PI*2);c.fill();}
  const gx=placement.x+d.glow[0]*placement.w,gy=placement.y+d.glow[1]*placement.h,glow=c.createRadialGradient(gx,gy,0,gx,gy,64);glow.addColorStop(0,color+'4d');glow.addColorStop(.35,color+'18');glow.addColorStop(1,color+'00');c.globalAlpha=.48+Math.sin(t*1.6)*.14;c.fillStyle=glow;c.fillRect(gx-64,gy-64,128,128);c.restore();
 }
 destroy(){cancelAnimationFrame(this.frame);this.frame=0;}
}
