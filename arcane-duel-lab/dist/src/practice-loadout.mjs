import {defaultDuelLoadout,validateDuelLoadout} from './duel-skill-data.mjs';
export function practiceLoadout(hero,params){try{return validateDuelLoadout(hero,{q:params.get('f'),e:params.get('e'),r:params.get('r')});}catch{return defaultDuelLoadout(hero);}}
export function applyPracticeLoadout(world,loadout){world.duelSkills={loadout:validateDuelLoadout(world.hero,loadout),fields:[],castSkills:{},chained:[]};return world;}
export function practiceURL(hero,loadout=defaultDuelLoadout(hero),scene='moon'){const s=validateDuelLoadout(hero,loadout);return 'index.html?'+new URLSearchParams({play:'1',trial:'1',hero,scene:['moon','lava','garden'].includes(scene)?scene:'moon',f:s.q,e:s.e,r:s.r,build:'campaign15'});}
