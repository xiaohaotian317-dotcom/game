import test from 'node:test';
import assert from 'node:assert/strict';
import {readTowerLeaderboard,towerEndedPeriods} from '../dist/src/tower-provider.mjs';

test('weekly UI selects only explicit historical periods from a connected service',()=>{
 const result={connected:true,currentPeriodToken:'opaque-current',availablePeriods:[{token:'opaque-current',label:'本周',isCurrent:true},{token:'old',label:'上周',isCurrent:false},{token:'old',label:'重复',isCurrent:false},{token:'unknown',isCurrent:true},{token:'unmarked'},{token:'bad\n',isCurrent:false}]};
 assert.deepEqual(towerEndedPeriods(result),[{token:'old',label:'上周'}]);
 assert.deepEqual(towerEndedPeriods({...result,connected:false}),[]);
 assert.deepEqual(towerEndedPeriods({...result,currentPeriodToken:null}),[]);
});

test('read-only board forwards server history and personal score without constructing a local period',async()=>{
 const previous=globalThis.arcaneTowerProvider;let args;
 const response={available:true,period:{token:'now',label:'服务当前周',isCurrent:true},currentPeriodToken:'now',availablePeriods:[{token:'past',label:'服务过去周',isCurrent:false}],accountId:'tap:test-account',myEntry:{rank:5,floor:7},entries:[{rank:1,floor:21,name:'旅者'},{rank:0,floor:999,name:'错误名次'},{rank:51,floor:2,name:'范围外'}]};
 globalThis.arcaneTowerProvider={status:async()=>({available:true,loggedIn:true}),getLeaderboard:async value=>{args=value;return response;}};
 try{const result=await readTowerLeaderboard();assert.deepEqual(args,{limit:50});assert.equal(result.currentPeriodToken,'now');assert.deepEqual(result.availablePeriods,response.availablePeriods);assert.deepEqual(result.myEntry,response.myEntry);assert.equal(result.accountId,response.accountId);assert.equal(result.entries.length,1);assert.equal(result.entries[0].displayName,'旅者');assert.deepEqual(towerEndedPeriods(result),[{token:'past',label:'服务过去周'}]);}
 finally{if(previous===undefined)delete globalThis.arcaneTowerProvider;else globalThis.arcaneTowerProvider=previous;}
});

test('failed service connection cannot leave historical claims available',async()=>{
 const previous=globalThis.arcaneTowerProvider;
 globalThis.arcaneTowerProvider={status:async()=>({available:true}),getLeaderboard:async()=>({available:false,reason:'loginRequired',availablePeriods:[{token:'past',isCurrent:false}]})};
 try{const result=await readTowerLeaderboard();assert.equal(result.connected,false);assert.deepEqual(result.availablePeriods,[]);assert.deepEqual(towerEndedPeriods(result),[]);}
 finally{if(previous===undefined)delete globalThis.arcaneTowerProvider;else globalThis.arcaneTowerProvider=previous;}
});
