import {fract,noise,lightningPath,shadowSlashShape} from './vfx-geometry.mjs?v=20261029-ui10';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ease=v=>1-Math.pow(1-clamp(v,0,1),3);
const colors={frost:'#a9e9ff',lightning:'#ffe191',shadow:'#c6a5ff',star:'#d2bbff'};
function ring(c,x,y,rx,ry,color,width=2,rot=0){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),rot,0,TAU);c.stroke();}
function line(c,pts,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function glow(c,x,y,r,color,alpha=.35){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
function star(c,x,y,r,color,rot=0){c.save();c.translate(x,y);c.rotate(rot);c.fillStyle=color;c.beginPath();for(let i=0;i<8;i++){const a=i*TAU/8-Math.PI/2,rr=i%2?r*.19:r;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.restore();}
function snow(c,x,y,r,rot=0){c.save();c.translate(x,y);c.rotate(rot);c.strokeStyle='#dff8ff';c.lineWidth=.8;c.beginPath();for(let i=0;i<6;i++){const a=i*TAU/6,dx=Math.cos(a),dy=Math.sin(a);c.moveTo(0,0);c.lineTo(dx*r,dy*r);for(const side of [-1,1]){c.moveTo(dx*r*.55,dy*r*.55);c.lineTo(dx*r*.55+Math.cos(a+side*2.2)*r*.33,dy*r*.55+Math.sin(a+side*2.2)*r*.33);}}c.stroke();c.restore();}
export class RosterPainter{
  constructor(ctx,assets){this.c=ctx;this.assets=assets;}
  sprite(hero,index,x,y,w,h,angle=0,alpha=1){const c=this.c,a=this.assets[hero+'Fx'],b=this.assets.rosterBounds?.[hero]?.fx[index];if(!a||!b)return;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.drawImage(a,b.x,b.y,b.w,b.h,-w/2,-h/2,w,h);c.restore();}
  bolt(x0,y0,x1,y1,clock,seed=0,width=2){const c=this.c,pts=lightningPath(x0,y0,x1,y1,clock,seed);c.save();line(c,pts,'#8fcfff55',width*3.4);line(c,pts,'#ffce6bcc',width*1.9);line(c,pts,'#fff7dd',width*.7);for(const i of [4,8,11]){const p=pts[i],q=pts[Math.min(14,i+2)],side=i%2?1:-1;line(c,[p,[p[0]+(q[0]-p[0])*1.5+side*10,p[1]+(q[1]-p[1])*1.5-side*12]],i%2?'#ffe3a2':'#b9eaff',width*.55);}c.restore();}
  motes(x,y,age,count,color,speed=115){const c=this.c;for(let i=0;i<count;i++){const a=i*2.399+noise(i),r=age*speed*(.3+noise(i+7));star(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.64+age*age*20,1+noise(i+23)*2.5,color,a+age);}}
  slash(e,t){const c=this.c,g=shadowSlashShape(t);c.save();c.translate(e.x,e.y);c.scale((e.face||1)*(e.rangeScale||1),e.rangeScale||1);this.sprite('shadow',0,g.center,0,g.width,g.height,g.angle,.92);for(const [i,pts] of g.arcs.entries()){c.strokeStyle=i?'#b785ff':'#f5eaff';c.lineWidth=i?1:2;c.beginPath();c.moveTo(...pts[0]);c.quadraticCurveTo(...pts[1],...pts[2]);c.stroke();}star(c,g.tip.x,g.tip.y,5*(1-t),'#f6eaff',.3);c.restore();}
  projectile(w,s){const hero={iceNeedle:'frost',arc:'lightning',starBolt:'star'}[s.kind];if(!hero)return false;const c=this.c,a=Math.atan2(s.vy,s.vx);c.save();
    const trail=s.trail||[];for(let i=1;i<trail.length;i++){c.globalAlpha=i/trail.length*.7;line(c,[[trail[i-1].x,trail[i-1].y],[trail[i].x,trail[i].y]],colors[hero],1+i/trail.length*1.4);if(i%3===0)star(c,trail[i].x,trail[i].y+Math.sin(i+w.fxTime*9)*4,1.5,hero==='star'?'#ffe2a6':'#dff8ff',w.time);}
    c.globalAlpha=1;glow(c,s.x,s.y,22,colors[hero],.28);this.sprite(hero,0,s.x-27*Math.cos(a),s.y-27*Math.sin(a),100,44,a);if(s.homing)ring(c,s.x,s.y,14,8,'#ffe9b9bb',1,w.time*4);c.restore();return true;}
  frostField(w,f){const c=this.c,g=ease(f.age/.55),height=Math.min(242,f.y-14)*g;
    this.sprite('frost',3,f.x,f.y-height*.51,height*876/619,height,0,.82);glow(c,f.x,f.y-35,160,'#8fe5ff',.12);
    for(let j=0;j<3;j++)ring(c,f.x,f.y-3,f.r*(.62+j*.18),10+j*4,j%2?'#9adfff88':'#e1faff99',j===0?1.7:1);
    for(let i=0;i<42;i++){const n=noise(i+11),life=fract(w.time*(.20+n*.14)+i*.173),xx=f.x+(noise(i+31)-.5)*f.r*1.88+Math.sin(life*8+i)*12,yy=f.y-14-Math.min(200,f.y-18)*(1-life);c.save();c.globalAlpha*=Math.sin(Math.PI*life)*(.4+n*.45);if(i%3===0)snow(c,xx,yy,2+n*3.5,w.time*.24+i);else star(c,xx,yy,1+n*1.5,'#e8faff',w.time*.4+i);c.restore();}
    for(let i=0;i<3;i++){c.save();c.globalAlpha*=.16;ring(c,f.x+Math.sin(w.time+i)*18,f.y-18-i*28,f.r*(.86-i*.1),10+i*3,'#a5e6ff',5+i);c.restore();}
  }
  before(w){const c=this.c;
    for(const a of w.constructs||[]){const b=w.platforms.find(b=>b.id===a.platformId);if(!b)continue;const grow=ease(a.age/.22);this.sprite('frost',1,b.x+b.w/2,b.y+16,175,78,0,grow);line(c,[[b.x,b.y],[b.x+b.w,b.y]],'#ecfbff',2);for(let i=0;i<4;i++)star(c,b.x+20+i*36,b.y-3+Math.sin(w.time*2+i)*2,2,'#dff9ff',w.time);}
    for(const m of w.iceMirrors||[]){const fade=Math.min(1,(m.until-w.time)*3);this.sprite('frost',2,m.x,m.y,84,134,0,fade);c.save();c.globalAlpha=fade*.5;snow(c,m.x,m.y,23,w.time*.12);ring(c,m.x,m.y,25,57,'#b9edff',1);for(let i=0;i<5;i++)star(c,m.x+Math.sin(i*2.4+w.time)*27,m.y-48+i*23,1.8,'#dffaff',w.time);c.restore();}
    for(const f of w.fields||[]){const t=w.time,color=colors[f.kind==='frostDomain'?'frost':f.kind==='shadowStorm'?'shadow':'star'];c.save();c.globalAlpha=Math.min(1,f.age*5,(f.until-t)*3);ring(c,f.x,f.y-1,f.r,13,color+'99',1.6);ring(c,f.x,f.y-1,f.r*.86,10,color+'66',1);
      if(f.kind==='frostDomain')this.frostField(w,f);
      else if(f.kind==='shadowStorm'){
        for(let i=0;i<4;i++){const a=t*7+i*TAU/4;this.slash({x:f.x+Math.cos(a)*f.r*.39,y:f.y-57+Math.sin(a)*35,face:i%2?1:-1},fract(t*2.8+i*.27));}
        for(let i=0;i<13;i++){const life=fract(t*.7+i*.131),xx=f.x+(noise(i+8)-.5)*f.r*1.8,yy=f.y-life*100;c.save();c.globalAlpha*=(1-life)*.6;line(c,[[xx-3,yy+8],[xx+3,yy-5],[xx+1,yy-11]],'#b99bdc',1.3);c.restore();}
      }else{const shrinking=f.kind==='starCollapse',size=shrinking?Math.max(24,165-f.age*210):104+Math.sin(t*3)*6;this.sprite('star',1,f.x,f.y-70,size*1.8,size*1.28,t*.18,.82);
        for(let i=0;i<3;i++){ring(c,f.x,f.y-68,size*(1-i*.12),size*.29,color+(i?'88':'cc'),1,i*.36-.3);for(let k=0;k<4;k++){const a=t*(.7+i*.2)+k*TAU/4+i;star(c,f.x+Math.cos(a)*size*(1-i*.12),f.y-68+Math.sin(a)*size*.33,2.8,'#ffe3a6',a);}}
        if(shrinking&&!f.triggered)for(let i=0;i<18;i++){const a=i/18*TAU+t,rr=205*Math.max(.08,1-f.age/.6);line(c,[[f.x+Math.cos(a)*rr,f.y-60+Math.sin(a)*rr*.4],[f.x+Math.cos(a)*(rr+18),f.y-60+Math.sin(a)*(rr+18)*.4]],i%2?'#d8baff':'#ffe1a1',1.4);}
      }c.restore();}
    for(const pair of w.portals||[])for(const [i,n] of [pair.a,pair.b].entries()){this.sprite('star',2,n.x,n.y-59,96,150,0,.88);c.save();c.globalAlpha=.65;ring(c,n.x,n.y-58,25,55,'#e9c8ff',1);for(let k=0;k<7;k++){const a=w.time*(i?-.8:.8)+k*TAU/7;star(c,n.x+Math.cos(a)*28,n.y-58+Math.sin(a)*59,2.4,'#ffe3ac',a);}c.restore();}
    const mark=w.roleState?.shadowMark;if(mark&&mark.until>w.time){this.sprite('shadow',3,mark.x,mark.y-9,129,68,0,.85);c.font='12px sans-serif';c.fillStyle='#e6cfff';c.textAlign='center';c.fillText('返影 '+(mark.until-w.time).toFixed(1)+'s',mark.x,mark.y-96);}
    if(w.hero==='lightning'&&w.player.cast?.key==='e'){const p=w.player,b=w.platforms.filter(b=>b.active&&b.y<p.y-35&&Math.abs(b.x+b.w/2-p.x)<560).sort((a,b)=>Math.abs(a.x+a.w/2-w.aim.x)-Math.abs(b.x+b.w/2-w.aim.x))[0];if(b)this.sprite('lightning',3,clamp(w.aim.x,b.x+22,b.x+b.w-22),b.y-13,60,67,0);}
  }
  passive(w){const p=w.player,c=this.c,hero=w.hero,color=colors[hero];if(!color)return;
    if(hero==='frost'&&p.shield>0){c.save();c.globalAlpha=.36;ring(c,p.x,p.y-58,34,62,color,1.5);for(let i=0;i<6;i++){const a=i*TAU/6+w.time*.2;snow(c,p.x+Math.cos(a)*34,p.y-58+Math.sin(a)*62,2.4,a);}c.restore();}
    if(hero==='lightning'&&p.charge>=100)for(let i=0;i<3;i++){const a=w.time*4+i*TAU/3,x=p.x+Math.cos(a)*24,y=p.y-55+Math.sin(a)*36;this.bolt(x,y,x+6,y-24,w.fxTime,i,1.2);}
    if(hero==='star')for(let i=0;i<(p.stars||0);i++){const a=w.time*1.4+i*TAU/3,x=p.x+Math.cos(a)*37,y=p.y-65+Math.sin(a)*17;glow(c,x,y,9,'#ffe3a5',.5);star(c,x,y,4.2,'#fff4d6',a);}
  }
  effect(w,e){const c=this.c,t=clamp(e.age/e.duration,0,1),fade=1-t,k=e.kind;let hero;
    if(k.startsWith('frost')||k==='iceShatter')hero='frost';else if(k.startsWith('lightning')||k.startsWith('thunder')||k==='electricBurst')hero='lightning';else if(k.startsWith('shadow'))hero='shadow';else if(k.startsWith('star')||k==='portalFlash')hero='star';else return false;
    c.save();c.globalAlpha=Math.min(1,e.age/.025)*Math.pow(fade,.75);const color=colors[hero],clock=w.fxTime||w.time;
    if(k==='thunderPunch'){const socket=e.attach==='fist'&&this.punchSocket?this.punchSocket:e;c.save();c.translate(socket.x,socket.y);c.scale((socket.face||1)*(e.rangeScale||1),e.rangeScale||1);this.sprite(hero,0,45,0,132,70,-.05+t*.15,.85);for(let i=0;i<5;i++)this.bolt(0,(i-2)*1.5,90+noise(i)*15,(i-2)*10,clock,(e.id||0)+i,1.6);star(c,0,0,6*fade,'#fff9e8',t);star(c,94,-3,9*fade,'#fff5d4',t);c.restore();}
    else if(k==='thunderTether'){this.bolt(e.x,e.y,e.toX,e.toY,clock,e.id,2);this.sprite(hero,3,e.toX,e.toY,46,57,0,.8);}
    else if(k==='thunderImpact'){this.sprite(hero,2,e.x,e.y-145,190,315,0,Math.min(1,fade*2));this.sprite(hero,1,e.x,e.y-35,260*(.7+t),205);for(let i=0;i<8;i++){const a=i*TAU/8,rr=60+t*105;this.bolt(e.x,e.y-28,e.x+Math.cos(a)*rr,e.y-28+Math.sin(a)*rr*.48,clock,e.id+i,1.8);}ring(c,e.x,e.y,35+ease(t)*155,9+ease(t)*23,'#fff2bf',2.6);}
    else if(k==='shadowSlash')this.slash(e,t);
    else if(k==='shadowRush'){const p=w.player;line(c,[[e.x-(e.face||1)*25,e.y],[p.x-(e.face||1)*10,p.y-55]],'#c19fff77',2);for(let i=0;i<9;i++){const f=i/9,x=e.x+(p.x-e.x)*f,y=e.y+Math.sin(i*5)*16;line(c,[[x,y+5],[x+(e.face||1)*14,y-3],[x+(e.face||1)*4,y-8]],'#d4b7ff',1.2);} }
    else if(k==='shadowFlash'){this.sprite(hero,2,e.x,e.y,82,139,0,.8);this.sprite(hero,1,e.x,e.y,146,129,0,.55);this.motes(e.x,e.y,e.age,17,'#d4bcff',120);}
    else if(k==='portalFlash'){this.sprite(hero,2,e.x,e.y,104,157,t*.1);this.motes(e.x,e.y,e.age,20,'#ffe1a4',85);}
    else if(k==='thunderRush'){const p=w.player;this.bolt(e.x,e.y,p.x,p.y-55,clock,e.id,2.2);for(const side of [-1,1])this.bolt(e.x,e.y+side*13,p.x-14*(e.face||1),p.y-55+side*18,clock,e.id+side+9,1);}
    else if(k==='iceShatter'){this.sprite(hero,3,e.x,e.y-45,210*(.7+t),150);for(let i=0;i<20;i++){const a=i/20*TAU,r=20+t*140,x=e.x+Math.cos(a)*r,y=e.y-28+Math.sin(a)*r*.55+t*t*55;c.fillStyle=i%2?'#e8fcff':'#79c9f3';c.beginPath();c.moveTo(x,y-10*fade);c.lineTo(x+4*fade,y+6*fade);c.lineTo(x-4*fade,y+6*fade);c.fill();if(i%3===0)snow(c,x,y,4*fade,a+t);} }
    else if(k==='starCollapseBurst'||k==='starRepulse'){const size=(k==='starCollapseBurst'?380:290)*(.6+t*.75);this.sprite(hero,3,e.x,e.y,size,size*.72,-t*.16);for(let j=0;j<3;j++)ring(c,e.x,e.y,25+ease(t)*205*(1-j*.17),12+ease(t)*60*(1-j*.12),j?'#caa4ffbb':'#ffe5ae',j?1:2.6,j*.15);this.motes(e.x,e.y,e.age,30,'#ffe7b2',170);}
    else if(k==='frostSnare'){const radius=e.r*ease(t);for(let i=0;i<3;i++)ring(c,e.x,e.y-3,radius*(1-i*.12),radius*.13*(1-i*.12),i?'#9edfffbb':'#e6faff',i?1.4:3);for(let i=0;i<22;i++){const a=i*TAU/22,rr=radius*(.6+noise(i)*.4);snow(c,e.x+Math.cos(a)*rr,e.y-9+Math.sin(a)*rr*.15-18*Math.sin(t*Math.PI),2+noise(i+5)*3,a+t);}}
    else if(k==='frostCast'){this.sprite(hero,3,e.x,e.y,70*(.6+t),62,t*.1,.6);for(let i=0;i<7;i++){const a=i*TAU/7;snow(c,e.x+Math.cos(a)*(18+t*25),e.y+Math.sin(a)*(18+t*25),3+fade*2,a+t);}}
    else{const hit=k.endsWith('Hit')||k==='electricBurst',index=hero==='frost'?3:1,size=hit?118:70;this.sprite(hero,index,e.x,e.y,size*(.7+t),size*(.7+t),t*.12);glow(c,e.x,e.y,size*.6,color,.22);if(hero==='lightning')for(let i=0;i<6;i++){const a=i*TAU/6;this.bolt(e.x,e.y,e.x+Math.cos(a)*(22+t*65),e.y+Math.sin(a)*(22+t*65),clock,e.id+i,1.1);} }
    if(k.endsWith('Hit')||['electricBurst','starCollapseBurst','thunderImpact'].includes(k)){this.motes(e.x,e.y,e.age,13,color,125);if(hero==='frost')for(let i=0;i<7;i++)snow(c,e.x+Math.cos(i*2.4)*e.age*85,e.y+Math.sin(i*2.4)*e.age*65,3*fade,i+t);}
    c.restore();return true;
  }
}
