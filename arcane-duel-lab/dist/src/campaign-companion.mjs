import {PETS} from './campaign-pet-data.mjs';
import {groundTarget} from './targeting.mjs?v=20261030-duel12';
import {clearLine} from './collision.mjs?v=20261030-duel12';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const COMPANION_STATS={
 mossdeer:{hp:130,damage:8,range:350,cooldown:1.4,style:'root',ranged:true},
 emberwing:{hp:145,damage:12,range:95,cooldown:1.35,style:'fire',ranged:false},
 frostfox:{hp:115,damage:9,range:390,cooldown:1.3,style:'ice',ranged:true}
};
export function selectCompanion(profile,id){if(id!==null&&!profile.pets?.some(p=>p.id===id&&PETS[p.kind]))throw Error('请选择已经捕获的灵宠');profile.activePetId=id;return id?'已设为出战灵宠 · 进入关卡自动跟随':'已取消灵宠出战';}
export function spawnCompanion(w){const c=w.campaign,p=c?.progression,record=p?.pets?.find(v=>v.id===p.activePetId);if(!record||!COMPANION_STATS[record.kind])return null;const spec=COMPANION_STATS[record.kind],level=c.stats?.level||1,hp=Math.round(spec.hp*(1+.03*(level-1))),x=clamp(w.player.x-65,40,w.width-40),floor=groundTarget(w,x,w.player.y-2);return w.companion={id:'companion-'+record.id,recordId:record.id,petKind:record.kind,form:record.form||0,friendly:true,x,y:floor?.y??w.floor,prevX:x,prevY:floor?.y??w.floor,w:23,h:52,face:1,vx:0,vy:0,grounded:true,platformId:floor?.platformId||'ground',hp,maxHp:hp,damage:Math.round(spec.damage*(1+.025*(level-1))),cycle:0,hit:0,invuln:0,state:'idle',born:w.time,readyAt:w.time+.8,attackAt:0,jumpAt:0,sequence:0,shots:[],retreated:false};}
export function hitCompanion(w,amount,fromX=0){const f=w.companion;if(!f||f.hp<=0||f.invuln>0)return false;const actual=Math.max(1,Math.round(amount));f.hp=Math.max(0,f.hp-actual);f.hit=.22;f.invuln=.45;f.vx=Math.sign(f.x-fromX||1)*90;w.texts.push({x:f.x,y:f.y-f.h-10,text:'−'+actual,color:'#eeceb1',size:13,age:0,duration:.7});if(!f.hp){f.retreated=true;f.state='down';f.attackAt=0;f.shots=[];w.campaign.notice=PETS[f.petKind].name+'受伤退场 · 下次进入关卡恢复';w.campaign.noticeUntil=w.time+2.8;}return true;}
function inside(w,x){const lock=w.campaign.lock;return clamp(x,lock?lock.x+50:35,lock?lock.x+lock.width-50:w.width-35);}
function targetVisible(w,f,t){return clearLine(w,f.x,f.y-30,t.x,t.y-Math.min(t.h*.5,50));}
function hit(w,f,t,api,empowered=false){if(!t||t.hp<=0||t.petKind)return;api.damage(w,t,f.damage*(empowered?1.2:1),{school:f.petKind==='frostfox'?'frost':f.petKind==='emberwing'?'fire':'nature',source:'companion',impact:true,label:Math.round(f.damage*(empowered?1.2:1))});if(empowered&&t.hp>0){if(f.petKind==='frostfox')t.frostSnareUntil=Math.max(t.frostSnareUntil||0,w.time+1.2);if(f.petKind==='mossdeer')t.rootUntil=Math.max(t.rootUntil||0,w.time+.45);}f.strike={x:t.x,y:t.y-Math.min(t.h*.5,40),at:w.time,empowered};w.events.push({type:'woodHit'});}
function stepShots(w,f,dt,api){for(const s of f.shots){s.age+=dt;const t=w.targets.find(t=>t.id===s.targetId&&t.hp>0&&!t.petKind);if(!t){s.done=true;continue;}const tx=t.x,ty=t.y-Math.min(45,t.h*.5),dx=tx-s.x,dy=ty-s.y,len=Math.hypot(dx,dy)||1,move=510*dt;s.px=s.x;s.py=s.y;if(!clearLine(w,s.x,s.y,s.x+dx/len*Math.min(move,len),s.y+dy/len*Math.min(move,len))){s.done=true;continue;}if(len<=move+t.w*.6){hit(w,f,t,api,s.empowered);s.done=true;}else{s.x+=dx/len*move;s.y+=dy/len*move;}}f.shots=f.shots.filter(s=>!s.done&&s.age<1.4);}
function recall(w,f){const x=inside(w,w.player.x-w.player.face*70),surface=groundTarget(w,x,w.player.y-2);f.x=f.prevX=x;f.y=f.prevY=surface?.y??w.floor;f.vx=f.vy=0;f.grounded=true;f.platformId=surface?.platformId||'ground';f.recalledAt=w.time;f.readyAt=Math.max(f.readyAt,w.time+.65);f.attackAt=0;f.state='recall';}
function navigate(w,f,goal,dt,api){let gx=goal.x,drop=false;const rise=f.y-goal.y;
 if(rise>45){const decks=w.platforms.filter(p=>p.active&&p.id!=='ground'&&f.y-p.y>35&&f.y-p.y<265&&p.x<gx+50&&p.x+p.w>gx-50).sort((a,b)=>Math.abs(a.x+a.w*.5-f.x)-Math.abs(b.x+b.w*.5-f.x)),deck=decks[0];if(deck){gx=clamp(gx,deck.x+30,deck.x+deck.w-30);if(f.grounded&&Math.abs(gx-f.x)<220&&w.time>=f.jumpAt){f.vy=-990;f.grounded=false;f.jumpAt=w.time+.7;}}}
 if(rise< -65&&f.grounded&&f.platformId!=='ground')f.dropUntil=w.time+.25;drop=(f.dropUntil||0)>w.time;
 const dx=gx-f.x;f.vx=Math.abs(dx)>18?Math.sign(dx)*Math.min(330,Math.max(90,Math.abs(dx)*3)):0;if(f.vx)f.face=Math.sign(f.vx);api.physics(w,f,dt,{drop});const x=inside(w,f.x);if(f.x!==x){f.x=x;f.prevX=x;}f.cycle+=Math.abs(f.vx)*dt/35;f.state=Math.abs(f.vx)>12?'walk':'idle';
}
export function stepCompanion(w,dt,api){const f=w.companion,c=w.campaign;if(!f||!c||f.hp<=0||w.player.hp<=0)return;f.hit=Math.max(0,f.hit-dt);f.invuln=Math.max(0,f.invuln-dt);const spec=COMPANION_STATS[f.petKind];
 const fighting=['wave','boss'].includes(c.state);if(!fighting){f.attackAt=0;f.shots=[];}else stepShots(w,f,dt,api);
 if(Math.hypot(f.x-w.player.x,f.y-w.player.y)>850){recall(w,f);return;}
 const nearby=fighting?w.targets.filter(t=>(t.enemyKind||t.egg)&&t.hp>0&&!t.fallingSpawn&&Math.abs(t.x-w.player.x)<650&&Math.abs(t.y-f.y)<280).sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y)):[],target=nearby[0];
 if(f.attackAt){f.vx=0;api.physics(w,f,dt);f.state='attack';const t=w.targets.find(t=>t.id===f.targetId&&t.hp>0&&!t.petKind);if(!t){f.attackAt=0;return;}f.face=Math.sign(t.x-f.x)||f.face;if(w.time>=f.attackAt){f.attackAt=0;f.sequence++;f.readyAt=w.time+spec.cooldown;const empowered=f.sequence%3===0;if(spec.ranged&&Math.hypot(t.x-f.x,t.y-f.y)<spec.range+40&&targetVisible(w,f,t)){f.shots.push({x:f.x+f.face*20,y:f.y-32,px:f.x,py:f.y-32,targetId:t.id,age:0,empowered});}else if(!spec.ranged&&Math.abs(t.x-f.x)<spec.range+t.w&&Math.abs(t.y-f.y)<85&&targetVisible(w,f,t)){hit(w,f,t,api,empowered);}f.attackPoseUntil=w.time+.2;}return;}
 const inRange=target&&Math.abs(target.x-f.x)<spec.range&&Math.abs(target.y-f.y)<(spec.ranged?240:70)&&targetVisible(w,f,target);
 if(inRange&&w.time>=f.readyAt){f.targetId=target.id;f.attackAt=w.time+.25;f.state='windup';f.face=Math.sign(target.x-f.x)||f.face;f.vx=0;api.physics(w,f,dt);return;}
 const goal=target?{x:target.x-Math.sign(target.x-f.x||1)*(spec.ranged?180:58),y:target.y}:{x:w.player.x-w.player.face*70,y:w.player.y};navigate(w,f,goal,dt,api);
}
