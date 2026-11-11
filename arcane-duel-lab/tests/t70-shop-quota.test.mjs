import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,saveSolo,loadSolo} from '../dist/src/campaign-profile.mjs';
import {shopOffers,shopToday} from '../dist/src/shop-state.mjs';
import {commitShopReward} from '../dist/src/shop-rewards.mjs';

test('three basic ad rewards allow five verified claims without resetting earlier claims',()=>{
 for(const id of ['coins','experience','stone']){
  const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  const p=freshSolo();p.shop={day:'2026-11-11',counts:{[id]:3},receipts:['old-verified'],ticketAds:0};saveSolo(storage,p);
  assert.equal(shopOffers(loadSolo(storage)).find(o=>o.id===id).limit,5);
  assert.equal(shopToday(loadSolo(storage),'2026-11-11').counts[id],3);
  assert.throws(()=>commitShopReward(storage,id,{completed:true,receipt:'old-verified'},{day:'2026-11-11'}),/已经领取/);
  assert.throws(()=>commitShopReward(storage,id,{completed:false,receipt:'incomplete'},{day:'2026-11-11'}),/尚未完成/);
  for(const n of [4,5])assert.equal(commitShopReward(storage,id,{completed:true,receipt:id+'-'+n},{day:'2026-11-11'}).shop.counts[id],n);
  const saved=storage.getItem('arcane-solo-growth-v1');
  assert.throws(()=>commitShopReward(storage,id,{completed:true,receipt:id+'-6'},{day:'2026-11-11'}),/领完/);
  assert.equal(storage.getItem('arcane-solo-growth-v1'),saved);
  assert.equal(shopToday(loadSolo(storage),'2026-11-12').counts[id],undefined);
 }
});

test('ticket offer still needs two completed ads and allows only two tickets daily',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},p=freshSolo();saveSolo(storage,p);
 const offer=shopOffers(p).find(o=>o.id==='ticket');assert.equal(offer.limit,2);assert.equal(offer.adsRequired,2);
 for(let i=1;i<=4;i++){const next=commitShopReward(storage,'ticket',{completed:true,receipt:'ticket-'+i},{day:'2026-11-11'});assert.equal(next.tickets,Math.floor(i/2));}
 assert.throws(()=>commitShopReward(storage,'ticket',{completed:true,receipt:'ticket-5'},{day:'2026-11-11'}),/领完/);
});
