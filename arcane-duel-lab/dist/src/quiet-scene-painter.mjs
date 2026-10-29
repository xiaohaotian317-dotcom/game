import {ScenePainter as DetailedPainter} from './scene-painter.mjs?v=20261029-combat9';
import {hammerPosition} from './scene-mechanics.mjs?v=20261029-combat9';
const TAU=Math.PI*2;
const PALETTE={moon:{body:'#374650',edge:'#72818a',low:'#28353f'},lava:{body:'#423b44',edge:'#82747a',low:'#302d36'},garden:{body:'#3b4d46',edge:'#798c7c',low:'#2a3c37'}};
function oval(c,x,y,rx,ry,fill){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();}
// Quiet backgrounds and independent foreground silhouettes replace the dense
// painted arena. These are new assets, rendered at full opacity without filters.
export class ScenePainter extends DetailedPainter{
  background(w){this.ctx.drawImage(this.assets[w.sceneId+'Quiet'],0,0,w.width,w.height);}
  slab(key,x,y,width,height=28){
    const c=this.ctx,b=this.assets.quietBounds[key],im=this.assets.quietTerrain,cap=Math.min(width*.22,b.w*.12*height/b.h),edge=b.w*.12;
    c.drawImage(im,b.x,b.y,edge,b.h,x,y,cap,height);
    const middleWidth=b.w-edge*2,tile=middleWidth*height/b.h,end=x+width-cap;
    for(let at=x+cap;at<end;at+=tile){const size=Math.min(tile,end-at);c.drawImage(im,b.x+edge,b.y,middleWidth*size/tile,b.h,at,y,size+.25,height);}
    c.drawImage(im,b.x+b.w-edge,b.y,edge,b.h,x+width-cap,y,cap,height);
  }
  platform(w,b){
    if(!b.active||b.x<0||['wood','lift','vine','root','cover'].includes(b.type))return;
    const c=this.ctx,p=PALETTE[w.sceneId];
    if(b.id==='ground'){const g=c.createLinearGradient(0,b.y,0,w.height);g.addColorStop(0,p.body);g.addColorStop(1,p.low);c.fillStyle=g;c.fillRect(b.x,b.y+14,b.w,w.height-b.y);}
    this.slab(w.sceneId,b.x,b.y,b.w,b.renderDepth||28);
    c.strokeStyle=p.edge;c.lineWidth=1;c.beginPath();c.moveTo(b.x+4,b.y+1);c.lineTo(b.x+b.w-4,b.y+1);c.stroke();
  }
  cover(w,b){
    const c=this.ctx,p=PALETTE[w.sceneId];c.save();c.fillStyle=p.low;c.fillRect(b.x,b.y+8,b.w,b.h-8);
    c.fillStyle=p.body;c.fillRect(b.x+3,b.y+15,b.w-6,b.h-15);c.strokeStyle=p.low;c.lineWidth=2;
    c.beginPath();c.moveTo(b.x+3,b.y+49);c.lineTo(b.x+b.w-3,b.y+49);c.moveTo(b.x+b.w*.57,b.y+14);c.lineTo(b.x+b.w*.57,b.y+49);c.stroke();
    this.slab(w.sceneId,b.x-2,b.y,b.w+4,15);c.restore();
  }
  chain(x,y,endX,endY,width=3){
    const c=this.ctx;c.save();c.strokeStyle='#59636b';c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(endX,endY);c.stroke();
    const length=Math.hypot(endX-x,endY-y);c.lineWidth=1;for(let at=12;at<length;at+=24){const t=at/length,xx=x+(endX-x)*t,yy=y+(endY-y)*t;c.beginPath();c.moveTo(xx-3,yy);c.lineTo(xx+3,yy+2);c.stroke();}c.restore();
  }
  marker(x,y,n){const c=this.ctx;c.save();oval(c,x,y,10,10,'#29373ee8');c.strokeStyle='#83928f';c.lineWidth=1;c.stroke();c.fillStyle='#c1c8bd';c.font='13px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText(n,x,y+.5);c.restore();}
  back(w){
    const m=w.mechanisms,c=this.ctx;if(!m)return;c.save();
    if(w.sceneId==='moon'){
      const b=w.platforms.find(p=>p.id==='bridge');if(b.active)this.slab('wood',b.x,b.y,b.w,19);
      const v=w.mirror;c.save();c.translate(v.x,v.y);c.scale(v.angle<0?1:-1,1);c.strokeStyle='#787e75';c.lineWidth=4;c.beginPath();c.moveTo(-18,60);c.lineTo(18,60);c.moveTo(0,60);c.lineTo(0,26);c.stroke();
      c.rotate(-.22);oval(c,0,0,18,31,'#5b707e');c.strokeStyle='#929389';c.lineWidth=3;c.stroke();c.strokeStyle='#8198a4';c.lineWidth=1;c.beginPath();c.moveTo(-9,-14);c.lineTo(9,10);c.stroke();c.restore();
      const l=m.lift;this.chain(l.x+12,191,l.x+12,l.y,3);this.chain(l.x+l.w-12,191,l.x+l.w-12,l.y,3);
      this.slab('wood',l.x,l.y,l.w,18);c.fillStyle='#77796c';c.fillRect(l.x+10,l.y+3,l.w-20,5);
      c.fillStyle=m.flash>0?'#c5b58c':'#7c8276';c.beginPath();c.roundRect(l.switchX-10,l.switchY-17,20,34,4);c.fill();c.strokeStyle='#bdc5ae';c.lineWidth=1.4;c.beginPath();c.moveTo(l.switchX,l.switchY-10);c.lineTo(l.switchX+5,l.switchY);c.lineTo(l.switchX,l.switchY+10);c.lineTo(l.switchX-5,l.switchY);c.closePath();c.stroke();
      this.marker(b.x+b.w/2,b.y-25,1);this.marker(l.switchX,l.switchY-35,2);this.marker(v.x-24,v.y-38,3);
    }
    if(w.sceneId==='lava'){
      const v=m.valve;c.save();c.translate(v.x,v.y);c.rotate(v.angle);oval(c,0,0,31,31,'#514b4b');c.strokeStyle='#8b8072';c.lineWidth=4;c.stroke();for(let i=0;i<5;i++){const a=i/5*TAU;c.beginPath();c.moveTo(Math.cos(a)*8,Math.sin(a)*8);c.lineTo(Math.cos(a)*25,Math.sin(a)*25);c.stroke();}oval(c,0,0,8,8,'#9a8c76');c.restore();
      for(const vent of m.vents){oval(c,vent.x,vent.y+3,47,8,'#655653');oval(c,vent.x,vent.y+1,35,4,'#3b333b');}
      const h=m.hammer,p=hammerPosition(h);this.chain(h.anchorX,h.anchorY,p.x,p.y-32,4);
      c.save();c.translate(p.x,p.y);c.rotate(-h.angle);c.fillStyle='#514b50';c.beginPath();c.roundRect(-67,-31,134,62,8);c.fill();c.fillStyle='#82766c';c.fillRect(-54,-31,10,62);c.fillRect(44,-31,10,62);c.strokeStyle=h.pulse>0?'#c8a17e':'#837c75';c.lineWidth=2;c.strokeRect(-26,-19,52,38);c.beginPath();c.moveTo(-16,0);c.lineTo(0,-12);c.lineTo(16,0);c.lineTo(0,12);c.closePath();c.stroke();c.restore();
      this.marker(m.vents[m.valve.route].x,w.floor-23,1);this.marker(v.x-43,v.y-26,2);this.marker(p.x+78,p.y-21,3);
    }
    if(w.sceneId==='garden'){
      const f=m.wind;this.chain(f.x,73,f.x,116,2);c.strokeStyle='#7d8c7d';c.lineWidth=2;c.beginPath();c.arc(f.x,136,22,Math.PI,TAU);c.stroke();
      for(let i=0;i<4;i++){const x=f.x-18+i*12,y=151+(i%2)*16;this.chain(x,133,x,y,1);c.fillStyle=i%2?'#809b92':'#8a9e91';c.beginPath();c.moveTo(x,y);c.lineTo(x+4,y+10);c.lineTo(x,y+22);c.lineTo(x-4,y+10);c.closePath();c.fill();}
      this.wind(w);const v=m.vine;
      if(v.growth>0){const end=v.x+v.w*v.growth;c.lineCap='round';for(let j=0;j<2;j++){c.strokeStyle=j?'#788870':'#4b6051';c.lineWidth=5;c.beginPath();for(let x=v.x;x<=end;x+=4){const y=v.y+7+Math.sin((x-v.x)/23+j*Math.PI)*4;if(x===v.x)c.moveTo(x,y);else c.lineTo(x,y);}c.stroke();}}
      oval(c,v.budX,v.budY+10,12,5,'#778772');oval(c,v.budX,v.budY,5,11,m.flash>0?'#c8ce9a':'#a6b48c');
      const s=w.spring,press=s.charge/.16;c.save();c.translate(s.x,s.y-9+press*3);for(let i=0;i<6;i++){const sign=i%2?1:-1;c.save();c.translate(sign*(8+Math.floor(i/2)*10),-Math.floor(i/2)*2);c.rotate(sign*-.23);oval(c,0,0,19,6,i%3?'#83957f':'#a5b29a');c.restore();}oval(c,0,-7,9,5,press>0?'#e0d3a2':'#b3bd98');c.restore();
      this.marker(f.x+30,125,1);this.marker(v.budX+20,v.budY-17,2);this.marker(s.x+49,s.y-31,3);
    }
    for(const e of w.effects)if(e.kind==='breakBridge')this.bridgeDebris(w,e);c.restore();
  }
  bridgeDebris(w,e){const c=this.ctx,b=this.assets.quietBounds.wood,im=this.assets.quietTerrain,t=e.age/e.duration;for(let i=0;i<8;i++){c.save();c.globalAlpha=1-t;c.translate(e.x+(i+.5)*e.w/8+(i-3.5)*t*12,e.y+t*t*190);c.rotate((i%2?1:-1)*t*1.6);c.drawImage(im,b.x+b.w*i/8,b.y,b.w/8,b.h,-e.w/16,0,e.w/8,23);c.restore();}}
  wind(w){const c=this.ctx,f=w.mechanisms.wind,dir=f.direction;c.save();c.strokeStyle='#8eaeaa66';c.lineWidth=1.4;for(let i=0;i<2;i++){c.beginPath();c.moveTo(f.x+dir*20,f.y+25+i*15);c.bezierCurveTo(f.x+dir*95,f.y+80+i*8,f.x+dir*210,f.y+12+i*8,f.x+dir*250,f.y+80+i*10);c.stroke();}for(let i=0;i<4;i++){const t=(w.time*.32+i*.25)%1;oval(c,f.x+dir*(20+t*250),f.y+30+t*60,3,1,'#9aa68b');}c.restore();}
}
