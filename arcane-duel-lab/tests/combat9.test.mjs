import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createWorld,requestCast,step,STEP} from '../dist/src/simulation.mjs';
import {skillArt,ICON_ORDER} from '../dist/src/skill-icons.mjs';
function flat(hero){const w=createWorld(hero);w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.mirror.enabled=false;w.spring.enabled=false;w.targets=w.targets.slice(0,1);Object.assign(w.player,{x:200,prevX:200,y:704,prevY:704});Object.assign(w.targets[0],{x:420,prevX:420,spawnX:420,y:704,prevY:704,spawnY:704});return w;}
function advance(w,s){for(let i=0;i<Math.ceil(s/STEP);i++)step(w,STEP);}
test('both melee ranges increase exactly 25 percent, in both facings, without becoming ranged',()=>{
  for(const [hero,range] of [['lightning',125],['shadow',137.5]])for(const face of [-1,1])for(const inside of [true,false]){const w=flat(hero);w.targets[0].x=200+face*(range+(inside?-.5:.5));requestCast(w,'attack',200+face*600,650);advance(w,.32);assert.equal(w.targets[0].hp<240,inside);assert.equal(w.projectiles.length,0);assert.ok(w.effects.some(e=>e.rangeScale===1.25));}
});
test('frost ring applies a real 35 percent movement slow, then restores speed without weakening stronger frost',()=>{
  const a=flat('frost'),b=flat('frost');requestCast(b,'q',420,650);advance(b,.5);assert.equal(b.targets[0].hp,230);a.time=b.time;a.moving=b.moving=true;step(a,STEP);step(b,STEP);assert.ok(Math.abs(b.targets[0].vx/a.targets[0].vx-.65)<1e-8);b.targets[0].slowUntil=b.time+1;step(b,STEP);step(a,STEP);assert.ok(Math.abs(b.targets[0].vx/a.targets[0].vx-.45)<1e-8);a.moving=b.moving=false;advance(a,3);advance(b,3);a.moving=b.moving=true;step(a,STEP);step(b,STEP);assert.ok(Math.abs(b.targets[0].vx-a.targets[0].vx)<1e-7);
});
test('frost ring supports a late low-damage echo, but no third cast or airborne platform',()=>{
  const w=flat('frost');requestCast(w,'q',420,600);advance(w,3.1);assert.ok(w.player.recast);assert.ok(requestCast(w,'q'));advance(w,.2);assert.equal(w.targets[0].hp,224);assert.equal(w.player.recast,null);assert.equal(requestCast(w,'q'),false);assert.equal(w.platforms.length,1);assert.equal(w.constructs.length,0);
});
test('all 36 skill illustrations have unique atlas cells and real PNG assets, including six recasts',()=>{
  const seen=new Set();for(const hero of ['fire','nature','frost','lightning','shadow','star'])for(const key of ICON_ORDER){const a=skillArt(hero,key,key==='recast'),id=a.url+'#'+a.position;assert.ok(!seen.has(id));seen.add(id);const path=new URL('../dist/'+a.url,import.meta.url);assert.ok(existsSync(path));const bytes=readFileSync(path);assert.equal(bytes.readUInt32BE(16),1536);assert.equal(bytes.readUInt32BE(20),1024);}assert.equal(seen.size,36);
});
