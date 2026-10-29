import {EXTRA_HEROES,VARIANT_LABELS} from './hero-roster.mjs?v=20261029-combat9';
import {RECAST_WINDOWS} from './controls.mjs?v=20261029-combat9';
import {initExtra,releaseExtra,extraOnHit,extraBefore,extraAfter,extraMirrorContact,reflectExtra} from './extra-gameplay.mjs?v=20261029-combat9';
import {castMuzzle} from './character-rig.mjs?v=20261029-combat9';
import {applyScene} from './scenes.mjs?v=20261029-combat9';
import {groundTarget,resolveGroundTarget} from './targeting.mjs?v=20261029-combat9';
import {firstTerrainHit,clearLine,segmentBox,resolveSolidSides} from './collision.mjs?v=20261029-combat9';
import {updateScene,hitSceneMechanism,triggerScene,nearestSceneInteraction} from './scene-mechanics.mjs?v=20261029-combat9';
export const WIDTH=1440, HEIGHT=800, FLOOR=704, STEP=1/120;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const HEROES={...EXTRA_HEROES,
  fire:{name:'焰术师',given:'烬绯',color:'#ff9b4c',accent:'#ffde8a',passive:'余烬',passiveText:'命中附加 3 秒灼烧；再次命中刷新持续时间。',speed:320,jump:650,
    skills:{attack:{name:'焰矢',icon:'flame',cd:.63,duration:.36,release:.14},q:{name:'爆燃印',icon:'burst',cd:4.2,duration:.65,release:.29},e:{name:'焰跃',icon:'jump',cd:5.5,duration:.46,release:.13},r:{name:'陨火天坠',icon:'meteor',cd:11,duration:.78,release:.18}}},
  nature:{name:'森灵',given:'荆歌',color:'#a9da78',accent:'#f9db87',passive:'共生',passiveText:'木灵鹿命中敌人回复 3 点生命，每 0.8 秒至多触发一次。',speed:340,jump:665,
    skills:{attack:{name:'荆棘籽',icon:'seed',cd:.69,duration:.4,release:.16},q:{name:'缚根',icon:'root',cd:4.8,duration:.71,release:.32},e:{name:'灵鹿召唤',icon:'fox',cd:7,duration:.66,release:.31},r:{name:'古树庇护',icon:'tree',cd:13,duration:1.04,release:.55}}}
};
const platform=(id,x,y,w,type='stone')=>({id,x,y,w,type,hp:type==='wood'?90:Infinity,maxHp:type==='wood'?90:Infinity,active:true});
const dummy=(id,x,y)=>({id,x,y,prevX:x,prevY:y,spawnX:x,spawnY:y,face:-1,vx:0,vy:0,w:28,h:80,hp:240,maxHp:240,grounded:true,platformId:y===FLOOR?'ground':'right',burnUntil:0,nextBurn:0,rootUntil:0,hit:0,deadUntil:0,attackAt:2});
export function createWorld(hero='fire',scene='training') {
  if(!HEROES[hero])throw new Error('Unknown hero');
  const world={hero,sceneId:'training',width:WIDTH,height:HEIGHT,floor:FLOOR,spawn:{x:220,y:FLOOR},characterScale:1,time:0,fxTime:0,hitstop:0,serial:0,platforms:[
    platform('ground',0,FLOOR,WIDTH),platform('left',78,548,305),platform('middle',520,555,330),
    platform('right',1030,502,335),platform('upper-left',330,387,220),
    platform('bridge',550,387,305,'wood'),platform('upper-right',875,345,220)
  ],player:{x:220,y:FLOOR,prevX:220,prevY:FLOOR,vx:0,vy:0,w:20,h:110,hp:120,maxHp:120,
    face:1,grounded:true,platformId:'ground',jumps:0,coyote:.1,jumpBuffer:0,drop:0,dash:0,dashCooldown:0,
    hurt:0,invuln:0,land:0,recast:null,cast:null,buffer:null,stomp:false,dead:0,passiveGlow:0,cycle:0,
    cooldowns:{attack:0,q:0,e:0,r:0}},
    targets:[dummy('a',790,FLOOR),dummy('b',1170,502)],projectiles:[],effects:[],fox:null,trees:[],texts:[],events:[],
    stats:{damage:0,hits:0,combo:0,best:0,lastHit:-100,healed:0,casts:0},
    aim:{x:790,y:FLOOR-50},counterattack:false,moving:false,slow:false,
    mirror:{x:610,y:519,angle:-Math.PI/4,cooldown:0},spring:{x:1260,y:FLOOR,charge:0,cooldown:0},
    shake:0,flash:0,impact:0};
  applyScene(world,scene);initExtra(world,HEROES[hero]);return world;
}
function emit(w,type,data={}){w.events.push({type,...data});if(w.events.length>100)w.events.shift();}
function effect(w,kind,data={}){const e={id:++w.serial,kind,age:0,duration:.6,...data};w.effects.push(e);return e;}
function text(w,x,y,label,color='#fff0c7',size=22){w.texts.push({x,y,text:String(label),color,size,age:0,duration:1.1});}
export function surfaceAt(w,x,y=FLOOR){const candidates=w.platforms.filter(p=>p.active&&x>=p.x-15&&x<=p.x+p.w+15);return candidates.sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y))[0]||w.platforms[0];}
function aim(w){const p=w.player;let x=w.aim.x-(p.x+p.face*20),y=w.aim.y-(p.y-72);const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
export function damage(w,t,amount,{fire=false,knock=0,root=0,label,impact=true,school,basic=false,castId,source}={}) {
  if(t.deadUntil>w.time||t.hp<=0)return false;
  const actual=Math.min(t.hp,amount);t.hp-=amount;t.hit=.15;
  if(knock){t.vx+=knock;t.vy=Math.min(t.vy,-Math.abs(knock)*.3);}
  if(fire){if(t.burnUntil<=w.time)t.nextBurn=w.time+.75;t.burnUntil=w.time+3;w.player.passiveGlow=.5;}
  if(root)t.rootUntil=w.time+root;
  w.stats.damage+=actual;w.stats.hits++;w.stats.combo=w.time-w.stats.lastHit<2?w.stats.combo+1:1;
  w.stats.best=Math.max(w.stats.best,w.stats.combo);w.stats.lastHit=w.time;
  text(w,t.x,t.y-t.h-10,label||Math.round(actual),fire?'#ffc27a':HEROES[w.hero].color);
  if(impact){effect(w,fire?'fireHit':school?school+'Hit':'leafHit',{x:t.x,y:t.y-t.h*.55,duration:.55,seed:w.serial+1});w.hitstop=Math.max(w.hitstop,amount>=30?.055:.027);w.shake=Math.max(w.shake,Math.min(9,amount*.2));emit(w,'hit',{fire,school,heavy:amount>=30});}
  extraOnHit(w,t,actual,{school,basic,castId,source},extraHooks);
  if(t.hp<=0){t.deadUntil=w.time+2.5;t.vx=0;t.burnUntil=0;text(w,t.x,t.y-110,'击破','#ffe6aa',18);emit(w,'break');}
  return true;
}
function damageBridge(w,x,y,r,amount){
  const b=w.platforms.find(p=>p.id==='bridge');
  if(!b?.active)return;
  if(x+r>b.x&&x-r<b.x+b.w&&Math.abs(y-b.y)<r+24){
    b.hp=Math.max(0,b.hp-amount);effect(w,'chips',{x:clamp(x,b.x,b.x+b.w),y:b.y,duration:.7,color:'#c8ab7a'});
    if(b.hp<=0){b.active=false;effect(w,'breakBridge',{x:b.x,y:b.y,w:b.w,duration:1.5});emit(w,'bridge');text(w,b.x+b.w/2,b.y-30,'木桥已击碎','#edca94',19);w.shake=7;}
  }
}
function area(w,x,y,r,amount,opts={}) {
  for(const t of w.targets)if(Math.hypot(t.x-x,(t.y-t.h*.45)-y)<r+30)damage(w,t,amount,{...opts,knock:opts.knock?Math.sign(t.x-x||1)*opts.knock:0});
  damageBridge(w,x,y,r,amount);
}
function projectile(w,kind,x,y,dx,dy,speed,amount,extra={}){
  w.projectiles.push({id:++w.serial,kind,x,y,px:x,py:y,vx:dx*speed,vy:dy*speed,age:0,life:3.5,damage:amount,r:kind==='seed'?6:8,trail:[],...extra});
}
function release(w,c) {
  if(releaseExtra(w,c,extraHooks))return;
  const p=w.player,h=w.hero,socket=castMuzzle(w),sx=socket.x,sy=socket.y;
  const ax=w.aim.x-sx,ay=w.aim.y-sy,al=Math.hypot(ax,ay)||1,d={x:ax/al,y:ay/al};
  if(c.variant==='stomp'){p.stomp=true;p.vy=1000;p.vx*=.35;effect(w,'stompTrail',{x:p.x,y:p.y-45,duration:.3});emit(w,'stomp');return;}
  if(c.variant==='command'){
    if(w.fox){const f=w.fox;f.vx=Math.sign(c.x-f.x||p.face)*610;f.vy=-590;f.grounded=false;f.commandUntil=w.time+1.2;f.leap=true;f.attackPose=.6;effect(w,'leaves',{x:f.x,y:f.y-35,duration:.6});emit(w,'foxCommand');}return;
  }
  if(c.key==='attack'){
    projectile(w,h==='fire'?'fireball':'seed',sx,sy,d.x,d.y,h==='fire'?720:680,h==='fire'?18:15,{owner:'player',fire:h==='fire'});
    effect(w,h==='fire'?'muzzle':'seedCast',{x:sx,y:sy,angle:Math.atan2(d.y,d.x),duration:.24});emit(w,'attack',{hero:h});return;
  }
  const floor=resolveGroundTarget(w,c.target)||groundTarget(w,c.x,c.y);
  if(h==='fire'){
    if(c.key==='q'&&floor){effect(w,'eruption',{x:floor.x,y:floor.y,anchor:floor,delay:.55,duration:1.7,triggered:false});emit(w,'charge');}
    if(c.key==='e'){
      p.vx=p.face*390;p.vy=-720;p.grounded=false;p.jumps=Math.max(1,p.jumps);
      p.recast={key:'e',name:'落烬',icon:'stomp',until:w.time+RECAST_WINDOWS.fire,start:w.time,window:RECAST_WINDOWS.fire};
      effect(w,'fireLeap',{x:p.x,y:p.y-20,face:p.face,duration:.6});emit(w,'leap');
    }
    if(c.key==='r'&&floor){
      const x=floor.x,startX=x-130,startY=-130;
      // 0.18 s windup + 0.82 s flight = one second from accepted input to impact.
      effect(w,'meteor',{x,y:floor.y,anchor:floor,startX,startY,delay:.82,duration:2.37,triggered:false});emit(w,'meteor');
    }
  }else{
    if(c.key==='q'){const y=groundTarget(w,p.x,p.y)?.y??w.floor,to=clamp(c.x,p.x-500,p.x+500);effect(w,'roots',{x:p.x,y,to,duration:2.4,triggered:false});emit(w,'roots');}
    if(c.key==='e'){
      w.fox={x:p.x+p.face*65,y:p.y,prevX:p.x+p.face*65,prevY:p.y,vx:0,vy:-180,w:36,h:88,hp:80,maxHp:80,hit:0,invuln:0,attackPose:0,jumps:0,grounded:false,platformId:null,
        until:w.time+10,attackAt:0,healAt:0,commandUntil:0,leap:false,face:p.face,cycle:0};
      p.recast={key:'e',name:'角跃令',icon:'fox',until:w.time+RECAST_WINDOWS.nature,start:w.time,window:RECAST_WINDOWS.nature};
      effect(w,'sprout',{x:w.fox.x,y:w.fox.y,duration:.75});emit(w,'summon');
    }
    if(c.key==='r'&&floor){
      const x=floor.x,y=floor.y,id='tree-'+(++w.serial);
      w.trees.push({id,x,y,anchor:floor,age:0,until:w.time+9,nextHeal:0});
      w.platforms.push(platform(id+'-a',x-142,y-110,125,'root'),platform(id+'-b',x+18,y-210,125,'root'));
      for(const b of w.platforms.filter(b=>b.id.startsWith(id)))b.active=false;
      effect(w,'treeBirth',{x,y,duration:1.2});emit(w,'tree');
    }
  }
}
function beginCast(w,key) {
  const p=w.player,s=HEROES[w.hero].skills[key];
  if(!s||p.dead>0||p.hurt>0||p.dash>0)return false;
  const isRecast=p.recast&&p.recast.key===key&&p.recast.until>w.time;
  if(p.cast&&p.cast.age<p.cast.duration*.75)return false;
  if(!isRecast&&p.cooldowns[key]>0)return false;
  if(isRecast&&w.hero==='fire'&&p.grounded)return false;
  const variant=isRecast?(EXTRA_HEROES[w.hero]?.recast.variant||(w.hero==='fire'?'stomp':'command')):null;
  const recastData=isRecast?p.recast.data:null;
  const needsGround=!variant&&((w.hero==='fire'&&['q','r'].includes(key))||(w.hero==='nature'&&key==='r')||EXTRA_HEROES[w.hero]?.groundSkills.includes(key));
  const target=needsGround?groundTarget(w,EXTRA_HEROES[w.hero]?clamp(w.aim.x,p.x-520,p.x+520):w.aim.x,w.aim.y):null;
  if(needsGround&&!target)return false;
  if(isRecast)p.recast=null;else p.cooldowns[key]=s.cd;
  p.face=w.aim.x>=p.x?1:-1;
  p.cast={id:++w.serial,data:recastData,key,variant,age:0,duration:variant==='stomp'?.34:variant==='command'?.35:variant?.35:s.duration,releaseAt:variant==='stomp'?.05:variant==='command'?.1:variant?.1:s.release,released:false,x:w.aim.x,y:w.aim.y,target};
  w.stats.casts++;emit(w,'cast',{key,variant});return true;
}
export function requestCast(w,key,x=w.aim.x,y=w.aim.y) {
  w.aim={x,y};if(beginCast(w,key))return true;
  if(w.player.cooldowns[key]<.2||w.player.cast)w.player.buffer={key,until:w.time+.2,x,y};return false;
}
function jump(w,boost=false) {
  const p=w.player;p.vy=boost?-880:-(HEROES[w.hero].jump)*(w.jumpScale||1)*(p.jumps? .92:1);p.jumps++;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.land=0;
  effect(w,p.jumps===1?'dust':'airRing',{x:p.x,y:p.y,duration:.4,color:HEROES[w.hero].color});emit(w,'jump',{double:p.jumps>1});
}
function physics(w,a,dt,{drop=false,phase=false}={}) {
  a.prevX=a.x;a.prevY=a.y;
  const previousY=a.y;
  a.vy=Math.min(1250,a.vy+1900*dt);
  const previousX=a.x;a.x=clamp(a.x+a.vx*dt,a.w+10,(w.width||WIDTH)-a.w-10);a.y+=a.vy*dt;
  a.grounded=false;a.platformId=null;
  if(a.vy>=0){
    let best=null;
    for(const b of w.platforms){
      if(!b.active||(drop&&b.id!=='ground'))continue;
      if(a.x+a.w>b.x&&a.x-a.w<b.x+b.w&&previousY<=b.y+2&&a.y>=b.y){
        if(!best||b.y<best.y)best=b;
      }
    }
    if(best){a.y=best.y;a.vy=0;a.grounded=true;a.platformId=best.id;}
  }
  if(!phase)resolveSolidSides(w,a,previousX,previousY);
  if(a.y>(w.height||HEIGHT)+160){a.x=w.spawn.x;a.y=w.spawn.y;a.vy=0;a.grounded=true;a.platformId='ground';}
}
export function hitPlayer(w,amount,fromX) {
  const p=w.player;if(p.invuln>0||p.dead>0)return false;
  const absorbed=Math.min(p.shield||0,amount);p.shield=Math.max(0,(p.shield||0)-absorbed);if(absorbed)effect(w,'frostHit',{x:p.x,y:p.y-60,duration:.5});
  p.hp=Math.max(0,p.hp-(amount-absorbed));p.hurt=.24;p.invuln=.7;p.vx=Math.sign(p.x-fromX||1)*200;p.cast=null;p.burst=null;p.stomp=false;
  w.shake=5;effect(w,'enemyHit',{x:p.x,y:p.y-65,duration:.4});text(w,p.x,p.y-125,'−'+amount,'#f1a7bb');emit(w,'hurt');
  if(!p.hp){p.dead=1.6;p.recast=null;}return true;
}
function updateEffects(w,dt){
  for(const e of w.effects){
    e.age+=dt;
    if(e.anchor&&!e.triggered){const target=resolveGroundTarget(w,e.anchor);if(target){e.anchor=target;e.x=target.x;e.y=target.y;}}
    if(e.kind==='eruption'&&!e.triggered&&e.age>=e.delay){e.triggered=true;area(w,e.x,e.y-28,100,33,{fire:true,knock:170});w.shake=8;emit(w,'explode');}
    if(e.kind==='meteor'&&!e.triggered&&e.age>=e.delay){e.triggered=true;area(w,e.x,e.y-45,155,64,{fire:true,knock:300});effect(w,'fireZone',{x:e.x,y:e.y,duration:2,nextTick:0});w.shake=17;w.hitstop=.085;w.flash=.13;emit(w,'explode',{heavy:true});}
    if(e.kind==='fireZone'&&e.age>=e.nextTick){e.nextTick=e.age+.55;for(const t of w.targets)if(Math.abs(t.x-e.x)<85&&Math.abs(t.y-e.y)<35)damage(w,t,4,{fire:true,impact:false});}
    if(e.kind==='roots'&&!e.triggered&&e.age>=.35){e.triggered=true;for(const t of w.targets)if(t.x>=Math.min(e.x,e.to)-25&&t.x<=Math.max(e.x,e.to)+25&&Math.abs(t.y-e.y)<35)damage(w,t,22,{root:2});damageBridge(w,(e.x+e.to)/2,e.y,Math.abs(e.to-e.x)/2,16);}
  }
  w.effects=w.effects.filter(e=>e.age<e.duration);
  for(const t of w.texts){t.age+=dt;t.y-=dt*27;}w.texts=w.texts.filter(t=>t.age<t.duration);
}
function updateProjectiles(w,dt){
  for(const s of w.projectiles){
    if(s.homing){const t=w.targets.filter(t=>t.hp>0).sort((a,b)=>Math.hypot(a.x-s.x,a.y-45-s.y)-Math.hypot(b.x-s.x,b.y-45-s.y))[0];if(t){const dx=t.x-s.x,dy=t.y-45-s.y,l=Math.hypot(dx,dy)||1,speed=Math.hypot(s.vx,s.vy);s.vx=lerp(s.vx,dx/l*speed,1-Math.exp(-6*dt));s.vy=lerp(s.vy,dy/l*speed,1-Math.exp(-6*dt));}}
    s.px=s.x;s.py=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;s.age+=dt;
    s.trail||=[];s.trail.push({x:s.px,y:s.py});if(s.trail.length>12)s.trail.shift();
    if(s.kind==='seed')s.vy+=dt*55;
    const wall=s.terrainCollision===false?null:firstTerrainHit(w,s.px,s.py,s.x,s.y,s.r);
    let contact=wall?{...wall,type:'wall'}:null;
    const evading=w.player.burst?.dodgeProjectiles&&w.time<w.player.burst.until;
    const actors=s.owner==='enemy'?[...(!evading?[w.player]:[]),...(w.fox?[w.fox]:[])]:w.targets.filter(t=>t.hp>0&&t.deadUntil<=w.time);
    for(const a of actors){const t=segmentBox(s.px,s.py,s.x,s.y,{x:a.x-a.w,y:a.y-a.h,w:a.w*2,h:a.h},s.r);if(t!==null&&(!contact||t<contact.t))contact={t,type:'actor',actor:a};}
    const m=w.mirror,mirrorT=m.enabled!==false&&s.owner==='player'&&s.age>.05&&s.mirrorAt!==m.angle?segmentBox(s.px,s.py,s.x,s.y,{x:m.x-17,y:m.y-29,w:34,h:58},s.r):null;
    if(mirrorT!==null&&(!contact||mirrorT<contact.t))contact={t:mirrorT,type:'mirror'};
    const ice=extraMirrorContact(w,s);if(ice&&(!contact||ice.t<contact.t))contact=ice;
    if(contact){s.x=lerp(s.px,s.x,contact.t);s.y=lerp(s.py,s.y,contact.t);}
    if(hitSceneMechanism(w,s,sceneHooks))continue;
    if(contact?.type==='iceMirror')reflectExtra(w,s,contact.mirror,extraHooks);
    if(contact?.type==='mirror'){
      const nx=-Math.sin(m.angle),ny=Math.cos(m.angle),dot=s.vx*nx+s.vy*ny;
      s.vx-=2*dot*nx;s.vy-=2*dot*ny;s.mirrorAt=m.angle;
      m.cooldown=.2;effect(w,'mirrorFlash',{x:m.x,y:m.y,duration:.4});emit(w,'mirror');
    }
    if(contact?.type==='actor'){
      if(s.owner==='enemy'){if(contact.actor===w.player)hitPlayer(w,s.damage,s.px);else hitSummon(w,s.damage,s.px);}
      else damage(w,contact.actor,s.damage,{fire:s.fire,knock:Math.sign(s.vx)*70,school:s.school,basic:s.basic,castId:s.castId});
      s.life=0;
    }
    if(contact?.type==='wall'){
      if(contact.box.source?.type==='wood'&&s.owner==='player')damageBridge(w,s.x,s.y,24,s.damage);
      effect(w,s.fire?'fireHit':s.school?s.school+'Hit':s.kind==='seed'?'leafHit':'enemyHit',{x:s.x,y:s.y,duration:.5});
      effect(w,'chips',{x:s.x,y:s.y,duration:.6});emit(w,'wallHit',{fire:s.fire});s.life=0;
    }
    if(s.x<-100||s.x>(w.width||WIDTH)+100||s.y<-200||s.y>(w.height||HEIGHT)+100)s.life=0;
  }
  w.projectiles=w.projectiles.filter(s=>s.age<s.life);
}
function updateTargets(w,dt) {
  for(const t of w.targets){
    t.hit=Math.max(0,t.hit-dt);
    if(t.deadUntil){if(w.time>=t.deadUntil){Object.assign(t,dummy(t.id,t.spawnX,t.spawnY));effect(w,'respawn',{x:t.x,y:t.y-35,duration:.65});}else continue;}
    if(t.burnUntil>w.time&&w.time>=t.nextBurn){t.nextBurn+=.75;damage(w,t,4,{label:'4 灼烧',impact:false});}
    if(t.rootUntil>w.time)t.vx=0;
    else if(w.moving)t.vx=Math.sin(w.time*1.5+(t.id==='a'?0:2))*90*Math.min(t.slowUntil>w.time?.45:1,(t.frostSnareUntil||0)>w.time?.65:1);
    else t.vx*=Math.exp(-8*dt);
    if(!w.moving&&(t.slowUntil>w.time||(t.frostSnareUntil||0)>w.time))t.vx*=Math.exp(-5*dt);
    if(t.rootUntil<=w.time)t.vx+=(t.fieldForce||0)*dt;
    if(Math.abs(t.vx)>3)t.face=Math.sign(t.vx);
    physics(w,t,dt);
    if(w.counterattack&&w.time>=t.attackAt&&Math.abs(t.y-w.player.y)<220){
      t.attackAt=w.time+2.8;const dx=w.player.x-t.x,dy=w.player.y-65-(t.y-55),l=Math.hypot(dx,dy)||1;
      projectile(w,'enemy',t.x,t.y-55,dx/l,dy/l,300,10,{owner:'enemy',life:4});
      effect(w,'enemyCast',{x:t.x,y:t.y-55,duration:.4});emit(w,'enemyAttack');
    }
  }
}
export function hitSummon(w,amount,fromX=0){
  const f=w.fox;if(!f||f.invuln>0)return false;
  f.hp=Math.max(0,f.hp-amount);f.hit=.2;f.invuln=.35;f.vx=Math.sign(f.x-fromX||1)*180;
  effect(w,'leafHit',{x:f.x,y:f.y-45,duration:.45});text(w,f.x,f.y-115,'−'+amount,'#ffbd9d',16);emit(w,'woodHit');
  if(f.hp<=0){effect(w,'stagDeath',{x:f.x,y:f.y,duration:1.1,face:f.face});w.fox=null;if(w.player.recast?.name==='角跃令')w.player.recast=null;}
  return true;
}
function updateFox(w,dt) {
  const f=w.fox;if(!f)return;
  if(w.time>f.until){effect(w,'stagDeath',{x:f.x,y:f.y,duration:1.1,face:f.face});w.fox=null;return;}
  f.hit=Math.max(0,f.hit-dt);f.invuln=Math.max(0,f.invuln-dt);f.attackPose=Math.max(0,f.attackPose-dt);
  const alive=w.targets.filter(t=>t.hp>0&&t.deadUntil<=w.time).sort((a,b)=>(Math.abs(a.x-f.x)+Math.abs(a.y-f.y)*3)-(Math.abs(b.x-f.x)+Math.abs(b.y-f.y)*3));
  const target=alive[0],aggro=!!target;
  let tx=aggro?target.x:w.player.x,ty=aggro?target.y:w.player.y;
  // Pick a reachable stepping ledge when the quarry is above us.
  if(ty<f.y-140){const steps=w.platforms.filter(b=>b.active&&b.y<f.y-40&&b.y>=f.y-270&&Math.abs(b.x+b.w/2-f.x)<430).sort((a,b)=>(Math.abs(a.x+a.w/2-tx)+Math.abs(a.y-ty))-(Math.abs(b.x+b.w/2-tx)+Math.abs(b.y-ty)));if(steps[0]){tx=clamp(tx,steps[0].x+35,steps[0].x+steps[0].w-35);ty=steps[0].y;}}
  if(w.time>f.commandUntil){
    const delta=tx-f.x,obstacle=(w.obstacles||[]).some(b=>b.actor!==false&&b.y<f.y&&b.y+b.h>f.y-10&&Math.abs((b.x+b.w/2)-f.x)<100&&Math.sign(b.x+b.w/2-f.x)===Math.sign(delta));
    f.vx=lerp(f.vx,Math.abs(delta)>52?Math.sign(delta)*285:0,1-Math.exp(-10*dt));
    if(f.grounded&&((ty<f.y-50&&Math.abs(delta)<380)||obstacle)){f.vy=-750;f.jumps=1;}
    else if(!f.grounded&&f.jumps===1&&f.vy>-80&&ty<f.y-40){f.vy=-675;f.jumps=2;}
  }
  if(Math.abs(f.vx)>10)f.face=Math.sign(f.vx);
  physics(w,f,dt);if(f.grounded)f.jumps=0;f.cycle+=Math.abs(f.vx)*dt/28;
  for(const t of alive)if(Math.abs(f.x-t.x)<78&&Math.abs(f.y-t.y)<90&&w.time>f.attackAt&&clearLine(w,f.x,f.y-45,t.x,t.y-40)){
    f.attackAt=w.time+.8;f.attackPose=.3;damage(w,t,f.leap?26:12,{knock:f.face*(f.leap?150:50)});f.leap=false;emit(w,'stagStrike');
    effect(w,'foxBite',{x:t.x,y:t.y-30,duration:.4});
    if(w.time>=f.healAt){f.healAt=w.time+.8;const healed=Math.min(3,w.player.maxHp-w.player.hp);w.player.hp+=healed;w.stats.healed+=healed;w.player.passiveGlow=.65;effect(w,'healMote',{x:f.x,y:f.y-20,toX:w.player.x,toY:w.player.y-70,duration:.7});if(healed)text(w,w.player.x,w.player.y-120,'+'+healed,'#b5eb96',17);}
  }
}
function updateTrees(w,dt){
  for(const t of w.trees){
    if(t.anchor){
      const base=w.platforms.find(b=>b.id===t.anchor.platformId&&b.active);
      if(!base){t.until=w.time-1;effect(w,'leaves',{x:t.x,y:t.y,duration:.8});continue;}
      const delta=base.y-t.y;t.y=base.y;
      if(delta)for(const b of w.platforms.filter(b=>b.id.startsWith(t.id))){b.y+=delta;for(const a of [w.player,...w.targets,...(w.fox?[w.fox]:[])])if(a.grounded&&a.platformId===b.id){a.y+=delta;a.prevY=a.y;}}
    }
    t.age+=dt;
    if(t.age>.65)for(const b of w.platforms)if(b.id.startsWith(t.id))b.active=true;
    if(w.time>=t.nextHeal){t.nextHeal=w.time+.7;const p=w.player;if(Math.abs(p.x-t.x)<155&&Math.abs(p.y-t.y)<100&&p.hp<p.maxHp){p.hp=Math.min(p.maxHp,p.hp+2);text(w,p.x,p.y-125,'+2','#a7df86',15);}}
  }
  const expired=w.trees.filter(t=>w.time>t.until);
  for(const t of expired)w.platforms=w.platforms.filter(b=>!b.id.startsWith(t.id));
  w.trees=w.trees.filter(t=>w.time<=t.until);
}
export function step(w,dt,input={}) {
  if(dt<=0)return;
  dt=Math.min(dt,1/30);w.fxTime=(w.fxTime||0)+dt;w.flash=Math.max(0,w.flash-dt);
  if(w.hitstop>0){
    if(input.jump)w.player.jumpBuffer=.13;
    if(input.cast)w.player.buffer={key:input.cast,until:w.time+.2,x:w.aim.x,y:w.aim.y};
    if(input.dash)w.player.queuedDash=true;
    w.hitstop=Math.max(0,w.hitstop-dt);w.player.prevX=w.player.x;w.player.prevY=w.player.y;return;
  }
  w.time+=dt;
  const p=w.player;
  updateScene(w,dt,sceneHooks);
  if(input.aim)w.aim={...input.aim};
  extraBefore(w,dt,extraHooks);
  for(const k of Object.keys(p.cooldowns))p.cooldowns[k]=Math.max(0,p.cooldowns[k]-dt);
  for(const k of ['drop','dash','dashCooldown','hurt','invuln','land','passiveGlow'])p[k]=Math.max(0,p[k]-dt);
  w.shake*=Math.exp(-14*dt);w.mirror.cooldown=Math.max(0,w.mirror.cooldown-dt);w.spring.cooldown=Math.max(0,w.spring.cooldown-dt);
  if(p.recast&&w.time>=p.recast.until)p.recast=null;
  if(p.dead>0){p.dead-=dt;if(p.dead<=0){p.hp=p.maxHp;p.x=w.spawn.x;p.y=w.spawn.y;p.vx=0;p.vy=0;p.invuln=1;emit(w,'respawn');}}
  if(input.jump)p.jumpBuffer=.13;else p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
  p.coyote=p.grounded?.1:Math.max(0,p.coyote-dt);
  if(input.drop&&input.jump&&p.grounded&&p.platformId!=='ground'){p.drop=.25;p.y+=4;p.grounded=false;p.jumpBuffer=0;p.coyote=0;p.jumps=1;}
  else if(p.jumpBuffer>0&&p.hurt<=0&&p.dead<=0&&(p.coyote>0||p.jumps<2))jump(w);
  const dashInput=input.dash||p.queuedDash;p.queuedDash=false;
  if(dashInput&&p.dashCooldown<=0&&p.hurt<=0&&p.dead<=0){p.dash=.17;p.dashCooldown=1.1;p.invuln=.2;p.vx=(input.move||p.face)*900;p.vy=0;effect(w,'dash',{x:p.x,y:p.y-55,face:p.face,color:HEROES[w.hero].color,duration:.35});emit(w,'dash');}
  if(input.cast)requestCast(w,input.cast);
  if(input.attack&&!p.cast)requestCast(w,'attack');
  if(p.buffer){if(p.buffer.until<w.time)p.buffer=null;else if(beginCast(w,p.buffer.key))p.buffer=null;}
  if(p.cast){
    const c=p.cast;c.age+=dt;
    if(!c.released&&c.age>=c.releaseAt){c.released=true;release(w,c);}
    if(c.age>=c.duration)p.cast=null;
  }
  const wasGrounded=p.grounded,oldVy=p.vy,b=p.burst;
  if(b){p.vx=b.vx;p.vy=b.vy;}
  if(p.dead<=0){
    if(!b&&p.dash<=0&&p.hurt<=0&&!p.stomp){
      const move=input.move||0,slow=p.cast?(w.hero==='nature'?.55:.68):1;
      const target=move*HEROES[w.hero].speed*slow+(w.windForce||0);
      p.vx=lerp(p.vx,target,1-Math.exp(-(move?15:21)*dt));
      if(move&&!p.cast)p.face=Math.sign(move);
    }
    if(input.down&&!p.grounded&&!p.stomp)p.vy=Math.max(p.vy,440);
    physics(w,p,dt,{drop:p.drop>0||!!b?.phase,phase:!!b?.phase});
    if(p.dash>0)p.vy=0;
    extraAfter(w,dt,extraHooks);
  }
  if(p.grounded){
    p.jumps=0;
    if(!wasGrounded&&oldVy>100){p.land=.18;effect(w,'dust',{x:p.x,y:p.y,duration:.4,color:HEROES[w.hero].color});emit(w,'land');
      if(p.stomp){p.stomp=false;area(w,p.x,p.y-28,125,40,{fire:true,knock:240});effect(w,'fireZone',{x:p.x,y:p.y,duration:2,nextTick:0});effect(w,'stompHit',{x:p.x,y:p.y,duration:.7});w.shake=7;emit(w,'explode');}
    }
  }
  p.cycle+=Math.abs(p.vx)*dt/29;
  const spring=w.spring;
  if(spring.enabled!==false&&p.grounded&&Math.min(Math.abs(p.y-spring.y),Math.abs(p.y-(spring.surfaceY??spring.y)))<8&&Math.abs(p.x-spring.x)<35&&spring.cooldown<=0){spring.charge+=dt;if(spring.charge>.16){jump(w,true);spring.charge=0;spring.cooldown=1.2;effect(w,'spring',{x:spring.x,y:spring.y,duration:.8});emit(w,'spring');}}
  else spring.charge=Math.max(0,spring.charge-dt*2);
  updateTargets(w,dt);updateProjectiles(w,dt);updateEffects(w,dt);updateFox(w,dt);updateTrees(w,dt);
  if(w.time-w.stats.lastHit>2)w.stats.combo=0;
}
export function actionState(w){
  const p=w.player;
  if(p.dead>0)return '倒地';
  if(p.hurt>0)return '受击';
  if(p.stomp)return '落烬 · 下砸';
  if(p.dash>0)return '冲刺';
  if(p.cast&&VARIANT_LABELS[p.cast.variant])return VARIANT_LABELS[p.cast.variant];
  if(p.cast)return p.cast.variant==='command'?'角跃令':p.cast.variant==='stomp'?'落烬':HEROES[w.hero].skills[p.cast.key].name;
  if(!p.grounded)return p.vy<0?'起跳':'下落';
  if(p.land>0)return '落地';
  return Math.abs(p.vx)>25?'奔跑':'待机';
}
export function repair(w){const b=w.platforms.find(b=>b.id==='bridge');b.active=true;b.hp=b.maxHp;if(w.mechanisms?.vine){w.mechanisms.vine.until=0;w.mechanisms.vine.growth=0;w.platforms.find(p=>p.id==='vine').active=false;}emit(w,'repair');}
export function toggleMirror(w){w.mirror.angle=-w.mirror.angle;effect(w,'mirrorFlash',{x:w.mirror.x,y:w.mirror.y,duration:.4});}
const sceneHooks={damageBridge,damage,hitPlayer,hitSummon};
export function triggerMechanism(w,id){return triggerScene(w,id,sceneHooks);}
export function interactNearest(w){return nearestSceneInteraction(w,sceneHooks);}

const extraHooks={castMuzzle,effect,projectile,damage,damageBridge,area,emit};
