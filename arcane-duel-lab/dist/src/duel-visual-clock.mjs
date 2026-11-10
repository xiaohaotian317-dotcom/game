import {projectileMotion,spendProjectileDistance} from './projectile-range.mjs';
// Between authoritative 20 Hz snapshots only advance presentation. Never step gameplay here.
export function renderDuelWorld(source,elapsed=0){
 const dt=Math.max(0,Math.min(.05,Number(elapsed)||0)),age=list=>(list||[]).map(v=>({...v,...(Number.isFinite(v.age)?{age:v.age+dt}:{})})),world={...source,time:source.time+dt,fxTime:(source.fxTime??source.time)+dt};
 world.player={...source.player};for(const key of ['cast','burst'])if(source.player?.[key])world.player[key]={...source.player[key],age:(source.player[key].age||0)+dt};
 world.constructs=age(source.constructs);world.effects=age(source.effects);world.fields=age(source.fields);world.trees=age(source.trees);world.ghosts=age(source.ghosts);world.texts=age(source.texts);
 world.projectiles=(source.projectiles||[]).map(p=>{const v={...p},motion=projectileMotion(v,dt),x=v.x,y=v.y;v.x=motion.x;v.y=motion.y;v.age=(p.age||0)+dt;spendProjectileDistance(v,x,y);return v;}).filter(p=>p.age<p.life&&(!p.rangeLimit||p.distanceTravelled<p.rangeLimit-1e-7));
 if(source.duelSkills)world.duelSkills={...source.duelSkills,fields:age(source.duelSkills.fields)};
 return world;
}
