import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorld,step,STEP,HEROES} from '../dist/src/simulation.mjs';
import {spawnEnemy,enemyCastOrigin,enemyMeleeReach} from '../dist/src/enemy-simulation.mjs';
import {EnemyPainter} from '../dist/src/enemy-painter.mjs';
import {BOSS_TUNING} from '../dist/src/enemy-tuning.mjs';
import {drawMovementFx} from '../dist/src/movement-fx.mjs';

const art=JSON.parse(readFileSync(new URL('../dist/assets/enemies/chapter2/bounds-v2.json',import.meta.url)));
const hash=data=>createHash('sha256').update(data).digest('hex');
const context=(images=[],ellipses=[])=>new Proxy({globalAlpha:1,drawImage(...args){images.push(args);},ellipse(...args){ellipses.push(args);},createRadialGradient(){return {addColorStop(){}};}},{get:(o,k)=>k in o?o[k]:()=>{}});

test('all nine redesigned bosses preserve original source pixels, safe crops, square faces and sixteen anchored poses',()=>{
 for(let n=12;n<=20;n++){
  const id='B'+n,m=art.units[id],image=readFileSync(new URL('../dist/assets/enemies/'+m.file,import.meta.url));
  assert.ok(m.referenceSourceHeight>0,id);assert.equal(m.frames.length,16,id);assert.equal(hash(image),m.sha256,id);
  const delivery=n===12?'boss_b12_redesign':n<=16?'boss_body_a':'boss_body_b',filename=m.file.split('/').at(-1);
  assert.equal(m.sha256,m.sourceSha256,id+' generated original');assert.deepEqual(image,readFileSync(new URL('../../美术概念/协作交付/T46/'+delivery+'/'+filename,import.meta.url)),id+' archived original bytes');
  const [x,y,width,height]=m.portrait.rect;assert.equal(width,height,id+' face square');assert.ok(x>=0&&y>=0&&x+width<=m.size[0]&&y+height<=m.size[1]);
  for(const f of m.frames){const r=f.rect,s=f.spriteRect;assert.ok(s[0]>=r[0]&&s[1]>=r[1]&&s[0]+s[2]<=r[0]+r[2]&&s[1]+s[3]<=r[1]+r[3],id+' isolated pose');assert.ok(f.pivot.every(Number.isFinite));assert.ok(f.groundContactY>=0&&f.groundContactY<=r[3]);assert.ok(f.sourceClipSpans.length);}
 }
});

test('new boss bodies and cast sockets use one source scale, preserving crouch/death height instead of stretching every pose',()=>{
 for(let n=12;n<=20;n++){
  const id='B'+n,w=createWorld('fire'),e=spawnEnemy(w,id,{x:700,y:w.floor}),m=art.units[id];w.enemyArt={[id]:m};
  const draws=[],painter=new EnemyPainter(context(draws),{enemies:{[id]:{width:m.size[0],height:m.size[1]}},enemyArt:w.enemyArt});
  painter.unit(w,e,1);const call=draws[0],f=m.frames[6],s=f.spriteRect,scale=e.visual/m.referenceSourceHeight;
  assert.ok(call,id+' body drawn');assert.ok(Math.abs(call[7]-s[2]*scale)<1e-8,id+' uniform width');assert.ok(Math.abs(call[8]-s[3]*scale)<1e-8,id+' uniform height');
  const socket=m.castSocket,frame=m.frames[10];assert.ok(socket,id+' authored ranged socket');e.face=1;
  const o=enemyCastOrigin(w,e);assert.equal(o.x,e.x+e.face*(socket.x-frame.pivot[0])*scale);assert.equal(o.y,e.y+(socket.y-frame.groundContactY)*scale);
  e.face=-1;const reverse=enemyCastOrigin(w,e);assert.equal(reverse.x,2*e.x-o.x);assert.equal(reverse.y,o.y);
 }
});

test('dash warnings include real travel and contact range, including behind-body overlap',()=>{
 const w=createWorld('fire'),e=spawnEnemy(w,'B15',{x:600,y:w.floor}),s={type:'dash',style:'ash',reach:145,speed:430,active:.55,windup:.9};
 e.face=1;e.ai.attack={plan:{steps:[s]},index:0,age:.4,speed:1.32};const ellipses=[];
 new EnemyPainter(context([],ellipses),{}).telegraph(w,e);const [x,,radius]=ellipses.find(a=>a[2]>100),travel=s.speed*BOSS_TUNING.range*BOSS_TUNING.frequency*s.active/e.ai.attack.speed;
 assert.ok(Math.abs((x-radius)-(e.x-e.w))<1e-8);assert.ok(Math.abs((x+radius)-(e.x+enemyMeleeReach(w,e,s)+travel))<1e-8);
});

test('every hero emits a themed second-jump and dash burst and the lightweight renderer samples original frames',()=>{
 const movement=JSON.parse(readFileSync(new URL('../dist/assets/movement-fx/motion-meta-v1.json',import.meta.url)));
 for(const hero of Object.keys(HEROES)){
  const w=createWorld(hero);w.targets=[];w.obstacles=[];w.player.grounded=true;w.player.y=w.floor;
  step(w,STEP,{jump:true});for(let n=0;n<12;n++)step(w,STEP,{});step(w,STEP,{jump:true});
  const jump=w.effects.find(e=>e.kind==='heroMovement'&&e.movementKind==='jump');assert.ok(jump,hero+' second jump');assert.equal(jump.hero,hero);assert.equal(w.player.jumps,2);
  step(w,STEP,{dash:true});const dash=w.effects.find(e=>e.kind==='heroMovement'&&e.movementKind==='teleport');assert.ok(dash,hero+' dash');assert.equal(dash.hero,hero);
  for(const effect of [jump,dash]){effect.age=.17;const draws=[],ctx=context(draws),m=movement.units[hero][effect.movementKind];assert.ok(drawMovementFx(ctx,w,effect,{movementFx:{[m.file]:{width:1254,height:1254}}}));assert.ok(draws.length>=1&&draws.length<=2);assert.ok(draws.every(args=>args.slice(1).every(Number.isFinite)));}
 }
});
