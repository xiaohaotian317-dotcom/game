import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {HEROES,STEP} from '../dist/src/simulation.mjs';
export function auditPlatformRoutes(seeds=Array.from({length:16},(_,i)=>i+1)){
 let checked=0;const unreachable=[];
 for(const hero of Object.keys(HEROES))for(const seed of seeds){
  const template=createCampaign(hero,1,{seed}),all=template.platforms;
  for(const target of all.filter(p=>p.id!=='ground')){
   const source=all.find(p=>p.id===target.accessFrom);if(!source){unreachable.push({hero,seed,target:target.id,error:'Missing supporting platform'});continue;}
   let reached=false;
   for(const delay of [.24,.30,.36,.42]){
    const w=createCampaign(hero,1,{seed});w.campaign.triggers=[1e8,2e8,3e8,4e8];
    const center=target.x+target.w/2,x=source.id==='ground'?center:Math.max(source.x+26,Math.min(source.x+source.w-26,center));
    Object.assign(w.player,{x,prevX:x,y:source.y,prevY:source.y,vx:0,vy:0,grounded:true,platformId:source.id,jumps:0});let second=false;
    for(let n=0;n<260;n++){const jump=n===0||!second&&n*STEP>=delay;if(n&&jump)second=true;const dx=center-w.player.x;stepCampaign(w,STEP,{jump,move:Math.abs(dx)>12?Math.sign(dx):0});if(n>8&&w.player.grounded&&w.player.platformId===target.id){reached=true;break;}}
    if(reached)break;
   }
   checked++;if(!reached)unreachable.push({hero,seed,from:source.id,to:target.id,rise:source.y-target.y});
  }
 }
 return {checked,unreachable,seeds,method:'Real 120Hz physics, no spells/teleport. Each platform is reached from its declared support; support graph roots at ground. Travel high decks use low/mid stepping platforms. Four double-jump timings, steering toward actual landing center.'};
}
