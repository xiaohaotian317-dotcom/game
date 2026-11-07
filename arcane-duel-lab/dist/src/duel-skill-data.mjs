import {SOLO_HEROES,SOLO_SKILLS,skillById} from './campaign-growth-data.mjs';
export const DUEL_RULESET='duel-skill6-v3';
export const DUEL_SKILL_KEYS=Object.freeze(['q','e','r']);
export function defaultDuelLoadout(hero){if(!SOLO_HEROES.includes(hero))throw Error('未知英雄');return Object.fromEntries(DUEL_SKILL_KEYS.map((key,row)=>[key,`${hero}-${row}-0`]));}
export function validateDuelLoadout(hero,input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length!==3||DUEL_SKILL_KEYS.some(k=>!Object.hasOwn(input,k)))throw Error('请在F、E、R每行各选择一个技能');
 const result={};for(const key of DUEL_SKILL_KEYS){const s=skillById(input[key]);if(!s||s.hero!==hero||s.key!==key)throw Error('技能必须属于当前英雄，并放入对应的F、E、R格');result[key]=s.id;}return result;
}
export function duelLoadout(hero,value){return value===undefined?defaultDuelLoadout(hero):validateDuelLoadout(hero,value);}
export function duelChosenSkill(hero,key,value){if(!DUEL_SKILL_KEYS.includes(key))return null;return skillById(duelLoadout(hero,value)[key]);}
export const duelSkillChoices=hero=>SOLO_SKILLS[hero]||[];
export function duelSelectionKey(slots){return slots.map(s=>s?s.hero+':'+Object.values(duelLoadout(s.hero,s.loadout)).join(','):'empty').join('|');}

export function duelSnapshotMatches(snapshot,slots){try{return Array.isArray(snapshot?.worlds)&&snapshot.worlds.length===2&&(!snapshot.ruleset||snapshot.ruleset===DUEL_RULESET)&&slots.every((s,i)=>snapshot.worlds[i].hero===s.hero&&JSON.stringify(duelLoadout(s.hero,snapshot.worlds[i].duelSkills?.loadout))===JSON.stringify(duelLoadout(s.hero,s.loadout)));}catch{return false;}}
