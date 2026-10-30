import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,requestCast} from '../dist/src/simulation.mjs';
import {createDuel,stepDuel,STEP} from '../dist/src/duel-simulation.mjs';
import {fitDuelCamera,cameraView,updateCamera,worldPoint,opponentEdge} from '../dist/src/camera.mjs';
test('all professions start with integer maximum health increased by 50 percent',()=>{
  const expected={fire:180,nature:180,frost:165,lightning:180,shadow:165,star:173};
  for(const [hero,hp] of Object.entries(expected)){const w=createWorld(hero);assert.equal(w.player.maxHp,hp);assert.equal(w.player.hp,hp);assert.ok(Number.isInteger(w.player.maxHp));}
  for(const w of createDuel(['star','frost']).worlds)assert.equal(w.player.hp,w.player.maxHp);
});
test('full viewport camera preserves aspect and pointer coordinates at every screen shape',()=>{
  for(const [width,height] of [[1280,720],[1920,1080],[2560,1080],[390,844]]){
    const w=createDuel(['fire','nature']).worlds[0];fitDuelCamera(w,width,height);updateCamera(w,1/60);const v=cameraView(w);
    assert.ok(Math.abs(width/v.width-height/v.height)<1e-10);assert.ok(v.width<=1280);assert.ok(v.height<=w.height+1e-8);
    assert.deepEqual(worldPoint(w,.5,.5),{x:v.x+v.width/2,y:v.y+v.height/2});
  }
});
test('camera follows its own player and clamps at both map edges independently of the rival',()=>{
  const m=createDuel(['lightning','shadow']),w=m.worlds[1];fitDuelCamera(w,1280,720);updateCamera(w,.016);assert.ok(w.camera.x>900);
  const old=w.camera.x;w.player.x=1000;updateCamera(w,.1);assert.ok(w.camera.x<old);m.worlds[0].player.x=50;const before=w.camera.x;updateCamera(w,0);assert.equal(w.camera.x,before);
  w.player.x=0;updateCamera(w,20);assert.ok(w.camera.x<.001);w.player.x=w.width;updateCamera(w,20);assert.ok(Math.abs(w.camera.x-(w.width-cameraView(w).width))<.001);
});
test('opponent direction appears only out of view and stays clear of HUD and hotbar on all edges',()=>{
  const view={x:600,y:100,width:900,height:500};assert.equal(opponentEdge(view,{x:1000,y:300,hp:100},1440,800),null);
  for(const [x,y] of [[300,350],[1800,350],[1000,-200],[1000,1000],[200,-300],[1800,1000]]){
    const e=opponentEdge(view,{x,y,hp:100},1440,800);assert.ok(e);assert.ok(e.x>=48&&e.x<=1392);assert.ok(e.y>=118&&e.y<=680);assert.ok(Number.isFinite(e.angle));
  }
  assert.equal(opponentEdge(view,{x:1800,y:350,hp:0},1440,800),null);
});
test('frost F and its single echo deal 18 plus 12 actual PvP damage while retaining control',()=>{
  const m=createDuel(['frost','fire'],'training'),[a,b]=m.worlds;a.platforms=[{id:'ground',x:0,y:704,w:1440,active:true}];a.obstacles=[];a.player.x=300;b.player.x=420;b.player.invuln=0;
  requestCast(a,'q',420,650);for(let i=0;i<80;i++)stepDuel(m,STEP,[{},{}]);assert.equal(b.player.hp,162);assert.ok(b.player.frostSnareUntil>a.time);
  assert.ok(requestCast(a,'q'));for(let i=0;i<40;i++)stepDuel(m,STEP,[{},{}]);assert.equal(b.player.hp,150);assert.equal(a.player.recast,null);assert.ok(a.player.cooldowns.q>5);
});
