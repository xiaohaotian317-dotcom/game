const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Targeted spells choose the first standing surface BELOW the cursor. Upper
// decks are deliberately ignored; basic-attack collision is handled separately.
export function groundTarget(w,x,y){
  x=clamp(x,0,w.width||1440);
  const column=w.platforms.filter(b=>b.active&&x>=b.x&&x<=b.x+b.w);
  let b=column.filter(b=>b.y>=y-.01).sort((a,b)=>a.y-b.y)[0];
  // A click below the arena floor still belongs to that floor, never to mid-air.
  if(!b)b=column.find(b=>b.id==='ground');
  return b?{x,y:b.y,platformId:b.id,offsetX:x-b.x,clickY:y}:null;
}
export function resolveGroundTarget(w,target){
  if(!target)return null;
  const b=w.platforms.find(b=>b.id===target.platformId&&b.active);
  return b?{...target,x:b.x+target.offsetX,y:b.y}:groundTarget(w,target.x,target.y+.1);
}
// Both the preview and the actual dive resolve to the enemy's front support.
export function lightningLandingTarget(w,cast,target){
 if(!target)return null;
 const p=w.player,enemy=w.targets.filter(t=>t.hp>0&&Math.abs(t.x-p.x)<560&&Math.hypot(t.x-cast.x,t.y-40-cast.y)<155).sort((a,b)=>Math.hypot(a.x-cast.x,a.y-40-cast.y)-Math.hypot(b.x-cast.x,b.y-40-cast.y))[0];
 const face=Math.sign((enemy?.x??target.x)-p.x)||p.face;
 const landing=enemy?(groundTarget(w,clamp(enemy.x-face*54,25,w.width-25),enemy.y-.1)||target):target;
 return {...landing,face};
}
