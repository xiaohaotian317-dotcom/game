import {createWorld,HEROES} from './simulation.mjs?v=20261031-enemies1';
import {heroStats} from './campaign-profile.mjs';

export function validateTeam(profile,heroes){
 if(!Array.isArray(heroes)||heroes.length<1||heroes.length>2)throw Error('请选择一至两位出战英雄');
 if(new Set(heroes).size!==heroes.length)throw Error('两名出战英雄不能相同');
 if(heroes.some(h=>!HEROES[h]||!profile.owned.includes(h)))throw Error('只能选择已经拥有的英雄');
 return [...heroes];
}
export function initTeam(w,heroes){
 const c=w.campaign,p=c.progression;if(!p)return;
 const ids=validateTeam(p,heroes||[w.hero]);
 c.team=ids.map(id=>{const base=id===w.hero?w:createWorld(id),stats=heroStats(p,id);Object.assign(base.player,{hp:stats.maxHp,maxHp:stats.maxHp,mp:stats.maxMp,maxMp:stats.maxMp});return {hero:id,player:base.player,roleState:base.roleState};});
 c.activeSlot=ids.indexOf(w.hero);if(c.activeSlot<0)throw Error('起始英雄必须在出战阵容中');
 c.teamRevision=0;
}
export function tickReserve(w,dt){
 for(const member of w.campaign.team||[]){if(member.player===w.player)continue;const p=member.player;
  for(const key of Object.keys(p.cooldowns))p.cooldowns[key]=Math.max(0,p.cooldowns[key]-dt);
  for(const key of ['dashCooldown','hurt','invuln'])p[key]=Math.max(0,(p[key]||0)-dt);
 }
}
function clearHeroActions(w){
 w.player.cast=null;w.player.buffer=null;w.player.recast=null;w.player.burst=null;w.player.queuedDash=false;w.player.stomp=false;w.player.dash=0;
 w.projectiles=w.projectiles.filter(p=>p.owner==='enemy'||p.kind==='enemy');
 w.effects=[];w.fox=null;w.trees=[];w.fields=[];w.constructs=[];w.iceMirrors=[];w.portals=[];w.ghosts=[];
 w.platforms=w.platforms.filter(p=>!['root','ice','construct'].includes(p.type));
 w.campaign.soloFields=[];w.campaign.castSkills={};w.campaignDamageSkill=null;
}
export function switchTeamHero(w,slot,{forced=false}={}){
 const c=w.campaign,member=c?.team?.[slot];
 if(!member||slot===c.activeSlot||member.player.hp<=0||['complete','defeat'].includes(c.state))return false;
 if(!forced&&w.player.enemyControl?.until>w.time){c.notice='受控时无法切换英雄';c.noticeUntil=w.time+1.4;return false;}
 const current=w.player,position={x:current.x,y:current.y,vx:current.vx,vy:current.vy,face:current.face,grounded:current.grounded,platformId:current.platformId,jumps:current.jumps,jumpAt:current.jumpAt??-99,blinkUntil:current.blinkUntil||0,coyote:current.coyote,land:current.land,landImpact:current.landImpact??.7};
 clearHeroActions(w);w.player=member.player;w.hero=member.hero;w.roleState=member.roleState;c.activeSlot=slot;
 Object.assign(w.player,position,{prevX:position.x,prevY:position.y,jumpBuffer:0,dead:0});
 w.player.cast=null;w.player.buffer=null;w.player.recast=null;w.player.burst=null;w.player.dash=0;
 const stats=heroStats(c.progression,w.hero);w.player.maxHp=stats.maxHp;w.player.maxMp=stats.maxMp;w.player.hp=Math.min(stats.maxHp,w.player.hp);w.player.mp=Math.min(stats.maxMp,w.player.mp);c.stats=stats;
 if(c.capture?.attempt)c.capture.attempt=null;
 if(c.artifactState?.active){c.artifactState.active=false;c.artifactState.readyAt=w.time+8;}
 c.teamRevision++;c.notice=HEROES[w.hero].name+' · 出战';c.noticeUntil=w.time+1.2;
 return true;
}
export function rescueWithReserve(w){const c=w.campaign;if(w.player.hp>0)return false;const slot=c.team?.findIndex(m=>m.player.hp>0);return slot>=0?switchTeamHero(w,slot,{forced:true}):false;}
