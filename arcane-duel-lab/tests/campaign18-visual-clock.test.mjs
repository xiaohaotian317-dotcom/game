import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,requestCast,step,STEP} from '../dist/src/simulation.mjs';
import {renderDuelWorld} from '../dist/src/duel-visual-clock.mjs';

function freeze(value,seen=new WeakSet()){
 if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);for(const child of Object.values(value))freeze(child,seen);Object.freeze(value);}return value;
}
function elapsed(w,seconds){for(let n=0;n<Math.ceil(seconds/STEP);n++)step(w,STEP);}

test('all six ultimate cast ages advance continuously between snapshots without mutating or releasing authoritative gameplay',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star']){
  const source=createWorld(hero);assert.ok(requestCast(source,'r',700,source.floor-5));source.player.cast.age=source.player.cast.releaseAt-.01;
  const before=structuredClone(source);freeze(source);let previous=source.player.cast.age;
  for(const dt of [.008,.016,.024,.033,.05]){const view=renderDuelWorld(source,dt);assert.notEqual(view.player,source.player);assert.notEqual(view.player.cast,source.player.cast);assert.ok(Math.abs(view.player.cast.age-source.player.cast.age-dt)<1e-10,hero);assert.ok(view.player.cast.age>previous);previous=view.player.cast.age;assert.equal(view.player.cast.released,false,'presentation may not release a skill');assert.deepEqual(view.player.cooldowns,source.player.cooldowns);assert.equal(view.player.hp,source.player.hp);assert.equal(view.player.mp,source.player.mp);assert.deepEqual(view.targets.map(t=>t.hp),source.targets.map(t=>t.hp));assert.deepEqual(view.effects,source.effects);}
  assert.deepEqual(source,before,hero+' authoritative state was changed');
 }
});

test('a real lightning burst, nature tree and authored construct age advance while lifetime deadlines and game state remain fixed',()=>{
 const lightning=createWorld('lightning');lightning.targets=[];assert.ok(requestCast(lightning,'q',700,lightning.floor-5));elapsed(lightning,.15);assert.ok(lightning.player.burst);
 const nature=createWorld('nature');assert.ok(requestCast(nature,'r',700,nature.floor-5));elapsed(nature,.65);assert.ok(nature.trees.length);nature.constructs.push({age:.25,until:nature.time+5,platformId:'visual-fixture'});
 for(const source of [lightning,nature]){const before=structuredClone(source);freeze(source);const view=renderDuelWorld(source,.04);if(source.player.burst){assert.notEqual(view.player.burst,source.player.burst);assert.ok(Math.abs(view.player.burst.age-source.player.burst.age-.04)<1e-10);assert.equal(view.player.burst.until,source.player.burst.until);}for(const key of ['trees','constructs'])for(const [index,item]of (source[key]||[]).entries()){assert.notEqual(view[key][index],item);assert.ok(Math.abs(view[key][index].age-item.age-.04)<1e-10,key);assert.equal(view[key][index].until,item.until);}assert.deepEqual(source,before);}
});

test('visual projection advances effect and projectile presentation but clamps elapsed time and never applies hits or spends resources',()=>{
 const source=createWorld('fire');source.time=5;source.fxTime=5;source.effects=[{kind:'meteor',age:.2,delay:.21,triggered:false,duration:2,x:700,y:source.floor}];source.projectiles=[{id:91,x:600,y:500,vx:200,vy:-100,age:.3,life:2,damage:500,owner:'player'}];source.duelSkills={loadout:{q:'fire-0-1'},fields:[{age:.4,next:5.01,damage:100}]};const before=structuredClone(source);freeze(source);
 for(const [input,expected]of [[-.1,0],[0,0],[.02,.02],[.2,.05],[NaN,0]]){const view=renderDuelWorld(source,input);assert.ok(Math.abs(view.time-5-expected)<1e-10);assert.ok(Math.abs(view.fxTime-5-expected)<1e-10);assert.ok(Math.abs(view.effects[0].age-.2-expected)<1e-10);assert.equal(view.effects[0].triggered,false);assert.ok(Math.abs(view.duelSkills.fields[0].age-.4-expected)<1e-10);assert.equal(view.duelSkills.fields[0].next,5.01);assert.equal(view.projectiles[0].x,600+200*expected);assert.equal(view.projectiles[0].y,500-100*expected);assert.equal(view.player.hp,source.player.hp);assert.deepEqual(view.targets,source.targets);assert.deepEqual(view.stats,source.stats);}
 assert.deepEqual(source,before);
});
