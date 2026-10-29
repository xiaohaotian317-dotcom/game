import {segmentBox,clearLine} from './collision.mjs?v=20261029-combat7';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function event(w,type,data={}){w.events.push({type,...data});}
export function hammerPosition(h){return{x:h.anchorX+Math.sin(h.angle)*h.length,y:h.anchorY+Math.cos(h.angle)*h.length};}
export function triggerScene(w,id,hooks){
  const m=w.mechanisms;if(!m)return false;
  if(id==='bridge'){
    const b=w.platforms.find(p=>p.id==='bridge');if(!b?.active||b.x<0)return false;
    hooks.damageBridge(w,b.x+b.w/2,b.y,b.w/2,50);return true;
  }
  if(id==='mirror'&&w.mirror.enabled){w.mirror.angle=-w.mirror.angle;w.mirror.cooldown=.3;event(w,'mirror');return true;}
  if(id==='lift'&&m.lift){m.lift.target=m.lift.target===m.lift.high?m.lift.low:m.lift.high;m.flash=.8;event(w,'lift');return true;}
  if(id==='valve'&&m.valve){m.valve.route=1-m.valve.route;m.flash=.8;event(w,'valve');return true;}
  if(id==='hammer'&&m.hammer){m.hammer.velocity+=1.7;m.hammer.pulse=.5;event(w,'hammer');return true;}
  if(id==='vents'&&m.vents){const vent=m.vents[m.valve.route];vent.forcedAt=w.time;event(w,'ventPreview');return true;}
  if(id==='wind'&&m.wind){m.wind.direction*=-1;m.flash=.6;event(w,'wind');return true;}
  if(id==='vine'&&m.vine){m.vine.until=Math.max(m.vine.until,w.time+9);event(w,'vine');return true;}
  if(id==='spring'&&w.spring.enabled){m.flash=.8;event(w,'flowerHint');return true;}
  return false;
}
export function nearestSceneInteraction(w,hooks){
  const m=w.mechanisms;if(!m)return false;
  const p=w.player,list=[];
  if(w.mirror.enabled)list.push({id:'mirror',x:w.mirror.x,y:w.mirror.y+35});
  if(m.lift)list.push({id:'lift',x:m.lift.switchX,y:m.lift.switchY});
  if(m.valve)list.push({id:'valve',...m.valve});
  if(m.wind)list.push({id:'wind',x:m.wind.x,y:m.wind.y});
  if(m.vine)list.push({id:'vine',x:m.vine.budX,y:m.vine.budY});
  list.sort((a,b)=>Math.hypot(a.x-p.x,a.y-(p.y-55))-Math.hypot(b.x-p.x,b.y-(p.y-55)));
  const first=list[0];return first&&Math.hypot(first.x-p.x,first.y-(p.y-55))<150?triggerScene(w,first.id,hooks):false;
}
export function hitSceneMechanism(w,s,hooks){
  const m=w.mechanisms;if(!m||s.owner!=='player'||m.cooldown>0)return false;
  const points=[];
  if(m.lift)points.push({id:'lift',x:m.lift.switchX,y:m.lift.switchY,r:34});
  if(m.valve)points.push({id:'valve',...m.valve,r:42});
  if(m.wind)points.push({id:'wind',x:m.wind.x,y:m.wind.y,r:43});
  if(m.vine)points.push({id:'vine',x:m.vine.budX,y:m.vine.budY,r:28});
  if(m.hammer)points.push({id:'hammer',...hammerPosition(m.hammer),r:68});
  const hit=points.map(p=>({...p,t:segmentBox(s.px??s.x,s.py??s.y,s.x,s.y,{x:p.x-p.r,y:p.y-p.r,w:p.r*2,h:p.r*2},s.r)})).filter(p=>p.t!==null&&clearLine(w,s.px??s.x,s.py??s.y,p.x,p.y)).sort((a,b)=>a.t-b.t)[0];
  if(!hit)return false;
  if(hit.id==='hammer'){m.hammer.velocity+=Math.sign(s.vx||1)*1.5;m.hammer.pulse=.5;event(w,'hammer');}
  else triggerScene(w,hit.id,hooks);
  m.cooldown=.3;s.life=0;return true;
}
export function updateScene(w,dt,hooks){
  const m=w.mechanisms;if(!m)return;
  w.windForce=0;
  m.cooldown=Math.max(0,m.cooldown-dt);m.flash=Math.max(0,m.flash-dt);
  if(m.lift){
    const l=m.lift,b=w.platforms.find(p=>p.id==='lift'),oldY=b.y,delta=clamp(l.target-b.y,-l.speed*dt,l.speed*dt);
    b.y+=delta;l.y=b.y;
    // Riders follow the deck both up and down, before their own physics is integrated.
    for(const a of [w.player,...w.targets,...(w.fox?[w.fox]:[])])if(a.grounded&&a.platformId==='lift'&&a.x+a.w>b.x&&a.x-a.w<b.x+b.w){a.y+=b.y-oldY;a.prevY=a.y;}
  }
  if(m.valve)m.valve.angle+=(Math.PI*m.valve.route-m.valve.angle)*(1-Math.exp(-7*dt));
  if(m.vents){
    m.vents.forEach((v,i)=>{
      let phase=v.forcedAt!==undefined?w.time-v.forcedAt:(w.time+i*1.3)%6;
      if(phase>6&&v.forcedAt!==undefined){delete v.forcedAt;phase=(w.time+i*1.3)%6;}
      v.mode=i!==m.valve.route?'rest':phase<1.25?'warning':phase<2.55?'fire':'rest';v.progress=phase;
      if(v.mode==='fire'){
        const p=w.player;if(Math.abs(p.x-v.x)<43&&p.y>v.y-177&&p.y-p.h<v.y)hooks.hitPlayer(w,14,v.x);
        for(const t of w.targets)if(t.hp>0&&Math.abs(t.x-v.x)<48&&t.y>v.y-177&&w.time>=(t.ventAt||0)){t.ventAt=w.time+.75;hooks.damage(w,t,14,{fire:true});}
        const f=w.fox;if(f&&Math.abs(f.x-v.x)<48&&f.y>v.y-177)hooks.hitSummon(w,14,v.x);
      }
    });
  }
  if(m.hammer){
    const h=m.hammer;h.velocity=clamp(h.velocity+(-3.6*Math.sin(h.angle)-.42*h.velocity)*dt,-2.4,2.4);const nextAngle=h.angle+h.velocity*dt;if(Math.abs(nextAngle)>1.08)h.velocity*=-.45;h.angle=clamp(nextAngle,-1.08,1.08);h.pulse=Math.max(0,h.pulse-dt);
    const pos=hammerPosition(h),p=w.player;
    if(Math.abs(p.x-pos.x)<70&&Math.abs((p.y-55)-pos.y)<62)hooks.hitPlayer(w,14,pos.x);
    for(const t of w.targets)if(t.hp>0&&Math.abs(t.x-pos.x)<70&&Math.abs(t.y-40-pos.y)<62&&w.time>=(t.hammerAt||0)){t.hammerAt=w.time+.8;hooks.damage(w,t,16,{knock:Math.sign(h.velocity||1)*260});}
    const f=w.fox;if(f&&Math.abs(f.x-pos.x)<90&&Math.abs(f.y-45-pos.y)<62)hooks.hitSummon(w,16,pos.x);
  }
  if(m.wind){
    const f=m.wind,b=f.bounds,p=w.player;
    if(!p.grounded&&p.x>b.x&&p.x<b.x+b.w&&p.y>b.y&&p.y-p.h<b.y+b.h){w.windForce=f.direction*190;p.vy=Math.max(-640,p.vy-470*dt);}
  }
  if(m.vine){
    const v=m.vine,active=w.time<v.until;v.growth=clamp(v.growth+(active?1.6:-2.4)*dt,0,1);
    w.platforms.find(p=>p.id==='vine').active=v.growth>=.995&&w.time<v.until;
  }
}
export function sceneStatus(w,id){
  const m=w.mechanisms;
  if(id==='bridge'){const b=w.platforms.find(p=>p.id==='bridge');return b.active?'完整 · '+b.hp+'/90':'已断裂';}
  if(id==='lift')return Math.abs(m.lift.y-m.lift.target)<1?'已到位':'移动中';
  if(id==='mirror')return w.mirror.angle<0?'折射向上':'折射向下';
  if(id==='valve')return m.valve.route===0?'左侧导流':'右侧导流';
  if(id==='vents')return m.vents[m.valve.route].mode==='fire'?'喷发中':m.vents[m.valve.route].mode==='warning'?'即将喷发':'冷却中';
  if(id==='hammer')return Math.abs(m.hammer.velocity)>.2?'摆动中':'缓慢回摆';
  if(id==='wind')return m.wind.direction>0?'风向 →':'风向 ←';
  if(id==='vine')return w.time<m.vine.until?'生长中 · '+Math.max(0,m.vine.until-w.time).toFixed(1)+'s':'种芽休眠';
  if(id==='spring')return w.spring.charge>0?'蓄力中':'等待踩压';
  return '';
}
