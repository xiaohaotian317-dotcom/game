import {equippedArtifact,swordRules} from './campaign-artifacts.mjs';
import {groundTarget} from './targeting.mjs?v=20261030-duel12';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

// Artifact damage and cooldowns are independent of the hero's current F/E/R cast.
export function stepArtifact(w,dt,input,{damage}){
 const c=w.campaign;if(!c?.progression)return;
 const a=c.artifactState??={active:false,blocked:false,readyAt:0,next:0,swords:[],impacts:[]},p=w.player,r=swordRules(c.progression),equipped=equippedArtifact(c.progression)==='sword';
 const stop=()=>{if(a.active){a.active=false;a.readyAt=w.time+r.cooldown;}};
 if(!input.artifact)a.blocked=false;
 if(!equipped||p.hp<=0||!input.artifact||!['travel','wave','boss'].includes(c.state))stop();
 if(equipped&&p.hp>0&&input.artifact&&!a.blocked&&!a.active&&w.time>=a.readyAt&&['travel','wave','boss'].includes(c.state)){
  a.blocked=true;
  if(p.mp>=r.startMana){p.mp-=r.startMana;a.active=true;a.until=w.time+r.duration;a.next=w.time;a.sequence=0;}
  else{c.notice='法力不足 · 御天剑需要8点启动法力';c.noticeUntil=w.time+1.5;}
 }
 if(a.active){
  if(w.time>=a.until||p.mp<r.manaPerSecond*dt)stop();
  else{
   p.mp-=r.manaPerSecond*dt;
   const x=clamp(input.aim?.x??w.aim.x,Math.max(30,p.x-r.reach),Math.min(w.width-30,p.x+r.reach)),y=input.aim?.y??w.aim.y,surface=groundTarget(w,x,y)||{x,y:w.floor};
   a.target={x,y:surface.y,radius:r.radius};
   if(w.time>=a.next){
    a.next=w.time+r.interval;const offset=[0,-.55,.45,-.25,.75,-.8,.2][a.sequence++%7]*r.radius,sx=clamp(x+offset,30,w.width-30),floor=groundTarget(w,sx,y)||{y:w.floor};
    a.swords.push({x:sx,y:floor.y,born:w.time,fall:r.fall,damage:r.damage,hit:false});
   }
  }
 }
 if(!equipped||!['travel','wave','boss'].includes(c.state)){a.swords=[];a.impacts=[];return;}
 for(const sword of a.swords){if(sword.hit||w.time-sword.born<sword.fall)continue;sword.hit=true;a.impacts.push({x:sword.x,y:sword.y,born:w.time});
  // The downward strike can reach upper bodies; it lands on the first standable surface below the cursor.
  for(const t of w.targets)if((t.enemyKind||t.egg)&&!t.petKind&&t.hp>0&&Math.abs(t.x-sword.x)<48+t.w&&Math.abs(t.y-sword.y)<130)damage(w,t,sword.damage,{source:'artifact',school:'star',impact:true});
  w.events.push({type:'hit',school:'star'});w.shake=Math.max(w.shake,2);
 }
 a.swords=a.swords.filter(s=>w.time-s.born<s.fall+.08);a.impacts=a.impacts.filter(s=>w.time-s.born<.5);
 if(!equipped||!['travel','wave','boss'].includes(c.state)){a.swords=[];a.impacts=[];}
}

export function drawArtifact(c,w,art){
 const a=w.campaign.artifactState,m=art.swordMeta,img=art.swordImage;if(!a||!m||!img)return;
 const draw=(index,x,y,width,alpha=1,foot=.8)=>{const f=m.frames[index];if(!f)return;const r=f.rect,scale=width/r[2],height=r[3]*scale,anchor=f.anchor||[r[2]/2,r[3]*foot];c.save();c.globalAlpha=alpha;c.drawImage(img,...r,x-anchor[0]*scale,y-anchor[1]*scale,width,height);c.restore();};
 if(a.active&&a.target){const t=a.target;draw(2,t.x,t.y+12,t.radius*2,.8,.5);c.save();c.font='12px serif';c.textAlign='center';c.fillStyle='#f3e2ae';c.fillText('御天剑 · 松开Q结束',t.x,t.y+32);c.restore();}
 for(const s of a.swords){const t=clamp((w.time-s.born)/s.fall,0,1);draw(1,s.x,s.y-520*(1-t),64,Math.min(1,t*5),1);}
 for(const hit of a.impacts){const t=(w.time-hit.born)/.5;const index=3+Math.min(2,Math.floor(t*3));draw(index,hit.x,hit.y,170*m.frames[index].rect[2]/440,Math.min(1,(1-t)*3),.82);}
}
