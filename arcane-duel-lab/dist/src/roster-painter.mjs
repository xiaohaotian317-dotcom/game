const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const colors={frost:'#a9e9ff',lightning:'#ffe191',shadow:'#c6a5ff',star:'#d2bbff'};
function ring(c,x,y,rx,ry,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.stroke();}
function line(c,pts,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();}
function glow(c,x,y,r,color,alpha=.35){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
export class RosterPainter{
  constructor(ctx,assets){this.c=ctx;this.assets=assets;}
  sprite(hero,index,x,y,w,h,angle=0,alpha=1){const c=this.c,a=this.assets[hero+'Fx'],b=this.assets.rosterBounds?.[hero]?.fx[index];if(!a||!b)return;c.save();c.globalAlpha*=alpha;c.translate(x,y);c.rotate(angle);c.drawImage(a,b.x,b.y,b.w,b.h,-w/2,-h/2,w,h);c.restore();}
  projectile(w,s){const hero={iceNeedle:'frost',arc:'lightning',starBolt:'star'}[s.kind];if(!hero)return false;const c=this.c,a=Math.atan2(s.vy,s.vx);c.save();
    const trail=s.trail||[];for(let i=1;i<trail.length;i++){c.globalAlpha=i/trail.length*.6;line(c,[[trail[i-1].x,trail[i-1].y],[trail[i].x,trail[i].y]],colors[hero],hero==='lightning'?3:2);}
    c.globalAlpha=1;glow(c,s.x,s.y,24,colors[hero],.3);this.sprite(hero,0,s.x-18*Math.cos(a),s.y-18*Math.sin(a),hero==='lightning'?112:84,hero==='lightning'?52:38,a);
    c.restore();return true;}
  before(w){const c=this.c;
    for(const a of w.constructs||[]){const b=w.platforms.find(b=>b.id===a.platformId);if(!b)continue;const grow=clamp(a.age/.22,0,1);this.sprite('frost',1,b.x+b.w/2,b.y+13,190,96,0,grow);line(c,[[b.x,b.y],[b.x+b.w,b.y]],'#e9faff',2);}
    for(const m of w.iceMirrors||[]){this.sprite('frost',2,m.x,m.y,90,140,0,Math.min(1,(m.until-w.time)*3));ring(c,m.x,m.y,21,52,'#b9edff99',1);}
    for(const f of w.fields||[]){const t=w.time,color=colors[f.kind==='frostDomain'?'frost':f.kind==='shadowStorm'?'shadow':'star'];c.save();c.globalAlpha=Math.min(1,f.age*4,(f.until-t)*3);
      ring(c,f.x,f.y-1,f.r,13,color+'99',2);ring(c,f.x,f.y-1,f.r*.86,10,color+'66',1);
      if(f.kind==='frostDomain'){
        for(let i=0;i<13;i++){const x=f.x+(i-6)*f.r/6,h=15+Math.sin(i*8)*10+Math.min(1,f.age*3)*12;c.fillStyle=i%2?'#7bb9dcaa':'#c3eeffc9';c.beginPath();c.moveTo(x-7,f.y);c.lineTo(x+Math.sin(i)*5,f.y-h);c.lineTo(x+8,f.y);c.fill();}
        this.sprite('frost',3,f.x,f.y-60,f.r*1.4,155,0,.5);glow(c,f.x,f.y-35,130,color,.12);
      }else if(f.kind==='shadowStorm'){
        for(let i=0;i<4;i++){const a=t*9+i*TAU/4;this.sprite('shadow',0,f.x+Math.cos(a)*f.r*.45,f.y-55+Math.sin(a)*40,160,86,a,.58);}
      }else{const shrinking=f.kind==='starCollapse',size=shrinking?Math.max(24,165-f.age*210):116+Math.sin(t*3)*7;
        this.sprite('star',1,f.x,f.y-65,size*1.8,size*1.25,t*.3,.8);for(let i=0;i<3;i++)ring(c,f.x,f.y-60,size*(1-i*.18),size*.3,color+(i?'88':'cc'),1.5);
        if(shrinking&&!f.triggered)for(let i=0;i<12;i++){const a=i/12*TAU+t,rr=205*(1-f.age/.6);line(c,[[f.x+Math.cos(a)*rr,f.y-60+Math.sin(a)*rr*.4],[f.x+Math.cos(a)*(rr+18),f.y-60+Math.sin(a)*(rr+18)*.4]],'#ffe1a1',2);}
      }c.restore();}
    for(const pair of w.portals||[])for(const n of [pair.a,pair.b]){this.sprite('star',2,n.x,n.y-58,98,155,0,.85);ring(c,n.x,n.y-58,24,54,'#e9c8ff',1.6);}
    const mark=w.roleState?.shadowMark;if(mark&&mark.until>w.time){this.sprite('shadow',3,mark.x,mark.y-4,124,54,0,.8);c.font='12px sans-serif';c.fillStyle='#dfc5ff';c.textAlign='center';c.fillText('返影 '+(mark.until-w.time).toFixed(1)+'s',mark.x,mark.y-95);}
    if(w.hero==='lightning'&&w.player.cast?.key==='e'){const p=w.player,b=w.platforms.filter(b=>b.active&&b.y<p.y-35&&Math.abs(b.x+b.w/2-p.x)<560).sort((a,b)=>Math.abs(a.x+a.w/2-w.aim.x)-Math.abs(b.x+b.w/2-w.aim.x))[0];if(b)this.sprite('lightning',3,clamp(w.aim.x,b.x+22,b.x+b.w-22),b.y-13,65,65,w.time);}
  }
  passive(w){const p=w.player,c=this.c,hero=w.hero,color=colors[hero];if(!color)return;
    if(hero==='frost'&&p.shield>0){c.save();c.globalAlpha=.38;ring(c,p.x,p.y-58,34,62,color,1.5);for(let i=0;i<6;i++){const a=i*TAU/6+w.time*.2;line(c,[[p.x+Math.cos(a)*34,p.y-58+Math.sin(a)*62],[p.x+Math.cos(a+.3)*34,p.y-58+Math.sin(a+.3)*62]],'#edfcff',2);}c.restore();}
    if(hero==='lightning'&&p.charge>=100){for(let i=0;i<3;i++){const a=w.time*4+i*TAU/3,x=p.x+Math.cos(a)*24,y=p.y-55+Math.sin(a)*36;line(c,[[x,y],[x+7,y-7],[x-2,y-14],[x+6,y-21]],color,1.6);}}
    if(hero==='star')for(let i=0;i<(p.stars||0);i++){const a=w.time*1.4+i*TAU/3,x=p.x+Math.cos(a)*37,y=p.y-65+Math.sin(a)*17;glow(c,x,y,9,'#ffe3a5',.7);line(c,[[x-4,y],[x+4,y]],'#fff4d6',1.4);line(c,[[x,y-4],[x,y+4]],'#fff4d6',1.4);}
  }
  effect(w,e){const c=this.c,t=clamp(e.age/e.duration,0,1),fade=1-t,k=e.kind;let hero;
    if(k.startsWith('frost')||k==='iceShatter')hero='frost';else if(k.startsWith('lightning')||k.startsWith('thunder')||k==='electricBurst')hero='lightning';else if(k.startsWith('shadow'))hero='shadow';else if(k.startsWith('star')||k==='portalFlash')hero='star';else return false;
    c.save();c.globalAlpha=fade;const color=colors[hero];
    if(k==='thunderTether'){const pts=[];for(let i=0;i<=12;i++){const f=i/12;pts.push([e.x+(e.toX-e.x)*f+(i%2?6:-6)*Math.sin(f*Math.PI),e.y+(e.toY-e.y)*f]);}line(c,pts,'#ffe6a6',3);line(c,pts,'#ffffff',1);this.sprite(hero,3,e.toX,e.toY,65,65,w.time);}
    else if(k==='thunderImpact'){this.sprite(hero,2,e.x,e.y-150,240,350,0,Math.min(1,fade*3));this.sprite(hero,1,e.x,e.y-35,300*(.6+t),210);ring(c,e.x,e.y,30+t*170,7+t*22,'#fff2bf',3);}
    else if(k==='shadowSlash'){this.sprite(hero,0,e.x,e.y,150*(.7+t),100,((e.face||1)>0?-.3:Math.PI+.3)+t*.45);line(c,[[e.x-38,e.y+30],[e.x+42,e.y-28]],'#ede3ff',1.5);}
    else if(k==='shadowFlash'){this.sprite(hero,2,e.x,e.y,96,130,0,.9);this.sprite(hero,1,e.x,e.y,140,130,0,.7);}
    else if(k==='portalFlash'){this.sprite(hero,2,e.x,e.y,110,145,t*.2);}
    else if(k==='thunderRush'){this.sprite(hero,0,e.x-(e.face||1)*60,e.y,250,100,(e.face||1)<0?Math.PI:0,.8);}
    else if(k==='iceShatter'){this.sprite(hero,3,e.x,e.y-35,220*(.7+t),155);for(let i=0;i<15;i++){const a=i/15*TAU,r=20+t*135,x=e.x+Math.cos(a)*r,y=e.y-28+Math.sin(a)*r*.55+t*t*55;c.fillStyle=i%2?'#e8fcff':'#79c9f3';c.beginPath();c.moveTo(x,y-10*fade);c.lineTo(x+4*fade,y+6*fade);c.lineTo(x-4*fade,y+6*fade);c.fill();}}
    else if(k==='starCollapseBurst'||k==='starRepulse'){const size=(k==='starCollapseBurst'?380:290)*(.5+t);this.sprite(hero,3,e.x,e.y,size,size*.8,-t*.3);ring(c,e.x,e.y,25+t*205,12+t*60,'#ffe5ae',3);}
    else{const hit=k.endsWith('Hit')||k==='electricBurst',index=hero==='frost'?3:1,size=hit?110:65;this.sprite(hero,index,e.x,e.y,size*(.65+t),size*(.65+t),t*.3);glow(c,e.x,e.y,size*.65,color,hit?.35:.22);}
    if(k.endsWith('Hit')||['electricBurst','starCollapseBurst','thunderImpact'].includes(k))for(let i=0;i<10;i++){const a=i/10*TAU+e.id,rr=10+t*90;line(c,[[e.x+Math.cos(a)*rr,e.y+Math.sin(a)*rr*.6],[e.x+Math.cos(a)*(rr+12*fade),e.y+Math.sin(a)*(rr+12*fade)*.6]],i%2?color:'#fff0c9',1.5);}
    c.restore();return true;
  }
}
