// World-unit flight-path budgets. No viewport dependence and no gameplay in the renderer.
export const PROJECTILE_RANGES=Object.freeze({basic:720,directional:960,minion:640});
const finitePositive=v=>Number.isFinite(v)&&v>0;
const rangedHeroes=new Set(['fireball','seed','iceNeedle','arc','starBolt','soloBolt','emberOrb','thunderFistBolt','shadowCrescent']);
export function ensureProjectileRange(s){
 if(s.petProjectile||s.petSource||s.rangeExempt||s.owner==='companion')return false;
 if(!finitePositive(s.rangeLimit)){
  const explicit=finitePositive(s.maxRange)?s.maxRange:finitePositive(s.range)?s.range:null;
  let limit=explicit;
  if(limit===null){
   if(s.basic){const oldShortRange=(s.hybridBasic||s.kind==='arc')&&finitePositive(s.life)?Math.hypot(s.vx||0,s.vy||0)*s.life:0;limit=oldShortRange||PROJECTILE_RANGES.basic;}
   else if(s.owner==='player'&&rangedHeroes.has(s.kind))limit=PROJECTILE_RANGES.directional;
   else if(s.enemyRangeLimited||s.enemyKind?.startsWith('M')||s.kind==='enemy'&&!s.enemySource)limit=PROJECTILE_RANGES.minion;
  }
  if(!finitePositive(limit))return false;
  s.rangeLimit=limit;s.distanceTravelled=Number.isFinite(s.distanceTravelled)?s.distanceTravelled:Math.max(0,s.age||0)*Math.hypot(s.vx||0,s.vy||0);
 }
 s.distanceTravelled=Math.max(0,Math.min(s.rangeLimit,Number(s.distanceTravelled)||0));return true;
}
export function projectileMotion(s,dt){
 const limited=ensureProjectileRange(s),time=limited?Math.max(0,Math.min(dt,(s.life??Infinity)-(s.age||0))):dt;
 let dx=(s.vx||0)*time,dy=(s.vy||0)*time;
 if(limited){const length=Math.hypot(dx,dy),remaining=Math.max(0,s.rangeLimit-s.distanceTravelled);if(length>remaining){const ratio=remaining/length;dx*=ratio;dy*=ratio;}}
 return {x:s.x+dx,y:s.y+dy};
}
export function spendProjectileDistance(s,x,y){
 if(!ensureProjectileRange(s))return false;
 const dx=s.x-x,dy=s.y-y,length=Math.hypot(dx,dy),remaining=Math.max(0,s.rangeLimit-s.distanceTravelled);
 if(length>remaining&&length>0){s.x=x+dx*remaining/length;s.y=y+dy*remaining/length;}
 s.distanceTravelled=Math.min(s.rangeLimit,s.distanceTravelled+Math.min(length,remaining));return s.distanceTravelled>=s.rangeLimit-1e-7;
}
export function expireProjectileRange(w,s){
 if(s.rangeDissipated)return;s.rangeDissipated=true;s.life=0;
 if(s.kind==='emberOrb'&&w.player.recast?.data?.projectileId===s.id)w.player.recast=null;
 w.effects.push({id:++w.serial,kind:'projectileDissipate',x:s.x,y:s.y,angle:Math.atan2(s.vy||0,s.vx||0),school:s.school||(s.fire?'fire':s.kind==='seed'?'nature':null),enemyStyle:s.enemyStyle,age:0,duration:.24});
}
const colors={fire:'#ffb16a',nature:'#c8e38e',frost:'#bceeff',lightning:'#ffe8a2',shadow:'#d0adff',star:'#d7c9ff',venom:'#c6e581',ice:'#bceeff',lava:'#ffb16a',root:'#c8e38e',feather:'#c9a6f1',chain:'#c7dae0'};
export function drawProjectileDissipate(c,e){
 if(e.kind!=='projectileDissipate')return false;
 const t=Math.max(0,Math.min(1,e.age/e.duration)),fade=1-t,color=colors[e.school||e.enemyStyle]||'#d9cbef';
 c.save();c.translate(e.x,e.y);c.rotate(e.angle||0);c.globalCompositeOperation='screen';c.globalAlpha*=fade*.85;c.strokeStyle=color;
 for(let i=0;i<6;i++){const side=i%2?1:-1,spread=(3+i*1.7)*(t+.2),x=-t*(9+i*2.1);c.lineWidth=(1.5-i*.13)*fade+.2;c.beginPath();c.moveTo(x+7*fade,side*spread);c.quadraticCurveTo(x-2,side*(spread+2),x-9*fade,side*spread);c.stroke();}
 c.fillStyle='#fff7e6';c.globalAlpha*=fade;c.beginPath();c.ellipse(0,0,Math.max(.1,4*fade),Math.max(.1,2*fade),0,0,Math.PI*2);c.fill();c.restore();return true;
}
