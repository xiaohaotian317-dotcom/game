import {SOLO_KILL_XP} from './campaign-growth-data.mjs';
export function runRewards(c){return c.rewards??={coins:0,xp:{},items:[]};}
export function recordRunKill(c,hero,coins=6,xp=SOLO_KILL_XP){const r=runRewards(c);r.coins+=coins;r.xp[hero]=(r.xp[hero]||0)+xp;}
export function recordRunItem(c,item){const r=runRewards(c),key=JSON.stringify([item.type,item.slot,item.role,item.quality,item.stage,item.rank,item.level,item.collection,item.setTier]),old=r.items.find(i=>i.key===key);if(old)old.count+=item.count||1;else r.items.push({...item,key,count:item.count||1});}
