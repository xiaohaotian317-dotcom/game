import {mirrorRules} from './campaign-artifacts.mjs';
import {PETS,PET_STAGE,MIRROR,captureChance,petRecord,rollPetTraits} from './campaign-pet-data.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const WILD_STRENGTH=.7;
const notice=(w,text)=>{w.campaign.notice=text;w.campaign.noticeUntil=w.time+3;};
export function spawnWildPet(w){const c=w.campaign,d=PETS[PET_STAGE[c.stage.id]];if(!c.petDungeon||!d||c.wildPetId)return null;const hp=Math.round(Math.round(c.stage.bossHp*.38)*WILD_STRENGTH),e={id:'wild-pet-'+(++w.serial),petKind:d.id,x:c.lock.x+c.lock.width*.7,y:w.floor,prevX:0,prevY:w.floor,w:28,h:Math.round(d.height[0]*.86),hp,maxHp:hp,face:-1,vx:0,vy:0,hit:0,deadUntil:0,burnUntil:0,nextBurn:0,rootUntil:0,frostSnareUntil:0,slowUntil:0,cycle:0,state:'appear',born:w.time,readyAt:w.time+1.8,attackAt:0,sequence:0,grounded:true,platformId:'ground'};e.prevX=e.x;w.targets.push(e);c.wildPetId=e.id;c.state='pet';c.capture={cooldownUntil:0,attempt:null,result:null};notice(w,d.name+'现身 · 削弱生命后，用 V 收妖镜捕捉');return e;}
export function startCapture(w){const c=w.campaign,e=w.targets.find(t=>t.id===c.wildPetId),state=c.capture,p=c.progression,rules=mirrorRules(p);
 if(c.state!=='pet'||!e||e.hp<=0)return false;
 if(!p?.mirrorEquipped||!p.artifacts?.mirror){notice(w,'请在法器面板装备收妖镜');return false;}
 if(w.time<(state.cooldownUntil||0)||state.attempt)return false;
 if(Math.hypot(e.x-w.player.x,e.y-w.player.y)>rules.range){notice(w,'距离太远 · 靠近灵宠后再使用收妖镜');return false;}
 state.attempt={started:w.time,end:w.time+rules.channel,chance:captureChance(e.hp,e.maxHp,p),target:e.id};state.cooldownUntil=w.time+rules.cooldown;e.state='bound';e.attackAt=0;e.readyAt=w.time+rules.channel+.5;notice(w,'收妖镜正在凝聚 · 保持距离，完成摄取');return true;
}
export function stepPets(w,dt,{damage,hitPlayer},input={}){const c=w.campaign;if(c.state!=='pet')return;const e=w.targets.find(t=>t.id===c.wildPetId),capture=c.capture,rules=mirrorRules(c.progression);if(!e)return;
 if(e.hp<=0){e.diedAt??=w.time;capture.attempt=null;c.petOutcome='slain';e.deadUntil=Infinity;notice(w,'灵宠已被击败，无法捕捉 · 下次留些生命再用镜');return;}
 e.hit=Math.max(0,e.hit-dt);e.prevX=e.x;e.prevY=e.y;
 if(input.capture)startCapture(w);
 const attempt=capture.attempt;
 if(attempt){
  // A channel does not roll or grant a pet until it has finished in range with a live target/player.
  if(w.player.hp<=0||Math.hypot(e.x-w.player.x,e.y-w.player.y)>rules.range){capture.attempt=null;e.state='idle';capture.result={success:false,at:w.time};notice(w,'摄取中断 · 请保持在镜面范围内');}
  else if(w.time>=attempt.end){const success=(c.random||Math.random)()<attempt.chance;capture.result={success,at:w.time};capture.attempt=null;if(success){petRecord(c.progression).push({id:'pet-'+(++c.progression.serial),kind:e.petKind,form:0,exp:0,skillRanks:[0,0,0],traits:rollPetTraits(c.random||Math.random),vitals:null,capturedStage:c.stage.id});c.dirty=true;e.captured=true;e.hp=0;e.deadUntil=Infinity;c.petOutcome='captured';notice(w,'捕捉成功 · '+PETS[e.petKind].name+'已收入灵宠背包');}else{e.state='idle';notice(w,'灵宠挣脱镜光 · 继续削弱生命后再次尝试');}return;}
  if(capture.attempt)return;
 }
 if(e.burnUntil>w.time&&w.time>=e.nextBurn){e.nextBurn=w.time+.75;damage(w,e,4,{fire:false,impact:false,label:'灼烧'});if(e.hp<=0)return;}
 const dx=w.player.x-e.x,dy=(w.player.y-w.player.h*.5)-(e.y-e.h*.5);e.face=Math.sign(dx)||e.face;
 if(w.time<e.born+1.5)return;
 if(e.attackAt){e.state='attack';if(w.time>=e.attackAt){e.attackAt=0;e.attackPoseUntil=w.time+.32;e.recoverUntil=w.time+.55;e.pendingSkill=e.sequence%3===0?1:0;e.readyAt=w.time+1.15;const amount=Math.round(28+c.stage.id*3.5);if(e.sequence%3!==0){if(Math.abs(dx)<150+w.player.w&&Math.abs(dy)<115)hitPlayer(w,Math.round(amount*WILD_STRENGTH),e.x);}else{const origin={x:e.x+e.face*25,y:e.y-34},angle=Math.atan2(dy,dx);for(const spread of [-.17,0,.17]){const a=angle+spread;w.projectiles.push({id:++w.serial,kind:'enemy',petProjectile:e.petKind,x:origin.x,y:origin.y,px:origin.x,py:origin.y,vx:Math.cos(a)*500,vy:Math.sin(a)*500,age:0,life:2.5,r:9,trail:[],owner:'enemy',damage:Math.round(Math.round(amount*.7)*WILD_STRENGTH),terrainCollision:true});} }w.events.push({type:'enemyAttack',heavy:true});c.petStrike={at:w.time,x:e.x+e.face*55,y:e.y-30,kind:e.petKind};}return;}
 if(w.time>=e.readyAt&&(Math.abs(dx)<125||w.time>e.readyAt+1.6)){e.sequence++;e.state='windup';e.attackAt=w.time+.6;return;}
 if(e.rootUntil>w.time){e.state='idle';return;}
 const slow=Math.min(e.frostSnareUntil>w.time?.65:1,e.slowUntil>w.time?.45:1);e.vx=Math.abs(dx)>85?Math.sign(dx)*165*slow:0;e.x=clamp(e.x+e.vx*dt,c.lock.x+45,c.lock.x+c.lock.width-45);e.cycle+=Math.abs(e.vx)*dt/40;e.state=Math.abs(e.vx)>1?'walk':'idle';
}
