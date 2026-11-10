import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,HEROES} from '../dist/src/simulation.mjs';
import {createDuel,stepDuel,duelSnapshot,restoreDuel} from '../dist/src/duel-simulation.mjs';

function lane(hero){
 const w=createWorld(hero);w.width=10000;w.platforms=w.platforms.filter(p=>p.id==='ground');w.platforms[0].w=10000;
 w.obstacles=[];w.targets=[];w.mirror.enabled=false;w.spring.enabled=false;
 Object.assign(w.player,{x:3000,prevX:3000,y:w.floor,prevY:w.floor,grounded:true});return w;
}
test('six touch heroes keep the same continuous forward walking speed while repeatedly firing in either direction',()=>{
 for(const hero of Object.keys(HEROES))for(const move of [-1,1]){
  const w=lane(hero),walking=lane(hero);w.player.face=walking.player.face=move;
  let minRatio=1;
  for(let n=0;n<360;n++){
   step(w,STEP,{touchAim:true,move,attack:true,aim:{x:w.player.x+move*600,y:w.player.y-55}});
   step(walking,STEP,{touchAim:true,move});
   if(n>60)minRatio=Math.min(minRatio,Math.abs(w.player.vx/walking.player.vx));
  }
  assert(w.stats.casts>=3,hero);assert(minRatio>.999,`${hero}/${move}: forward-fire speed ${minRatio}`);
  assert(Math.abs(w.player.x-walking.player.x)<.001,hero+' must not lose walking distance every shot');
 }
});
test('forward directional casting remains mobile while an opposite shot plants briefly and leaves the facing hand',()=>{
 for(const move of [-1,1])for(const behind of [false,true]){
  const w=lane('fire');w.player.x=w.player.prevX=700;w.player.face=move;w.player.vx=move*HEROES.fire.speed;
  const origin=w.player.x,face=behind?-move:move;
  step(w,STEP,{touchAim:true,move,cast:'e',aim:{x:origin+face*600,y:w.player.y-55}});
  for(let n=0;n<14;n++)step(w,STEP,{touchAim:true,move,aim:{x:origin+move*600,y:w.player.y-55}});
  const shot=w.projectiles.find(p=>p.kind==='emberOrb');assert(shot);assert.equal(Math.sign(shot.vx),face);
  const ratio=Math.abs(w.player.vx/HEROES.fire.speed);
  assert(behind?ratio<.35:ratio>.999,'only opposite casting should slow the player');
 }
});
test('turn recovery uses the live stick direction, and the same cast survives an authority snapshot',()=>{
 const match=createDuel(['fire','nature']);
 const w=match.worlds[0];w.player.x=800;w.player.face=1;
 stepDuel(match,STEP,[{touchAim:true,move:1,attack:true,aim:{x:200,y:600}},{}]);
 const restored=restoreDuel(duelSnapshot(match)),p=restored.worlds[0].player;
 assert.equal(p.cast.touchAim,true);assert.equal(p.cast.face,-1);
 stepDuel(restored,STEP,[{touchAim:true,move:-1},{}]);assert(p.vx<0,'reversing the stick into the firing direction immediately restores walking');
});
