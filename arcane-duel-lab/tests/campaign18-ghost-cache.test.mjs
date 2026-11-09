import test from 'node:test';
import assert from 'node:assert/strict';
import {GhostSpriteCache} from '../dist/src/ghost-sprite-cache.mjs';
function canvas(width,height){const calls=[],ctx={filter:'none',setTransform(){},clearRect(){},save(){},restore(){},scale(){},translate(){},drawImage(){calls.push(this.filter);}};return {width,height,calls,getContext:()=>ctx};}
test('captured afterimages reuse flattened poses across projected age updates, with bounded residency and only one filtered image',()=>{
 const cache=new GhostSpriteCache(2,canvas),world={hero:'lightning',characterScale:.82,player:{cast:{key:'r'}}},ghost={x:100,y:700,face:1,cycle:2,grounded:false,pose:{lean:.2},age:0};let paints=0;
 const a=cache.get(world,ghost,()=>paints++),b=cache.get(world,{...ghost,age:.1},()=>paints++);assert.equal(a,b);assert.equal(paints,1);assert.deepEqual(a.canvas.calls,['brightness(1.5) saturate(.8)']);
 const shadow=cache.get({...world,hero:'shadow'},ghost,()=>paints++);assert.notEqual(a,shadow);assert.match(shadow.canvas.calls[0],/hue-rotate/);
 cache.get(world,{...ghost,x:110},()=>paints++);assert.equal(cache.items.size,2);cache.get(world,ghost,()=>paints++);assert.equal(paints,4,'evicted poses are rebuilt');assert.equal(ghost.age,0);assert.equal(world.player.cast.key,'r');
});
test('missing offscreen support leaves the fallback available without invoking or caching a failed paint',()=>{const cache=new GhostSpriteCache(2,()=>null);assert.equal(cache.get({hero:'shadow',player:{}},{pose:{}},()=>assert.fail()),null);assert.equal(cache.items.size,0);});
