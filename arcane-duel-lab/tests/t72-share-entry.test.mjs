import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import {openGameShare} from '../dist/src/game-share.mjs';
import {loadSolo,freshSolo} from '../dist/src/campaign-profile.mjs';
import {SOLO_KEY} from '../dist/src/campaign-growth-data.mjs';
import * as duel from '../dist/src/duel-simulation.mjs';
const storage=()=>{const map=new Map([[SOLO_KEY,JSON.stringify(freshSolo())]]);return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('lobby sharing persists exactly 100 coins on first opening and refreshes the header once',async()=>{
 const s=storage();let opened=0,saved=[];const bridge={shareGame:async({requestId,text})=>{opened++;assert.match(text,/秘境决斗/);assert.doesNotMatch(text,/chatgpt.site/);return {opened:true,requestId};}};
 const options={storage:s,bridge,requestId:'lobby-first-share',onSave:p=>saved.push(p.coins)};
 assert.equal((await openGameShare(options)).rewarded,true);assert.equal(loadSolo(s).coins,400);
 assert.equal((await openGameShare({...options,requestId:'lobby-repeat-share'})).rewarded,false);assert.equal(loadSolo(s).coins,400);assert.equal(opened,2);assert.deepEqual(saved,[400]);
});
test('cancelled, failed or mismatched share openings never award currency',async()=>{
 for(const bridge of [{shareGame:async()=>{throw Object.assign(Error('cancel'),{name:'AbortError'});}},{shareGame:async()=>({opened:false})},{shareGame:async()=>({opened:true,requestId:'different-attempt'})}]){
  const s=storage();await assert.rejects(openGameShare({storage:s,bridge,requestId:'lobby-denied-share'}));assert.equal(loadSolo(s).coins,300);assert.deepEqual(loadSolo(s).operations.shareDays,[]);
 }
});
test('desktop text sharing requires a successfully opened panel and does not require sending',async()=>{
 const s=storage();const result=await openGameShare({storage:s,bridge:null,webShare:null,requestId:'desktop-open-share',openDesktop:(text,requestId)=>{assert.match(text,/六位英雄/);return {opened:true,requestId};}});assert.equal(result.rewarded,true);assert.equal(loadSolo(s).coins,400);
});
test('new native share handler is exposed on the lobby rather than duplicated in settings',async()=>{
 const [html,settings]=await Promise.all([fs.readFile(new URL('../dist/lobby.html',import.meta.url),'utf8'),fs.readFile(new URL('../dist/src/service-settings.mjs',import.meta.url),'utf8')]);assert.match(html,/id="share-open"/);assert.doesNotMatch(settings,/data-service-share/);
});
test('host worker reset preserves pause from certification/background until an explicit resume',async()=>{
 const source=(await fs.readFile(new URL('../dist/src/duel-worker.mjs',import.meta.url),'utf8')).replace(/^import[^\n]+\n/,'');let clock=0,interval,steps=0;
 const context={...duel,stepDuel:(...args)=>{steps++;return duel.stepDuel(...args);},performance:{now:()=>clock},Date:{now:()=>0},setInterval:fn=>{interval=fn;},postMessage:()=>{},onmessage:null};vm.createContext(context);vm.runInContext(source,context);
 context.onmessage({data:{kind:'reset',paused:true,heroes:['fire','frost'],scene:'moon',epoch:1,roundSerial:1,localStartAt:0}});clock=50;interval();assert.equal(steps,0);
 context.onmessage({data:{kind:'pause',value:false}});clock=100;interval();assert.ok(steps>0);
 const prior=steps;context.onmessage({data:{kind:'reset',paused:true,heroes:['fire','frost'],scene:'moon',epoch:1,roundSerial:2,localStartAt:0}});clock=150;interval();assert.equal(steps,prior);
});
