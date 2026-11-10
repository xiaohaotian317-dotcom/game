import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP} from '../dist/src/simulation.mjs';
import {InputInbox,safeInput} from '../dist/src/duel-simulation.mjs';
import {controlOpacity,saveControlOpacity} from '../dist/src/mobile-preferences.mjs';

test('six mobile heroes turn before attacking and keep the accepted aim until release',()=>{
  for(const hero of ['fire','nature','frost','lightning','shadow','star']){
    const w=createWorld(hero);w.player.x=700;w.player.face=1;w.targets=[];
    step(w,STEP,{touchAim:true,attack:true,move:1,aim:{x:300,y:630}});
    assert.equal(w.player.face,-1,hero);assert.equal(w.player.cast.touchAim,true,hero);
    for(let i=0;i<26;i++)step(w,STEP,{touchAim:true,move:1,aim:{x:1100,y:630}});
    const shot=w.projectiles.find(p=>p.owner==='player');
    assert.ok(shot,hero);assert.ok(shot.vx<0,hero+' shot must leave the forward hand');
    assert.equal(w.player.face,-1,hero+' cannot turn its back during attack');
    for(let i=0;i<60;i++)step(w,STEP,{touchAim:true,move:1,aim:{x:1100,y:630}});
    assert.equal(w.player.face,1,hero+' resumes stick movement after recovery');
  }
});

test('mobile directional skill cannot change into a backwards shot during its windup',()=>{
  const w=createWorld('fire');w.player.x=700;w.player.face=1;w.targets=[];
  step(w,STEP,{touchAim:true,cast:'e',move:1,aim:{x:300,y:630}});
  for(let i=0;i<14;i++)step(w,STEP,{touchAim:true,move:1,aim:{x:1100,y:630}});
  assert.ok(w.projectiles.find(p=>p.kind==='emberOrb').vx<0);
  assert.ok(w.player.x<701,'a short casting step prevents sliding through the turn');
});

test('authority input preserves mobile mode while desktop remains opt-out',()=>{
  assert.equal(safeInput({}).touchAim,false);
  const inbox=new InputInbox();inbox.receive({seq:1,input:{touchAim:true,move:1,aim:{x:900,y:600}},actions:[{id:1,type:'e',aim:{x:300,y:600}}]},0);
  const input=inbox.consume(.01);assert.equal(input.touchAim,true);assert.equal(input.aim.x,300);
  const w=createWorld('fire');step(w,STEP,{attack:true,aim:{x:600,y:630}});assert.equal(w.player.cast.touchAim,undefined);
});

test('touch opacity persists, clamps and tolerates unavailable storage',()=>{
  const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  assert.equal(controlOpacity(storage),.85);assert.equal(saveControlOpacity(.5,storage),true);assert.equal(controlOpacity(storage),.5);
  saveControlOpacity(.01,storage);assert.equal(controlOpacity(storage),.3);saveControlOpacity(2,storage);assert.equal(controlOpacity(storage),1);
  assert.equal(controlOpacity({getItem:()=>{throw Error();}}),.85);assert.equal(saveControlOpacity(.7,{setItem:()=>{throw Error();}}),false);
});
