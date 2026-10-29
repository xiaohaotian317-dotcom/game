import {hammerPosition} from './scene-mechanics.mjs?v=20261029-combat7';
const TAU=Math.PI*2;
function glow(c,x,y,r,color,alpha){c.save();c.globalAlpha=alpha;const g=c.createRadialGradient(x,y,1,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
export class ScenePainter{
  constructor(assets,ctx){this.assets=assets;this.ctx=ctx;}
  prop(scene,key,x,y,width,{ax=.5,ay=1,angle=0,alpha=1,height}={}){
    const c=this.ctx,b=this.assets.sceneBounds[scene][key],h=height||width*b.h/b.w;
    c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);
    c.drawImage(this.assets[scene+'Props'],b.x,b.y,b.w,b.h,-width*ax,-h*ay,width,h);c.restore();
    return {width,height:h};
  }
  background(w){
    const c=this.ctx,im=this.assets[w.sceneId+'Field'],o=w.sceneOffset||0;
    c.drawImage(im,o,0,1440,w.height);
    if(o){
      c.save();c.translate(o,0);c.scale(-1,1);c.drawImage(im,0,0,im.width*o/1440,im.height,0,0,o,w.height);c.restore();
      c.save();c.translate(w.width,0);c.scale(-1,1);c.drawImage(im,im.width*(1440-o)/1440,0,im.width*o/1440,im.height,0,0,o,w.height);c.restore();
    }
  }
  cover(w,b){
    const c=this.ctx,im=this.assets['stone-covers-v2'],a=this.assets.combatBounds['stone-covers-v2'][w.sceneId];
    c.save();c.shadowColor='#030611';c.shadowBlur=8;c.drawImage(im,a.x,a.y,a.w,a.h,b.x,b.y,b.w,b.h);c.restore();
  }
  chain(x,y,endX,endY,width=5){
    const dx=endX-x,dy=endY-y,length=Math.hypot(dx,dy),c=this.ctx;
    c.save();c.translate(x,y);c.rotate(-Math.atan2(dx,dy));
    const b=this.assets.sceneBounds.lava.chain,im=this.assets.lavaProps,segments=Math.max(1,Math.ceil(length/57));
    for(let i=0;i<segments;i++){const h=Math.min(57,length-i*57);c.drawImage(im,b.x,b.y,b.w,b.h,-width/2,i*57,width,h);}
    c.restore();
  }
  marker(x,y,n){const c=this.ctx;c.save();c.fillStyle='#091222da';c.strokeStyle='#d9b969';c.lineWidth=1.4;c.beginPath();c.arc(x,y,13,0,TAU);c.fill();c.stroke();c.fillStyle='#ffe5a0';c.font='19px Georgia,serif';c.textAlign='center';c.textBaseline='middle';c.fillText(n,x,y+.6);c.restore();}
  back(w){
    const m=w.mechanisms,c=this.ctx;if(!m)return;
    if(w.sceneId==='moon'){
      const bridge=w.platforms.find(p=>p.id==='bridge');
      if(bridge.active)this.prop('moon','bridge',bridge.x+bridge.w/2,bridge.y,bridge.w+12,{ay:.65});
      const mirror=w.mirror;c.save();c.translate(mirror.x,mirror.y+61);c.scale(mirror.angle<0?1:-1,1);this.prop('moon','mirror',0,0,96);c.restore();
      const l=m.lift;this.chain(l.x+10,191,l.x+10,l.y-8,5);this.chain(l.x+l.w-10,191,l.x+l.w-10,l.y-8,5);
      this.prop('moon','lift',l.x+l.w/2,l.y,l.w+8,{ay:.28});
      this.prop('moon','switch',l.switchX,l.switchY,30,{ay:.5});
      glow(c,l.switchX,l.switchY,35,'#ffc477',.16+m.flash*.25);
      if(m.flash>0){c.save();c.globalAlpha=m.flash*.6;c.strokeStyle='#ebd69d';c.setLineDash([6,5]);c.lineWidth=1;c.strokeRect(l.x,l.high,l.w,12);c.strokeRect(l.x,l.low,l.w,12);c.restore();}
      this.marker(bridge.x+bridge.w/2,bridge.y-48,1);this.marker(l.switchX,l.switchY-48,2);this.marker(mirror.x-16,mirror.y-54,3);
    }
    if(w.sceneId==='lava'){
      const v=m.valve;this.prop('lava','wheel',v.x,v.y,76,{ay:.5,angle:v.angle});
      for(const vent of m.vents)this.prop('lava','vent',vent.x,vent.y+5,112,{ay:.40});
      const h=m.hammer,p=hammerPosition(h);this.chain(h.anchorX,h.anchorY,p.x,p.y-36,6);
      this.prop('lava','hammer',p.x,p.y,156,{ay:.52,angle:-h.angle});
      if(h.pulse>0)glow(c,p.x,p.y,95,'#ffb963',h.pulse*.6);
      this.marker(m.vents[m.valve.route].x,w.floor-31,1);this.marker(v.x-48,v.y-34,2);this.marker(p.x+83,p.y-25,3);
    }
    if(w.sceneId==='garden'){
      const wind=m.wind;this.chain(wind.x,73,wind.x,105,3);
      this.prop('garden','chime',wind.x,105,67,{ay:0,angle:Math.sin(w.time*1.8)*.025});
      this.wind(w);const v=m.vine;
      if(v.growth>0){c.save();c.beginPath();c.rect(v.x-8,v.y-75,(v.w+16)*v.growth,155);c.clip();const alpha=w.time>=v.until?v.growth*.45:v.until-w.time<1.5?.70+Math.sin(w.time*15)*.25:1;this.prop('garden','vine',v.x+v.w/2,v.y,v.w+18,{ay:.22,alpha});c.restore();}
      this.prop('garden','bud',v.budX,v.budY+27,36,{ay:1});glow(c,v.budX,v.budY,28,'#ffdc88',.20);
      const spring=w.spring,press=spring.charge/.16;this.prop('garden','flower',spring.x,spring.y+7,132*(1+press*.04),{ay:1});
      glow(c,spring.x,spring.y-15,62,'#ffe4a1',.08+press*.15);
      this.marker(wind.x,91,1);this.marker(v.budX,v.budY-24,2);this.marker(spring.x+46,spring.y-62,3);
    }
    for(const e of w.effects)if(e.kind==='breakBridge')this.bridgeDebris(w,e);
  }
  bridgeDebris(w,e){
    const c=this.ctx,b=this.assets.sceneBounds.moon.bridge,t=e.age/e.duration,im=this.assets.moonProps;
    for(let i=0;i<8;i++){c.save();c.globalAlpha=1-t;c.translate(e.x+(i+.5)*e.w/8+(i-3.5)*t*12,e.y-10+t*t*190);c.rotate((i%2?1:-1)*t*1.6);c.drawImage(im,b.x+b.w*i/8,b.y,b.w/8,b.h,-e.w/16,-36,e.w/8,73);c.restore();}
  }
  wind(w){
    const c=this.ctx,f=w.mechanisms.wind,dir=f.direction;
    c.save();c.globalCompositeOperation='screen';
    for(let j=0;j<5;j++){
      const offset=Math.sin(w.time*1.2+j)*7,startX=f.x+dir*18,startY=f.y+20+j*9;
      const gradient=c.createLinearGradient(startX,0,startX+dir*260,0);gradient.addColorStop(0,'#a2e6ec00');gradient.addColorStop(.3,'#82dfe9aa');gradient.addColorStop(.6,'#d7fbffdd');gradient.addColorStop(1,'#a2e6ec00');
      c.strokeStyle=gradient;c.lineWidth=j%2?1.6:3.1;c.shadowColor='#74d4ee';c.shadowBlur=8;c.beginPath();c.moveTo(startX,startY);c.bezierCurveTo(startX+dir*100,startY+62+offset,startX+dir*300,startY-26+offset,startX+dir*250,startY+80);c.stroke();
    }
    c.shadowBlur=0;c.globalCompositeOperation='source-over';
    for(let i=0;i<11;i++){const t=(w.time*.32+i*.091)%1,x=f.x+dir*(20+t*250),y=f.y+25+t*65+Math.sin(t*6+i)*18;c.save();c.translate(x,y);c.rotate(t*4+i);c.fillStyle=i%2?'#c9cd6b':'#a5b65b';c.beginPath();c.ellipse(0,0,5,2,0,0,TAU);c.fill();c.restore();}c.restore();
  }
  front(w){
    if(w.sceneId!=='lava')return;const c=this.ctx;
    for(const v of w.mechanisms.vents){
      if(v.mode==='warning'){
        const a=.3+.35*Math.sin(w.time*16);glow(c,v.x,v.y-5,78,'#ff813f',a);c.save();c.strokeStyle='#ffcc75';c.lineWidth=2;c.beginPath();c.ellipse(v.x,v.y-3,51,8,0,0,TAU);c.stroke();c.restore();
      }
      if(v.mode==='fire'){
        const age=v.progress-1.25,h=175*Math.min(1,age*8)*Math.min(1,(2.55-v.progress)*6);
        glow(c,v.x,v.y-h*.45,160,'#ff9b37',.42);c.save();c.globalCompositeOperation='screen';
        for(let i=0;i<10;i++){
          const x=v.x+Math.sin(i*7.1)*24,width=10+Math.sin(i)*4,hh=h*(.85+.15*Math.sin(w.time*17+i));
          const g=c.createLinearGradient(x,v.y,x,v.y-hh);g.addColorStop(0,'#fff5b9');g.addColorStop(.35,'#ffb338');g.addColorStop(.85,'#f96d2d');g.addColorStop(1,'#ff6b2200');c.fillStyle=g;
          c.beginPath();c.moveTo(x-width,v.y);c.bezierCurveTo(x-width*2,v.y-hh*.4,x+Math.sin(w.time*11+i)*13,v.y-hh*.65,x+2,v.y-hh);c.bezierCurveTo(x+width*2,v.y-hh*.4,x+width,v.y-hh*.2,x+width,v.y);c.fill();
        }c.restore();
      }
    }
  }
  geometry(w){const c=this.ctx;c.save();c.strokeStyle='#ff697e';c.fillStyle='#fff0c7';c.lineWidth=1;c.font='10px monospace';for(const b of w.platforms)if(b.active&&b.x>=0){c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x+b.w,b.y);c.stroke();c.fillText(b.id,b.x+3,b.y-4);}c.restore();}
}
