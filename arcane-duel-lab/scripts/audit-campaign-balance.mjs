// A simple repeatable player controller: uses only public gameplay input.
// This is a tuning probe, not a substitute for a person's difficulty judgement.
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {STEP,HEROES} from '../dist/src/simulation.mjs?v=20261031-enemies1';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const id of [1,2])for(const hero of Object.keys(HEROES)){
 const w=createCampaign(hero,id,{seed:42});let nextJump=0,nextDash=0,casts=0;
 for(let frame=0;frame<120*300&&!['defeat','complete'].includes(w.campaign.state);frame++){
  const p=w.player,c=w.campaign,enemies=w.targets.filter(t=>t.hp>0).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)),t=enemies[0],melee=['lightning','shadow'].includes(hero);
  let input={move:c.state==='travel'||c.state==='portal'?1:0,attack:!!t,aim:t?{x:t.x,y:t.y-65}:{x:p.x+250,y:w.floor-50}};
  if(c.state==='portal'){input.move=Math.sign(c.portal.x-p.x);if(p.grounded&&p.platformId!=='ground'){input.drop=true;input.jump=true;}}
  if(t){const dx=t.x-p.x,dist=Math.abs(dx);input.move=dist>(melee?80:270)?Math.sign(dx):!melee&&dist<130?-Math.sign(dx):0;
   if(!p.cast){const orb=hero==='fire'&&w.projectiles.find(s=>s.kind==='emberOrb'&&Math.hypot(s.x-t.x,s.y-(t.y-50))<105);input.cast=orb&&p.recast?'e':['r','q','e'].find(key=>p.cooldowns[key]<=0);if(input.cast)casts++;}
   const field=w.enemyZones?.find(z=>Math.abs(z.x-p.x)<z.radius+30&&Math.abs(z.y-p.y)<95&&w.time-z.created>z.delay*.5);
   const threat=field||c.hazards.some(h=>Math.abs(h.x-p.x)<90&&w.time-h.born>h.delay*.5)||enemies.some(e=>e.ai?.attack&&Math.abs(e.x-p.x)<220);
   if(field)input.move=Math.sign(p.x-field.x||-dx);
   if(threat&&w.time>=nextJump&&p.grounded){input.jump=true;nextJump=w.time+1.6;}
   if(threat&&w.time>=nextDash&&p.dashCooldown<=0){input.dash=true;nextDash=w.time+2.4;}
  }
  stepCampaign(w,STEP,input);w.events=[];
 }
 const boss=w.targets.find(e=>e.id===w.campaign.bossId);results.push({stage:id,hero,state:w.campaign.state,encounter:w.campaign.encounter,hp:Math.round(w.player.hp),bossRemaining:boss?Math.ceil(boss.hp):null,seconds:Math.round(w.time),casts});
}
await writeFile(new URL('../validation/campaign2-balance.json',import.meta.url),JSON.stringify({note:'Public-input bot, actual hero health/cooldowns, no health restoration or damage injection. Not human playtesting.',results},null,2));
console.log(JSON.stringify(results,null,2));
