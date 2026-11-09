// Between authoritative 20 Hz snapshots only advance presentation. Never step gameplay here.
export function renderDuelWorld(source,elapsed=0){
 const dt=Math.max(0,Math.min(.05,Number(elapsed)||0)),age=list=>(list||[]).map(v=>({...v,...(Number.isFinite(v.age)?{age:v.age+dt}:{})})),world={...source,time:source.time+dt,fxTime:(source.fxTime??source.time)+dt};
 world.player={...source.player};for(const key of ['cast','burst'])if(source.player?.[key])world.player[key]={...source.player[key],age:(source.player[key].age||0)+dt};
 world.constructs=age(source.constructs);world.effects=age(source.effects);world.fields=age(source.fields);world.trees=age(source.trees);world.ghosts=age(source.ghosts);world.texts=age(source.texts);
 world.projectiles=age(source.projectiles).map(v=>({...v,x:v.x+(v.vx||0)*dt,y:v.y+(v.vy||0)*dt}));
 if(source.duelSkills)world.duelSkills={...source.duelSkills,fields:age(source.duelSkills.fields)};
 return world;
}
