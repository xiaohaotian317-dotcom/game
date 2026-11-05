import {duelChosenSkill} from './duel-skill-data.mjs';
import {releaseAlternate,tickAlternateFields,alternateOnHit} from './alternate-skills.mjs';
export function duelSkillSpec(w,key,base){if(!w.duelSkills||key==='attack')return base;const s=duelChosenSkill(w.hero,key,w.duelSkills.loadout);if(!s)return base;
 return {...base,name:s.name,duelSkill:s,...(s.column?{duration:s.row===2?.9:.55,release:s.row===2?.4:.2,cd:s.cd}: {})};
}
export function recordDuelCast(w,cast){if(!w.duelSkills||!cast.duelSkill)return;const map=w.duelSkills.castSkills;map[cast.id]=cast.duelSkill.id;const keys=Object.keys(map);for(const k of keys.slice(0,Math.max(0,keys.length-128)))delete map[k];}
export function releaseDuelSkill(w,cast,api){return !!w.duelSkills&&!!cast.duelSkill?.column&&releaseAlternate(w,cast,api,{fields:w.duelSkills.fields,rank:0});}
export function duelSkillOnHit(w,t,castId,source,api){const state=w.duelSkills;if(!state)return;const id=state.castSkills[castId],key=id?.split('-')[1],s=key===undefined?null:duelChosenSkill(w.hero,['q','e','r'][Number(key)],state.loadout);if(s?.id===id)alternateOnHit(w,t,s,castId,source,state,api);}
export function stepDuelSkills(w,api){if(w.duelSkills)w.duelSkills.fields=tickAlternateFields(w,w.duelSkills.fields,api);}
