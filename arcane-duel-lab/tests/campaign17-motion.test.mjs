import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,step,STEP,HEROES} from '../dist/src/simulation.mjs';
import {basePose,targetPose,blendPose,legChain,bodyFrame,RIGS,setCharacterMotionVersion} from '../dist/src/character-rig.mjs';
import * as legacy from '../dist/src/character-rig-legacy.mjs';

const heroes=['fire','nature','frost','lightning','shadow','star'];
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function flat(hero){const w=createWorld(hero);w.targets=[];w.obstacles=[];w.platforms=w.platforms.filter(p=>p.id==='ground');w.spring.enabled=false;w.player.x=w.player.prevX=w.width/2;return w;}
function spread(a,b){const dot=(a.knee.x-a.hip.x)*(b.knee.x-b.hip.x)+(a.knee.y-a.hip.y)*(b.knee.y-b.hip.y);return Math.acos(Math.max(-1,Math.min(1,dot/(41*41))))*180/Math.PI;}
function bones(w,pose){return [legChain(w,pose),legChain(w,pose,true)];}
function checkLengths(chains){for(const c of chains){assert.ok(Math.abs(distance(c.hip,c.knee)-41)<1e-8);assert.ok(Math.abs(distance(c.knee,c.ankle)-43)<1e-8);for(const point of Object.values(c))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));}}
function run(hero,{move=1,second=34,hz=120}={}){
 const w=flat(hero),pose=basePose(),samples=[],previous=[];let maxStep=0,maxFootStep=0,maxAirStep=0,landed=false;
 for(let i=0;i<240;i++){
  step(w,STEP,{move,jump:i===1||i===second,aim:{x:move<0?20:w.width-20,y:600}});
  if(i%(120/hz)!==0)continue;
  const before=structuredClone(w.player);blendPose(pose,targetPose(w),1/hz);const chains=bones(w,pose);checkLengths(chains);assert.deepEqual(w.player,before,'rendering must not change physics');
  for(const [j,c]of chains.entries())for(const part of ['hip','knee','ankle']){const point={x:w.player.x+c[part].x*w.player.face,y:w.player.y+c[part].y},key=j+'-'+part;if(previous[key]){const delta=distance(point,previous[key]);maxStep=Math.max(maxStep,delta);if(part==='ankle')maxFootStep=Math.max(maxFootStep,delta);if(w.player.jumps===2&&!w.player.grounded)maxAirStep=Math.max(maxAirStep,delta);}previous[key]=point;}
  if(w.player.jumps===2&&!w.player.grounded)samples.push({age:w.time-w.player.jumpAt,foot:Math.abs(chains[0].ankle.x-chains[1].ankle.x),knee:Math.abs(chains[0].knee.x-chains[1].knee.x),angle:spread(...chains)});
  if(i>120&&w.player.grounded)landed=true;
 }
 return {samples,maxStep,maxFootStep,maxAirStep,landed};
}

test('real second jumps gather and extend with close feet and knees at 30, 60 and 120 Hz',()=>{
 setCharacterMotionVersion('v2');
 for(const hero of heroes)for(const hz of [30,60,120])for(const move of [0,1]){
  const result=run(hero,{hz,move}),gather=result.samples.filter(s=>s.age>=.065&&s.age<=.16),extend=result.samples.filter(s=>s.age>=.22&&s.age<=.4);
  assert.ok(result.landed&&gather.length>=2&&extend.length>=4,hero+' complete jump phases');
  for(const s of gather){assert.ok(s.foot<36,hero+' gathered feet '+s.foot);assert.ok(s.knee<33,hero+' gathered knees '+s.knee);assert.ok(s.angle<36,hero+' gathered thighs '+s.angle);}
  for(const s of extend){assert.ok(s.foot<43,hero+' extension must stay near the body '+s.foot);assert.ok(s.knee<28,hero+' extended knees '+s.knee);assert.ok(s.angle<23,hero+' extended thighs '+s.angle);}
  assert.ok(result.samples.every(s=>s.foot<70),hero+' no second-jump splits');
 }
});

test('early and late second-jump input remains continuous through gathering, extension and landing',()=>{
 setCharacterMotionVersion('v2');
 for(const hero of heroes)for(const second of [2,10,34,65]){
  const result=run(hero,{second});assert.ok(result.samples.length>35,hero+' real second impulse');assert.ok(result.landed);assert.ok(result.maxAirStep<10,hero+' airborne joint discontinuity '+result.maxAirStep);assert.ok(result.maxFootStep<20,hero+' landing foot discontinuity '+result.maxFootStep);assert.ok(result.maxStep<24,hero+' landing joint discontinuity '+result.maxStep);
 }
});

test('cached walking foot hints cannot widen a double jump while the air pose blends in',()=>{
 setCharacterMotionVersion('v2');
 for(const hero of heroes){const w=flat(hero);w.time=1.1;Object.assign(w.player,{grounded:false,jumps:2,jumpAt:1,vy:-480,vx:320});
  for(let i=0;i<32;i++)for(const air of [0,.1,.25,.5,.75,1]){w.player.cycle=i*Math.PI/16;const pose=targetPose(w);pose.air=air;const c=bones(w,pose);checkLengths(c);assert.ok(Math.abs(c[0].ankle.x-c[1].ankle.x)<34,hero+' widened blended foot hints');assert.ok(spread(...c)<40,hero+' widened blended knees');}
 }
});

test('all six double jumps retain distinct close-knee gather and lead-foot extension silhouettes',()=>{
 setCharacterMotionVersion('v2');const signatures=new Set();
 for(const hero of heroes){const w=flat(hero),parts=[];Object.assign(w.player,{grounded:false,jumps:2,jumpAt:1});
  for(const age of [.1,.27]){w.time=1+age;w.player.vy=-HEROES[hero].jump*.92+1900*age;const c=bones(w,targetPose(w));checkLengths(c);parts.push(...c.flatMap(b=>[b.knee.x,b.knee.y,b.ankle.x,b.ankle.y]).map(v=>v.toFixed(3)));assert.ok(spread(...c)<25,hero+' hips open apart');}
  signatures.add(parts.join(','));
 }
 assert.equal(signatures.size,6);
});

test('real left and right double jumps mirror every rendered hip, knee and foot',()=>{
 setCharacterMotionVersion('v2');
 for(const hero of heroes){const right=flat(hero),left=flat(hero),rPose=basePose(),lPose=basePose();
  for(let i=0;i<200;i++){
   step(right,STEP,{move:1,jump:i===1||i===34,aim:{x:right.width-20,y:600}});step(left,STEP,{move:-1,jump:i===1||i===34,aim:{x:20,y:600}});
   blendPose(rPose,targetPose(right),STEP);blendPose(lPose,targetPose(left),STEP);const r=bones(right,rPose),l=bones(left,lPose);
   for(let j=0;j<2;j++)for(const part of ['hip','knee','ankle']){assert.ok(Math.abs(right.player.x+r[j][part].x*right.player.face+left.player.x+l[j][part].x*left.player.face-right.width)<1e-7,hero+' '+part+' mirror x');assert.ok(Math.abs(right.player.y+r[j][part].y-left.player.y-l[j][part].y)<1e-7,hero+' '+part+' mirror y');}
  }
 }
});

test('legacy still returns the original full poses, legs and shoulder anchors with unchanged jump trajectories',()=>{
 for(const hero of heroes){const oldWorld=flat(hero),newWorld=flat(hero);
  for(let i=0;i<200;i++){
   const input={move:1,jump:i===1||i===34};setCharacterMotionVersion('legacy');step(oldWorld,STEP,input);const oldPose=targetPose(oldWorld),reference=legacy.targetPose(oldWorld);
   for(const [key,value]of Object.entries(reference))assert.equal(oldPose[key],value,hero+' legacy '+key);
   for(const back of [false,true])assert.deepEqual(legChain(oldWorld,oldPose,back),legacy.legChain(oldWorld,reference,back));
   const bounds={w:RIGS[hero].aspect,h:1},actualFrame=bodyFrame(hero,oldPose,bounds),referenceFrame=legacy.bodyFrame(hero,reference,bounds);for(const key of ['origin','near','far','scale'])assert.deepEqual(actualFrame[key],referenceFrame[key]);for(const uv of [RIGS[hero].hip,RIGS[hero].nearShoulder,RIGS[hero].farShoulder]){assert.deepEqual(actualFrame.local(uv),referenceFrame.local(uv));assert.deepEqual(actualFrame.point(uv),referenceFrame.point(uv));}
   setCharacterMotionVersion('v2');step(newWorld,STEP,input);targetPose(newWorld);for(const key of ['x','y','vx','vy','grounded','jumps','jumpAt'])assert.equal(newWorld.player[key],oldWorld.player[key],hero+' physics '+key);
  }
 }
 setCharacterMotionVersion('v2');
});
