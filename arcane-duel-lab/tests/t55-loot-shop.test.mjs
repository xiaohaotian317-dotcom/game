import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,saveSolo,loadSolo} from '../dist/src/campaign-profile.mjs';
import {stageLoot,lootPreview,REPEAT_TICKET_CHANCE} from '../dist/src/campaign-growth-data.mjs';
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {commitShopReward} from '../dist/src/shop-rewards.mjs';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};

test('reduced story stones use matching preview and real drops without changing other loot or old stock',()=>{
 const p=freshSolo();p.bag.push({id:'existing-stones',type:'stoneHigh',count:19});
 for(const id of [...Array.from({length:20},(_,i)=>i+1),22]){
  const loot=stageLoot(id,()=>.6),stone=loot.find(i=>i.type.startsWith('stone'));
  assert.equal(stone.count,id>=12?3:id>=9?2:1);
  assert.equal(stone.type,id<=3?'stoneSmall':id<=8?'stoneMedium':'stoneHigh');
  assert.deepEqual(lootPreview(id).guaranteed,loot.filter(i=>i.type!=='equipment'));
  assert.equal(loot.find(i=>i.type.startsWith('chest')).count,id>=12?2:1);
 }
 assert.deepEqual(stageLoot(21),[]);
 assert.equal(p.bag.find(i=>i.id==='existing-stones').count,19);
});

function killBoss(id,roll,repeated){
 const p=freshSolo();if(repeated){p.cleared=[id];p.firstTickets=[id];}
 const w=createCampaign('fire',id,{profile:p,random:()=>roll,seed:123});
 w.campaign.triggers=[1e8,2e8,3e8,4e8];
 const boss=spawnEnemy(w,w.campaign.stage.boss,{x:900,y:w.floor});boss.hp=0;boss.killedByPlayer=true;
 stepCampaign(w,1/120,{});
 return w;
}
test('actual repeat boss tickets use a strict twenty-percent roll while the first ticket is guaranteed',()=>{
 assert.equal(REPEAT_TICKET_CHANCE,.2);
 for(const id of [1,11,12,20,22]){
  for(const roll of [0,.199999,.2,.499,.999]){
   const w=killBoss(id,roll,true),tickets=w.campaign.drops.filter(d=>d.item.type==='ticket');
   assert.equal(tickets.length,roll<.2?1:0,`${id} repeat roll ${roll}`);
   if(tickets.length)assert.equal(tickets[0].firstTicket,false);
   const before=w.campaign.drops.length;stepCampaign(w,1/120,{});assert.equal(w.campaign.drops.length,before,'same boss cannot award twice');
  }
  assert.equal(killBoss(id,.999,false).campaign.drops.filter(d=>d.item.type==='ticket'&&d.firstTicket).length,1);
 }
});

test('shop objectives increment only with a saved real completion, once per receipt',()=>{
 for(const [id,metric] of [['coins','shopCoins'],['stone','shopStone'],['experience','shopExperience']]){
  const store=storage();saveSolo(store,freshSolo());
  const p=commitShopReward(store,id,{completed:true,receipt:'t55-shop-'+id});
  assert.equal(p.daily.progress[metric],1);assert.equal(loadSolo(store).daily.progress[metric],1);
  assert.throws(()=>commitShopReward(store,id,{completed:true,receipt:'t55-shop-'+id}));
  assert.throws(()=>commitShopReward(store,id,{completed:false,receipt:'cancelled'}));
  assert.equal(loadSolo(store).daily.progress[metric],1);
  const failure={getItem:store.getItem,setItem:()=>{throw Error('disk full');}};
  assert.throws(()=>commitShopReward(failure,id,{completed:true,receipt:'save-failure'}),/未能保存/);
  assert.equal(loadSolo(store).daily.progress[metric],1);
 }
});

test('shop tickets require two separate completed ads per ticket, save partial progress, and cap at two each day',()=>{
 const store=storage();saveSolo(store,freshSolo());
 const a=commitShopReward(store,'ticket',{completed:true,receipt:'ticket-first'});
 assert.equal(a.tickets,0);assert.equal(a.shop.ticketAds,1);assert.equal(a.shop.counts.ticket||0,0);assert.equal(a.daily.progress.shopTicket,0);
 assert.equal(loadSolo(store).shop.ticketAds,1);
 assert.throws(()=>commitShopReward(store,'ticket',{completed:true,receipt:'ticket-first'}));
 assert.throws(()=>commitShopReward(store,'ticket',{completed:false,receipt:'ticket-cancelled'}));
 const failure={getItem:store.getItem,setItem:()=>{throw Error('disk');}};
 assert.throws(()=>commitShopReward(failure,'ticket',{completed:true,receipt:'ticket-second'}),/未能保存/);
 assert.equal(loadSolo(store).tickets,0);assert.equal(loadSolo(store).shop.ticketAds,1);
 const b=commitShopReward(store,'ticket',{completed:true,receipt:'ticket-second'});
 assert.equal(b.tickets,1);assert.equal(b.shop.ticketAds,0);assert.equal(b.shop.counts.ticket,1);assert.equal(b.daily.progress.shopTicket,1);
 commitShopReward(store,'ticket',{completed:true,receipt:'ticket-third'});
 const c=commitShopReward(store,'ticket',{completed:true,receipt:'ticket-fourth'});
 assert.equal(c.tickets,2);assert.equal(c.shop.counts.ticket,2);assert.equal(c.daily.progress.shopTicket,2);
 assert.throws(()=>commitShopReward(store,'ticket',{completed:true,receipt:'ticket-fifth'}),/领完/);
 assert.equal(loadSolo(store).tickets,2);
});

test('a new local day resets unfinished ticket-ad progress and quota but not past receipts or owned tickets',()=>{
 const store=storage();saveSolo(store,freshSolo());
 commitShopReward(store,'ticket',{completed:true,receipt:'yesterday-first'},{day:'2026-11-10'});
 const next=commitShopReward(store,'ticket',{completed:true,receipt:'today-first'},{day:'2026-11-11'});
 assert.equal(next.tickets,0);assert.equal(next.shop.ticketAds,1);
 assert.throws(()=>commitShopReward(store,'ticket',{completed:true,receipt:'yesterday-first'},{day:'2026-11-11'}));
 const done=commitShopReward(store,'ticket',{completed:true,receipt:'today-second'},{day:'2026-11-11'});
 assert.equal(done.tickets,1);assert.equal(done.shop.counts.ticket,1);
});
