import test from 'node:test';
import assert from 'node:assert/strict';
import {towerFloor} from '../dist/src/tower-data.mjs';
import {TOWER_RULES,normalizeTower} from '../dist/src/tower-state.mjs';
import {renderTowerResult} from '../dist/src/campaign-result-ui.mjs';

test('tower starts stronger and every floor requires a boss while bounded enemy counts leave room to dodge',()=>{
 assert.equal(TOWER_RULES.bossEvery,1);
 assert(towerFloor(1).minionHp>32);
 assert(towerFloor(1).damageFactor>.65);
 for(const floor of [1,2,5,10,20,40,70,10000]){
  const stage=towerFloor(floor);
  assert.match(stage.boss,/^B\d{2}$/);
  assert(stage.towerCount>=6&&stage.towerCount<=12);
  assert(stage.attackBudget>=2&&stage.attackBudget<=6);
  assert.equal(stage.environmentHazards,false);
 }
});

test('tower HP and damage increments grow progressively through the supported range',()=>{
 let previous=towerFloor(1),previousDelta=null;
 for(let floor=2;floor<=TOWER_RULES.maxFloor;floor++){
  const next=towerFloor(floor),delta={};
  for(const key of ['minionHp','bossHp','damageFactor','bossDamageFactor']){
   assert(Number.isFinite(next[key])&&next[key]>previous[key],`${key} grows at ${floor}`);
   delta[key]=next[key]-previous[key];
   if(previousDelta)assert(delta[key]+1e-6>=previousDelta[key],`${key} increment accelerates at ${floor}`);
  }
  assert(Number.isSafeInteger(next.minionHp)&&Number.isSafeInteger(next.bossHp));
  previous=next;previousDelta=delta;
 }
});

test('changing floor rules preserves old completed records and depleted run resources',()=>{
 const before={allTimeBest:19,weekly:{'2026-11-09':{best:19,runId:'old-tower-record',finishedAt:123}},active:{id:'old-tower-record',week:'2026-11-09',team:['fire','frost'],completed:7,state:'intermission',vitals:{fire:{hp:42,mp:6},frost:{hp:0,mp:0}}}};
 const after=normalizeTower(before);
 assert.equal(after.allTimeBest,19);
 assert.equal(after.weekly['2026-11-09'].best,19);
 assert.equal(after.active.floor,8);
 assert.equal(after.active.completed,7);
 assert.deepEqual(after.active.vitals,before.active.vitals);
});

test('tower result exposes whole floor numbers separately from labels, with no fictional reward claim',()=>{
 const el={innerHTML:''};renderTowerResult(el,{completed:70,weekBest:100});
 assert.match(el.innerHTML,/data-tower-stat="completed">70<small>层<\/small>/);
 assert.match(el.innerHTML,/data-tower-stat="weekly">100<small>层<\/small>/);
 assert.doesNotMatch(el.innerHTML,/筹备中|金币|领取/);
 renderTowerResult(el,{completed:'<img>',weekBest:10001});
 assert.doesNotMatch(el.innerHTML,/<img>/);
 assert.match(el.innerHTML,/data-tower-stat="completed">0<small>/);
 assert.match(el.innerHTML,/data-tower-stat="weekly">10000<small>/);
});
