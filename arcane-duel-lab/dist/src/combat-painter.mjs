import {resolveGroundTarget} from './targeting.mjs?v=20261030-duel12';
const TAU=Math.PI*2,clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>1-Math.pow(1-clamp(t),3);
function ring(c,x,y,rx,ry,color,width=2){c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.stroke();}
function halo(c,x,y,r,color,alpha){c.save();c.globalAlpha*=alpha;const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();}
export class CombatPainter{
  constructor(c,assets,scenePainter){this.c=c;this.a=assets;this.scenePainter=scenePainter;}
  target(w){
    const cast=w.player.cast;if(!cast?.target||cast.released)return;
    const t=resolveGroundTarget(w,cast.target);if(!t)return;const c=this.c,color=({fire:'#eeb676',nature:'#bad797',frost:'#b9edff',lightning:'#ffe1a0',shadow:'#cfadff',star:'#dec4ff'})[w.hero];
    c.save();c.strokeStyle=color;c.lineWidth=1;c.setLineDash([3,5]);c.beginPath();c.moveTo(t.x,cast.y);c.lineTo(t.x,t.y);c.stroke();c.setLineDash([]);ring(c,t.x,t.y,cast.key==='r'?155:100,17,color,1.8);c.restore();
  }
  sprite(atlas,key,x,y,width,{height,ax=.5,ay=.5,angle=0,alpha=1,flip=1}={}){
    const b=this.a.combatBounds?.[atlas]?.[key],im=this.a[atlas];if(!b||!im)return;
    const c=this.c,h=height??width*b.h/b.w;c.save();c.globalAlpha*=clamp(alpha);c.translate(x,y);c.rotate(angle);c.scale(flip,1);
    c.drawImage(im,b.x,b.y,b.w,b.h,-width*ax,-h*ay,width,h);c.restore();
  }
  sparks(x,y,age,{count=22,color='#ffd69a',speed=150,gravity=150,leaf=false}={}){
    const c=this.c;c.save();c.globalAlpha*=clamp(1-age/1.1);c.fillStyle=color;c.strokeStyle=color;
    for(let i=0;i<count;i++){
      const a=i*2.399,s=speed*(.4+(i%7)/7),xx=x+Math.cos(a)*s*age,yy=y+Math.sin(a)*s*age+gravity*age*age;
      c.save();c.translate(xx,yy);c.rotate(a+age*(i%2?3:-4));
      if(leaf){c.beginPath();c.ellipse(0,0,6,2,0,0,TAU);c.fill();}
      else{c.lineWidth=i%4===0?3:1.4;c.beginPath();c.moveTo(0,0);c.lineTo(-5-speed*.025*(1-age),0);c.stroke();}c.restore();
    }c.restore();
  }
  projectile(w,s){
    const c=this.c,a=Math.atan2(s.vy,s.vx),fire=s.kind==='fireball',seed=s.kind==='seed';
    if(!fire&&!seed)return false;
    const clock=w.fxTime??w.time;c.save();
    for(let i=0;i<(s.trail?.length||0);i+=2){const p=s.trail[i],t=i/s.trail.length;halo(c,p.x,p.y,5+t*8,fire?'#ff7a29':'#b9d96b',t*.20);}
    halo(c,s.x,s.y,fire?46:28,fire?'#ff8b35':'#e0e88a',.34);
    // The bright tip is the actual collision centre. The long trail remains behind it.
    this.sprite(fire?'fire-vfx-v2':'nature-vfx-v2','bolt',s.x,s.y,fire?112+Math.sin(clock*33)*7:90,{ax:.94,ay:fire?.49:.53,angle:a,height:fire?34+Math.sin(clock*27)*3:30});
    c.restore();return true;
  }
  stag(w){
    const f=w.fox;if(!f)return;const c=this.c;
    const key=!f.grounded?(f.leap?'strike':'air'):f.attackPose>0?'strike':Math.abs(f.vx)>35?'run'+(Math.floor(f.cycle*1.4)%4):'idle';
    const b=this.a.combatBounds['wood-stag-v2'][key];
    c.save();c.fillStyle='#02071366';c.beginPath();c.ellipse(f.x,f.y+2,41,6,0,0,TAU);c.fill();
    if(f.leap){halo(c,f.x,f.y-47,87,'#e6cc79',.17);this.sparks(f.x-f.face*45,f.y-36,(w.fxTime*2)%1,{count:9,color:'#e8d88c',speed:65,gravity:0,leaf:true});}
    this.sprite('wood-stag-v2',key,f.x,f.y,b.w*.28,{height:b.h*.28,ay:1,flip:f.face,alpha:f.hit>0?.70+.3*Math.sin(w.fxTime*70):1});
    const y=f.y-143;c.fillStyle='#080e14e8';c.fillRect(f.x-39,y,78,7);c.fillStyle='#a0dc79';c.fillRect(f.x-38,y+1,76*f.hp/f.maxHp,5);c.strokeStyle='#d1bb77';c.lineWidth=1;c.strokeRect(f.x-39,y,78,7);
    c.font='11px "Microsoft YaHei",sans-serif';c.textAlign='center';c.fillStyle='#f4e6b3';c.fillText('木灵鹿 '+Math.ceil(f.hp)+' / '+f.maxHp,f.x,y-6);
    c.fillStyle='#d6bb77';c.globalAlpha=.7;c.fillRect(f.x-32,y+11,64*clamp((f.until-w.time)/10),2);c.restore();
  }
  tree(w,t){
    const c=this.c,growth=ease(t.age/.9),fade=clamp(t.until-w.time),clock=w.fxTime||w.time;
    c.save();c.globalAlpha*=fade;
    halo(c,t.x,t.y-125,265,'#adc761',.10+Math.sin(clock*2)*.025);
    ring(c,t.x,t.y,160*growth,24*growth,'#d9d39a66',2);ring(c,t.x,t.y,134*growth,17*growth,'#91d09c88',1);
    c.save();c.beginPath();c.rect(t.x-300,t.y-360*growth,600,360*growth+15);c.clip();
    this.sprite('nature-vfx-v2','tree',t.x,t.y+7,490,{ay:1,alpha:Math.min(1,t.age*3)});c.restore();
    if(t.age>.65){
      // The two gold-edged branches match the two real standing surfaces exactly.
      for(const b of w.platforms.filter(b=>b.id.startsWith(t.id))){
        c.strokeStyle='#3a3920';c.lineWidth=14;c.lineCap='round';c.beginPath();c.moveTo(t.x,t.y-60);c.quadraticCurveTo(t.x+(b.x<t.x?-60:60),b.y+28,b.x+b.w/2,b.y+9);c.stroke();
        if(this.a.sceneBounds?.garden)this.scenePainter.prop('garden','vine',b.x+b.w/2,b.y,b.w+8,{ay:.22});
        c.strokeStyle='#efd987';c.lineWidth=2;c.beginPath();c.moveTo(b.x,b.y);c.lineTo(b.x+b.w,b.y);c.stroke();
      }
    }
    for(let i=0;i<18;i++){const q=(clock*.13+i/18)%1,x=t.x+Math.sin(i*5.6+clock*.45)*(45+q*125),y=t.y-q*310;halo(c,x,y,4,'#ffdf8d',Math.sin(q*Math.PI)*.65);}
    c.restore();
  }
  effect(w,e){
    const c=this.c,t=clamp(e.age/e.duration),clock=w.fxTime||w.time;
    if(['fireHit','leafHit','muzzle','seedCast','foxBite'].includes(e.kind)){
      const fire=e.kind==='fireHit'||e.kind==='muzzle',muzzle=e.kind==='muzzle'||e.kind==='seedCast',size=muzzle?65:e.kind==='foxBite'?95:fire?120:96,phase=ease(t);
      if(muzzle){this.sprite(fire?'fire-vfx-v2':'nature-vfx-v2','bolt',e.x,e.y,size,{ax:.84,angle:e.angle||0,alpha:1-t,height:30});}
      else this.sprite(fire?'fire-vfx-v2':'nature-vfx-v2','burst',e.x,e.y,size*(.3+.7*phase),{alpha:Math.pow(1-t,.8)});
      if(t<.22){c.save();c.globalCompositeOperation='screen';halo(c,e.x,e.y,muzzle?22:44,fire?'#fff1b5':'#e8ffca',(1-t/.22)*.8);c.restore();}
      this.sparks(e.x,e.y,e.age,{count:muzzle?7:15,color:fire?'#ffd78d':'#d8e99a',speed:fire?165:120,leaf:!fire});return true;
    }
    if(e.kind==='eruption'){
      if(e.age<e.delay){const a=e.age/e.delay;ring(c,e.x,e.y-2,100,15,'#ffb762cc',2);ring(c,e.x,e.y-2,100*a,15*a,'#ffdca2',2);halo(c,e.x,e.y,90,'#ff6e28',a*.25);}
      else{const age=e.age-e.delay,fade=clamp((e.duration-e.age)/.6),h=(200+Math.sin(clock*24)*12)*ease(age/.12);
        halo(c,e.x,e.y-80,180,'#ff8c32',fade*.30);this.sprite('fire-vfx-v2','eruption',e.x+Math.sin(clock*21)*3,e.y+7,190,{height:h,ay:1,alpha:fade});
        this.sparks(e.x,e.y-30,age,{count:25,speed:230,gravity:200});ring(c,e.x,e.y,95+age*100,15+age*14,'#ffc473'+Math.round(fade*160).toString(16).padStart(2,'0'),2);
      }return true;
    }
    if(e.kind==='meteor'){
      if(e.age<e.delay){
        const a=clamp(e.age/e.delay),fall=a*a,x=e.startX+(e.x-e.startX)*fall,y=e.startY+(e.y-52-e.startY)*fall,angle=Math.atan2(e.y-e.startY,e.x-e.startX);
        ring(c,e.x,e.y-2,155,23,'#ffbc76cc',2);ring(c,e.x,e.y-2,155*a,23*a,'#ffe0aa',2);halo(c,e.x,e.y,150,'#ff7725',a*.16);
        c.save();c.globalCompositeOperation='screen';this.sprite('fire-vfx-v2','bolt',x-17,y-22,320,{height:76,ax:.95,angle,alpha:clamp(a*5)});c.restore();
        halo(c,x,y,120,'#ff8b30',.32);this.sprite('fire-vfx-v2','meteor',x,y,174,{ax:.60,ay:.57,angle:a*1.7});
        this.sparks(x,y-12,(e.age*.85)%1,{count:15,speed:100,gravity:-200});
      }else{
        const age=e.age-e.delay,a=age/(e.duration-e.delay),fade=1-a,spread=ease(age/.5);
        halo(c,e.x,e.y-60,340,'#ff8d34',fade*.37);
        this.sprite('fire-vfx-v2','burst',e.x,e.y-56,170+300*ease(age/.35),{height:150+210*ease(age/.35),alpha:fade});
        c.save();c.globalCompositeOperation='screen';ring(c,e.x,e.y-4,40+spread*260,10+spread*36,'#ffdb9b'+Math.round(fade*210).toString(16).padStart(2,'0'),4*(1-a)+1);c.restore();
        for(let i=0;i<19;i++){const ang=i*2.399,s=95+i%5*43,x=e.x+Math.cos(ang)*s*age,y=e.y-30-Math.abs(Math.sin(ang))*230*age+170*age*age;c.save();c.globalAlpha=fade;c.translate(x,y);c.rotate(i+age*(i%2?4:-3));c.fillStyle=i%3?'#4a302c':'#ffb56c';c.strokeStyle='#f39b50';c.lineWidth=1;c.fillRect(-4,-3,7+i%4*2,7);c.strokeRect(-4,-3,7+i%4*2,7);c.restore();}
        this.sparks(e.x,e.y-35,age,{count:40,speed:380,gravity:240});
        c.save();c.globalAlpha=fade*.65;c.strokeStyle='#ffb15a';c.lineWidth=2;for(let i=0;i<8;i++){const a=i/8*TAU;c.beginPath();c.moveTo(e.x,e.y);c.lineTo(e.x+Math.cos(a)*80,e.y+Math.sin(a)*12);c.lineTo(e.x+Math.cos(a+.12)*140,e.y+Math.sin(a+.12)*20);c.stroke();}c.restore();
      }return true;
    }
    if(['fireZone','stompHit','fireLeap','stompTrail'].includes(e.kind)){
      const fading=clamp((e.duration-e.age)/.6),leap=e.kind==='fireLeap'||e.kind==='stompTrail';
      if(leap){this.sprite('fire-vfx-v2','bolt',e.x,e.y,180,{height:60,angle:Math.PI/2+.3*(e.face||1),ax:.65,alpha:1-t});}
      else for(let i=0;i<5;i++){const phase=.85+Math.sin(clock*19+i*2)*.15;this.sprite('fire-vfx-v2','eruption',e.x+(i-2)*34,e.y+3,58,{height:(e.kind==='stompHit'?110:52)*phase,ay:1,alpha:fading*.86});}
      if(e.kind==='stompHit')this.sparks(e.x,e.y-20,e.age,{count:24,speed:250});return true;
    }
    if(e.kind==='roots'){
      const end=e.x+(e.to-e.x)*ease(e.age/.35),span=Math.abs(end-e.x),dir=Math.sign(e.to-e.x||1),fade=clamp((e.duration-e.age)/.55);
      for(let n=0;n<span;n+=76){const growth=ease((e.age-n/Math.max(1,span)*.3)/.28);this.sprite('nature-vfx-v2','roots',e.x+dir*n,e.y+5,100,{height:100*growth,ay:1,alpha:fade});}
      if(e.age<.65)this.sparks(end,e.y-20,e.age,{count:12,color:'#d0df8e',speed:90,leaf:true});return true;
    }
    if(['treeBirth','sprout','stagDeath','leaves'].includes(e.kind)){
      const death=e.kind==='stagDeath';this.sprite('nature-vfx-v2','burst',e.x,e.y-35,death?180:160*ease(t*3),{height:death?130:90,alpha:(1-t)*.7});
      if(death){const b=this.a.combatBounds['wood-stag-v2'].idle;c.save();c.beginPath();c.rect(e.x-100,e.y-140,200,140*(1-t));c.clip();this.sprite('wood-stag-v2','idle',e.x,e.y,b.w*.28,{height:b.h*.28,ay:1,flip:e.face||1,alpha:1-t});c.restore();}
      this.sparks(e.x,e.y-25,e.age,{count:30,color:'#dbdf8c',speed:180,gravity:-15,leaf:true});ring(c,e.x,e.y,25+ease(t)*120,8+ease(t)*13,'#d9dc8d'+Math.round((1-t)*140).toString(16).padStart(2,'0'),2);return true;
    }
    return false;
  }
}
