import {enterEndless,normalizeChallenges} from './campaign-challenges.mjs';
import {loadSolo,saveSolo} from './campaign-profile.mjs';
export async function commitEndlessEntry(storage,profile,{now=Date.now(),locks=globalThis.navigator?.locks}={}){
 const commit=()=>{const latest=loadSolo(storage);enterEndless(latest,now);if(!saveSolo(storage,latest))throw Error('无法保存挑战时间，请检查存档后重试');profile.challenges=normalizeChallenges(latest.challenges);return profile.challenges;};
 // Reading latest storage inside one shared browser lock stops two windows entering at once.
 return locks?.request?locks.request('arcane-endless-entry',commit):commit();
}
