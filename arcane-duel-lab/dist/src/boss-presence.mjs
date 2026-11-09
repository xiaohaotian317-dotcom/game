// Feet remain fixed; emissive organs are painted into the full body atlas.
const kinds=new Set(['B12','B13','B14','B15','B16','B17','B18','B19','B20']);
export function bossBreathing(e,time){
 if(!kinds.has(e.appearanceKind||e.enemyKind)||e.hp<=0||e.ai?.attack)return {x:1,y:1};
 const b=Math.sin(time*2.4+Number((e.appearanceKind||e.enemyKind).slice(1)))*.012;
 return {x:1-b*.35,y:1+b};
}
