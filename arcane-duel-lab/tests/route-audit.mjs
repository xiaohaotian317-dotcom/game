import {createWorld,step,STEP} from '../dist/src/simulation.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function findJump(hero,scene,from,to,{brokenBridge=false,noVine=false}={}){
  if(from.y-to.y>282)return null;
  const fromLeft=from.x+22,fromRight=from.x+from.w-22,goal=to.x+to.w/2;
  const starts=[clamp(goal,fromLeft,fromRight),fromLeft,fromRight,(fromLeft+fromRight)/2];
  for(const startX of starts)for(const delay of [null,.22,.31,.39,.46]){
    const w=createWorld(hero,scene);w.targets=[];w.mechanisms={cooldown:0,flash:0};w.spring.enabled=false;
    if(brokenBridge)w.platforms.find(p=>p.id==='bridge').active=false;
    if(noVine){const b=w.platforms.find(p=>p.id==='vine');if(b)b.active=false;}
    const p=w.player;Object.assign(p,{x:startX,prevX:startX,y:from.y,prevY:from.y,platformId:from.id,vx:0,vy:0,grounded:true,jumps:0});
    let second=false;
    for(let frame=0;frame<220;frame++){
      const time=frame*STEP,dx=goal-p.x,move=Math.abs(dx)<12?0:Math.sign(dx);
      const jump=frame===0||(!second&&delay!==null&&time>=delay&&!p.grounded);
      if(frame>0&&jump)second=true;
      step(w,STEP,{move,jump});
      if(frame>12&&p.grounded&&p.platformId!==from.id){
        if(p.platformId===to.id)return{from:from.id,to:to.id,startX:Math.round(startX),secondJumpAt:delay,landingX:Math.round(p.x),seconds:Number(time.toFixed(2))};
        break;
      }
      if(p.y>from.y+220)break;
    }
  }
  return null;
}
export function auditRoutes(hero,scene,options={}){
  const w=createWorld(hero,scene),platforms=w.platforms.filter(p=>p.x>=0&&p.active&&!(options.brokenBridge&&p.id==='bridge')&&!(options.noVine&&p.id==='vine'));
  const start=platforms.find(p=>p.id===w.player.platformId),reached=new Set([start.id]),routes=[],queue=[start];
  while(queue.length){const from=queue.shift();for(const to of platforms){if(reached.has(to.id))continue;const route=findJump(hero,scene,from,to,options);if(route){reached.add(to.id);routes.push(route);queue.push(to);}}}
  return {hero,scene,options,reachable:[...reached],unreachable:platforms.filter(p=>!reached.has(p.id)).map(p=>p.id),routes};
}
