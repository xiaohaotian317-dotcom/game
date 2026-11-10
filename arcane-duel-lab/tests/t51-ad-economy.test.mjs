import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,loadSolo,saveSolo} from '../dist/src/campaign-profile.mjs';
import {adGoldTier,shopOffers} from '../dist/src/shop-state.mjs';
import {commitShopReward} from '../dist/src/shop-rewards.mjs';
import {endlessDifficulty} from '../dist/src/campaign-challenges.mjs';
test('the one gold offer increases only after each specified main-story milestone',()=>{
 const p=freshSolo();assert.equal(adGoldTier(p).coins,300);
 for(const [cleared,coins] of [[[1,2,3,4],300],[[5],400],[[10],500],[[14],300],[[15],650],[[19],800],[[21,22,23],300]]){p.cleared=cleared;const offers=shopOffers(p);assert.equal(offers.filter(o=>o.type==='coins').length,1);assert.equal(offers.find(o=>o.id==='coins').count,coins);assert.match(offers.find(o=>o.id==='coins').copy,new RegExp(String(coins)));}
});
test('the verified receipt grants the same displayed progression tier once, with original quota intact',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
 const p=freshSolo();p.cleared=[5,10,15,19];saveSolo(storage,p);
 const next=commitShopReward(storage,'coins',{completed:true,receipt:'t51-tiered-verified'},{day:'2026-11-10'});
 assert.equal(next.coins,1100);assert.equal(next.shop.counts.coins,1);
 assert.throws(()=>commitShopReward(storage,'coins',{completed:true,receipt:'t51-tiered-verified'},{day:'2026-11-10'}));assert.equal(loadSolo(storage).coins,1100);
});
test('endless gold is reduced twenty percent at every round while XP and difficulty stay unchanged',()=>{
 for(const round of [1,2,5,10,20]){const s=endlessDifficulty(round);assert.equal(s.killCoins,Math.round((12+s.level*4+round*6)*.8));assert.equal(s.bossCoins,Math.round((140+s.level*35+round*80)*.8));assert.ok(Number.isInteger(s.killCoins)&&s.killCoins>0);}
 assert.equal(endlessDifficulty(1).killXp,52);assert.equal(endlessDifficulty(1).bossXp,510);assert.equal(endlessDifficulty(4).level,15);
});
