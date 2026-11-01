// Public input only. No injected HP, damage, cooldowns or kills.
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {STEP} from '../dist/src/simulation.mjs';
import {freshSolo,useItem,learnSkill} from '../dist/src/campaign-profile.mjs';
import {SOLO_HEROES,experience} from '../dist/src/campaign-growth-data.mjs';
import {updateCamera} from '../dist/src/camera.mjs';
import {writeFile} from 'node:fs/promises';
const results=[];
for(const hero of SOLO_HEROES){const profile=freshSolo();profile.owned=[hero];profile.selected=hero;
 // The starting supplies are real: optionally open the two provided coin boxes
 // and learn the existing E, as a player can through the inventory UI.
 for(let i=0;i<2;i++)useItem(profile,profile.bag.find(i=>i.type==='chestMedium').id,hero);
 for(let i=0;i<3;i++)useItem(profile,profile.bag.find(i=>i.type==='xpMedium').id,hero);
 learnSkill(profile,hero,`${hero}-1-0`);
 for(const id of [1,2]){const w=createCampaign(hero,id,{profile,seed:42,random:()=>.5});let jumpAt=0,dashAt=0;
 for(let frame=0;frame<120*360&&!['complete','defeat'].includes(w.campaign.state);frame++){
 const p=w.player,c=w.campaign,targets=w.targets.filter(t=>t.hp>0).sort((a,b)=>Math.abs(a.x-p.x)-Math.abs(b.x-p.x)),t=targets[0],melee=['lightning','shadow'].includes(hero),input={move:1,pickup:true,settle:true,attack:!!t,aim:t?{x:t.x,y:t.y-60}:{x:p.x+200,y:p.y-50}};
 if(c.state==='portal'){const d=c.drops.find(d=>!d.picked);input.move=Math.sign((d?.x??c.portal.x)-p.x);if(p.grounded&&p.platformId!=='ground'){input.drop=true;input.jump=true;}}
 if(t){const dx=t.x-p.x,dist=Math.abs(dx);input.move=dist>(melee?80:260)?Math.sign(dx):!melee&&dist<140?-Math.sign(dx):0;
  if(!p.cast){const orb=hero==='fire'&&w.projectiles.find(s=>s.kind==='emberOrb'&&Math.hypot(s.x-t.x,s.y-(t.y-50))<110);input.cast=orb&&p.recast?'e':['q','e'].find(k=>profile.heroes[hero].slots[k]&&p.cooldowns[k]<=0);}
  const field=w.enemyZones?.find(z=>Math.abs(z.x-p.x)<z.radius+35&&Math.abs(z.y-p.y)<95&&w.time-z.created>z.delay*.5),threat=field||c.hazards.some(h=>Math.abs(h.x-p.x)<90&&w.time-h.born>h.delay*.5)||targets.some(e=>e.ai?.attack&&Math.abs(e.x-p.x)<260);
  if(field)input.move=Math.sign(p.x-field.x||-dx);if(threat&&p.grounded&&w.time>=jumpAt){input.jump=true;jumpAt=w.time+1.3;}if(threat&&p.dashCooldown<=0&&w.time>=dashAt){input.dash=true;dashAt=w.time+2.1;}
 }
 stepCampaign(w,STEP,input);updateCamera(w,STEP);w.events=[];
 }
 results.push({hero,stage:id,state:w.campaign.state,encounter:w.campaign.encounter,hp:Math.round(w.player.hp),level:experience(profile.heroes[hero].exp).level,xp:profile.heroes[hero].exp,coins:profile.coins,seconds:Math.round(w.time),rewards:w.campaign.rewardCount});
 if(w.campaign.state!=='complete')break;
 }
}
const output={note:'Deterministic seed42 input bot; opened the real initial 2 coin boxes and 3 XP potions and learned base E. No equipment, injected stats or killed-target shortcuts. A balance probe, not human QA.',results};await writeFile(new URL('../validation/campaign3-balance.json',import.meta.url),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
