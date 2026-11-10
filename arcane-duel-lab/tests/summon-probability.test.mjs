import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,normalizeSolo,summonSolo} from '../dist/src/campaign-profile.mjs';
import {SUMMON_GUARANTEE,SUMMON_PROBABILITY_TIERS,summonProbabilityForDraw,summonProbabilityRules} from '../dist/src/summon-probability.mjs';

test('target hero odds use the next draw number and the promised four segments',()=>{
 assert.equal(SUMMON_GUARANTEE,20);
 assert.deepEqual(Array.from({length:20},(_,i)=>summonProbabilityForDraw(i+1)),[...Array(10).fill(.01),...Array(5).fill(.05),...Array(4).fill(.1),1]);
 for(const n of [0,-1,21,1.5,'1',NaN,Infinity])assert.throws(()=>summonProbabilityForDraw(n),RangeError);
 assert.ok(Object.isFrozen(SUMMON_PROBABILITY_TIERS));assert.ok(SUMMON_PROBABILITY_TIERS.every(Object.isFrozen));
});
test('actual summon at every segment edge succeeds strictly below the configured probability',()=>{
 for(const n of [1,10,11,15,16,19]){
  const chance=summonProbabilityForDraw(n),hit=freshSolo();hit.tickets=1;hit.pity.frost=n-1;
  assert.equal(summonSolo(hit,'frost',1,()=>chance-1e-6)[0].hero,'frost','success at draw '+n);assert.equal(hit.tickets,0);assert.equal(hit.pity.frost,0);
  const miss=freshSolo();miss.tickets=1;miss.pity.frost=n-1;let calls=0;
  const result=summonSolo(miss,'frost',1,()=>++calls===1?chance:.99);
  assert.equal(result[0].hero,undefined,'exact probability threshold misses at draw '+n);assert.equal(result[0].type,'chestSmall');assert.equal(miss.pity.frost,n);assert.equal(miss.tickets,0);
 }
});
test('all nineteen misses persist and the twentieth draw guarantees the selected hero without extra spending',()=>{
 let p=freshSolo();p.tickets=30;p.pity.nature=7;
 for(let n=1;n<=19;n++){assert.equal(summonSolo(p,'frost',1,()=>.99)[0].hero,undefined);assert.equal(p.pity.frost,n);p=normalizeSolo(JSON.parse(JSON.stringify(p)));}
 const coins=p.coins,results=summonSolo(p,'frost',10,()=>1);
 assert.deepEqual(results.map(v=>v.hero),['frost']);assert.equal(p.tickets,10);assert.equal(p.coins,coins);assert.equal(p.pity.frost,0);assert.equal(p.pity.nature,7);assert.ok(p.owned.includes('frost'));
});
test('ten-draw crosses the low to middle segment using each successive pity count and stops on acquisition',()=>{
 const p=freshSolo();p.tickets=20;p.pity.shadow=8;p.pity.star=15;
 let calls=0;const result=summonSolo(p,'shadow',10,()=>{calls++;return calls%2===1?.02:.99;});
 assert.equal(result.length,3);assert.equal(result[2].hero,'shadow');assert.equal(p.tickets,17);assert.equal(p.pity.shadow,0);assert.equal(p.pity.star,15);
 const before=structuredClone(p);assert.throws(()=>summonSolo(p,'shadow',1));assert.deepEqual(p,before);
});
test('switching pools and normalizing cannot borrow a different pool higher chance',()=>{
 let p=freshSolo();p.tickets=30;p.pity.nature=10;p.pity.shadow=15;
 assert.equal(summonSolo(p,'frost',1,()=>.03)[0].hero,undefined);assert.equal(p.pity.frost,1);
 p=normalizeSolo(JSON.parse(JSON.stringify(p)));
 assert.equal(summonSolo(p,'nature',1,()=>.03)[0].hero,'nature');assert.equal(summonSolo(p,'shadow',1,()=>.07)[0].hero,'shadow');assert.equal(p.pity.frost,1);assert.equal(p.tickets,27);
});
test('player-facing probability rules are generated from the same draw segments',()=>{
 assert.equal(summonProbabilityRules(),'第1～10抽1%；第11～15抽5%；第16～19抽10%；第20抽100%，必得当前目标英雄。');
});
