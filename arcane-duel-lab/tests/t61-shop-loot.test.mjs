import test from 'node:test';import assert from 'node:assert/strict';
import {freshSolo,saveSolo,loadSolo,addItem,normalizeSolo} from '../dist/src/campaign-profile.mjs';
import {GOLD_SHOP_OFFERS} from '../dist/src/shop-state.mjs';
import {prepareShopPurchase,commitShopPurchase} from '../dist/src/shop-purchases.mjs';
import {createCampaign,beginEncounter,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {damage,STEP} from '../dist/src/simulation.mjs';
import {petDungeonBonusLoot,stageLoot,PET_SKILL_STONE_DROP_CHANCE} from '../dist/src/campaign-growth-data.mjs';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const store=()=>{const map=new Map();return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v)};};
test('gold shop sells only the specified materials and small/medium pet XP, exact prices and no advert transaction',()=>{
 assert.deepEqual(GOLD_SHOP_OFFERS.map(o=>[o.type,o.price]),[['stoneSmall',500],['stoneMedium',1200],['petXpSmall',200],['petXpMedium',450],['petSkillStone',3000]]);
 for(const offer of GOLD_SHOP_OFFERS){const storage=store(),p=freshSolo();p.coins=10000;saveSolo(storage,p);const before=loadSolo(storage),result=commitShopPurchase(storage,offer.id),saved=loadSolo(storage);
  assert.equal(result.offer.price,offer.price);assert.equal(saved.coins,10000-offer.price);assert.equal(saved.bag.find(i=>i.type===offer.type).count,1);
  assert.deepEqual(saved.shop,before.shop);assert.deepEqual(saved.daily,before.daily);assert.equal(saved.tickets,0);
 }
});
test('purchase fails without spending or granting for missing coins, invalid item, full stack or a save failure',()=>{
 const p=freshSolo(),before=structuredClone(p);assert.throws(()=>prepareShopPurchase(p,'buyPetSkillStone'),/不足/);assert.throws(()=>prepareShopPurchase(p,'invalid'),/不可/);assert.deepEqual(p,before);
 const s=store();p.coins=3000;saveSolo(s,p);const raw=s.getItem('arcane-solo-growth-v1');const broken={getItem:s.getItem,setItem(){throw Error('full');}};assert.throws(()=>commitShopPurchase(broken,'buyPetSkillStone'),/保存/);assert.equal(s.getItem('arcane-solo-growth-v1'),raw);
 addItem(p,{type:'petSkillStone',count:9999});assert.throws(()=>prepareShopPurchase(p,'buyPetSkillStone'),/上限/);
});
test('skill stone is rare and one per pet-boss kill only, regular story/endless/tower never produce it',()=>{
 assert.equal(PET_SKILL_STONE_DROP_CHANCE,.08);assert.deepEqual(petDungeonBonusLoot(true,()=>.079),[{type:'petSkillStone',count:1}]);assert.deepEqual(petDungeonBonusLoot(true,()=>.08),[]);assert.deepEqual(petDungeonBonusLoot(false,()=>0),[]);
 for(let id=1;id<=22;id++)assert(!stageLoot(id,()=>0).some(i=>i.type==='petSkillStone'));
 for(const id of [5,9,14,17])for(const [petDungeon,roll,expected] of [[true,.079,1],[true,.08,0],[false,0,0]]){
  const p=freshSolo();p.cleared=[4,id];addItem(p,{type:'mirror'});
  const w=createCampaign('fire',id,{profile:p,petDungeon,random:()=>roll});w.campaign.encounter=3;beginEncounter(w);
  damage(w,w.targets.find(t=>t.id===w.campaign.bossId),1e9,{source:'artifact'});stepCampaign(w,STEP);
  assert.equal(w.campaign.drops.filter(d=>d.item.type==='petSkillStone').length,expected);
  stepCampaign(w,STEP);assert.equal(w.campaign.drops.filter(d=>d.item.type==='petSkillStone').length,expected,'reward only once');
 }
 const p=freshSolo();addItem(p,{type:'petSkillStone',count:4});assert.equal(normalizeSolo(p).bag.find(i=>i.type==='petSkillStone').count,4);
});
test('new stone is the untouched original with transparent drop rect and foot pivot, not an old generic material icon',()=>{
 const asset=readFileSync(new URL('../dist/assets/items/pet-skill-stone-v1.png',import.meta.url)),meta=JSON.parse(readFileSync(new URL('../dist/assets/world-drops/drop-meta-v1.json',import.meta.url))),source=readFileSync(new URL('../../美术概念/协作交付/T61/skillstone_art/pet-skill-stone-v1.png',import.meta.url));
 assert.equal(createHash('sha256').update(asset).digest('hex'),'e04d45fe36a842423deab3377285caf899d6664974edf478baf62dc0e195cbf5');assert.deepEqual(asset,source);
 assert.deepEqual(meta.items.petSkillStone.rect,[188,18,861,1211]);assert.deepEqual(meta.items.petSkillStone.anchor,[361,1206]);assert.equal(meta.sheets.petSkillStone.folder,'items');
});
