import test from 'node:test';import assert from 'node:assert/strict';
import {freshSolo,normalizeSolo,loadSolo,saveSolo} from '../dist/src/campaign-profile.mjs';
import {tutorialRewardDraft} from '../dist/src/onboarding-state.mjs';
import {SHOP_OFFERS,prepareShopClaim,shopToday,normalizeShop} from '../dist/src/shop-state.mjs';
import {commitShopReward} from '../dist/src/shop-rewards.mjs';
import {earnedGold} from '../dist/src/gold-balance.mjs';
const store=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('new players begin the guide while pre-guide saves keep all wealth and bypass forced onboarding',()=>{
 const fresh=freshSolo();assert.equal(fresh.onboarding.step,'start');const old={...fresh,coins:1234};delete old.onboarding;const migrated=normalizeSolo(old);assert.equal(migrated.onboarding.step,'done');assert.equal(migrated.coins,1234);assert.equal(migrated.bag.length,2);
 const storage=store();fresh.onboarding.step='team';saveSolo(storage,fresh);assert.equal(loadSolo(storage).onboarding.step,'team');
});
test('tutorial completion prepares exactly 500 coins once and never mutates the uncommitted profile',()=>{
 const p=freshSolo();p.onboarding.step='battle';const first=tutorialRewardDraft(p);assert.equal(p.coins,300);assert.equal(first.coins,500);assert.equal(first.profile.coins,800);assert.equal(first.profile.onboarding.step,'reward');
 const next=normalizeSolo(first.profile);assert.equal(tutorialRewardDraft(next).coins,0);assert.equal(tutorialRewardDraft(next).profile.coins,800);
});
test('real completed ad receipts grant the chosen reward once and persist daily quota across reloads',()=>{
 for(const offer of SHOP_OFFERS.filter(o=>o.id!=='ticket')){const storage=store();saveSolo(storage,freshSolo());const result=commitShopReward(storage,offer.id,{completed:true,receipt:'verified-'+offer.id},{day:'2026-11-10'});assert.equal(result.shop.counts[offer.id],1);if(offer.type==='coins')assert.equal(result.coins,600);else assert.ok(result.bag.find(i=>i.type===offer.type));assert.throws(()=>commitShopReward(storage,offer.id,{completed:true,receipt:'verified-'+offer.id},{day:'2026-11-10'}),/已经领取/);assert.equal(loadSolo(storage).shop.counts[offer.id],1);}
});
test('unavailable, cancelled, replayed, failed saves and exceeded quota never add rewards',()=>{
 const p=freshSolo();for(const result of [{},{completed:false,receipt:'x'},{completed:true,receipt:''}]){const storage=store();saveSolo(storage,p);assert.throws(()=>commitShopReward(storage,'coins',result));assert.equal(loadSolo(storage).coins,300);}
 const full={...p,shop:{day:'2026-11-10',counts:{coins:3},receipts:['older']}};assert.throws(()=>prepareShopClaim(full,'coins','new',{completed:true,day:'2026-11-10'}),/领完/);assert.equal(shopToday(full,'2026-11-11').counts.coins,undefined);assert.throws(()=>prepareShopClaim(full,'coins','older',{completed:true,day:'2026-11-11'}),/已经领取/);
 const storage=store();saveSolo(storage,p);const failed={getItem:storage.getItem,setItem:()=>{throw Error('disk');}};assert.throws(()=>commitShopReward(failed,'coins',{completed:true,receipt:'verified'}),/未能保存/);assert.equal(loadSolo(storage).coins,300);
});
test('combat income is moderately reduced while fixed gifts and saved balances are unchanged',()=>{assert.equal(earnedGold(8),7);assert.equal(earnedGold(240),204);assert.equal(earnedGold(0),0);assert.equal(freshSolo().coins,300);assert.equal(tutorialRewardDraft(freshSolo()).coins,500);});

test('one gold chest starts at 300 coins and legacy gold quotas migrate once',()=>{
 assert.equal(SHOP_OFFERS.length,4);assert.equal(SHOP_OFFERS.filter(o=>o.type==='coins').length,1);assert.equal(SHOP_OFFERS.find(o=>o.id==='coins').count,300);assert.ok(!SHOP_OFFERS.some(o=>o.id==='treasure'));
 const old={day:'2026-11-10',counts:{coins:1,treasure:1},receipts:['old-receipt']},m=normalizeShop(old);assert.equal(m.counts.coins,2);assert.equal(normalizeShop(m).counts.coins,2);assert.deepEqual(m.receipts,['old-receipt']);assert.equal(normalizeShop({...old,counts:{coins:3,treasure:2}}).counts.coins,3);
});
