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
