import {duelLoadout} from './duel-skill-data.mjs';
// Merge each click after the prior acknowledgement, including on slow LANs.
export function createDuelSelectionQueue(getRoom,action){let tail=Promise.resolve();return {
 choose(hero,key,id){const origin=getRoom(),epoch=origin?.epoch,seat=origin?.seat;tail=tail.catch(()=>{}).then(()=>{const r=getRoom(),slot=r?.slots?.[seat];if(r?.phase!=='selecting'||r.epoch!==epoch||r.seat!==seat||slot?.hero!==hero)return;return action({type:'loadout',loadout:{...duelLoadout(hero,slot.loadout),[key]:id}});});return tail;},
 idle(){return tail;}
};}
