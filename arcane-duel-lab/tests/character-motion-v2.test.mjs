import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import {createWorld,step,STEP,HEROES} from '../dist/src/simulation.mjs';
import * as old from '../dist/src/character-rig-legacy.mjs';
import {RIGS,basePose,targetPose,blendPose,legChain,bodyFrame,corePoint,setCharacterMotionVersion} from '../dist/src/character-rig.mjs';
import {skinMesh} from '../dist/src/character-skin.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';import {createCampaign} from '../dist/src/campaign-simulation.mjs';import {switchTeamHero} from '../dist/src/campaign-team.mjs';
const heroes=Object.keys(RIGS),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function flat(hero){const w=createWorld(hero);w.targets=[];w.obstacles=[];w.platforms=[{id:'ground',active:true,x:0,y:w.floor,w:w.width,type:'stone'}];w.spring.enabled=false;return w;}

test('new idle stance bears weight between separated planted feet with unlocked knees',()=>{
 setCharacterMotionVersion('v2');for(const hero of heroes){const w=flat(hero),ranges={head:[],hair:[],cloth:[]};
  for(let i=0;i<200;i++){w.time=i/60;const p=targetPose(w),a=legChain(w,p),b=legChain(w,p,true),f=bodyFrame(hero,p,{w:RIGS[hero].aspect,h:1});
   assert.ok(a.ankle.x-b.ankle.x>25,hero);assert.ok(a.hip.y>-82,hero);assert.ok(Math.abs(a.ankle.y)<1e-8&&Math.abs(b.ankle.y)<1e-8);
   const shoulders=(f.near.x+f.far.x)/2;assert.ok(shoulders>b.ankle.x&&shoulders<a.ankle.x,hero+' balance');
   for(const key of Object.keys(ranges))ranges[key].push(p[key]);
  }for(const [key,values]of Object.entries(ranges))assert.ok(Math.max(...values)-Math.min(...values)>(key==='head'?.02:.5),hero+' idle '+key);
 }
});
test('second jump has a distinct gather and opening sequence at identical velocity',()=>{
 setCharacterMotionVersion('v2');const signatures=new Set();for(const hero of heroes){const w=flat(hero);w.time=1;Object.assign(w.player,{grounded:false,vy:-480,jumpAt:.90,jumps:1});
  const first=targetPose(w);w.player.jumps=2;const second=targetPose(w);
  assert.ok(Math.abs(second.kneeA-first.kneeA)>.6,hero);assert.ok(distance(legChain(w,first).ankle,legChain(w,second).ankle)>14,hero);
  w.time=1.27;const open=targetPose(w);assert.ok(Math.abs(open.kneeA-second.kneeA)>.35,hero);
  signatures.add([second.legA,second.legB,open.kneeB].join(','));
 }assert.equal(signatures.size,6);
});
test('walking support feet remain on the floor through the whole gait cycle',()=>{
 setCharacterMotionVersion('v2');for(const hero of heroes)for(const speed of [100,240,340]){const w=flat(hero);w.player.vx=speed;
  for(let i=0;i<100;i++){w.player.cycle=i/100*Math.PI*2;const pose=targetPose(w);
   for(const back of [false,true]){const phase=w.player.cycle+(back?Math.PI:0),chain=legChain(w,pose,back);if(Math.cos(phase)<=0)assert.ok(Math.abs(chain.ankle.y)<1e-7,hero+' lifted support foot');}
  }
 }
});
test('actual jump input timestamps survive air switches and do not alter original trajectories',()=>{
 for(const hero of heroes){const a=flat(hero),b=flat(hero);for(let i=0;i<200;i++){const input={move:1,jump:i===1||i===28};setCharacterMotionVersion('legacy');step(a,STEP,input);setCharacterMotionVersion('v2');step(b,STEP,input);
  for(const k of ['x','y','vx','vy','grounded','jumps'])assert.equal(a.player[k],b.player[k],hero+' '+k);
  if(i===28)assert.equal(b.player.jumpAt,b.time);
 }}const profile=freshSolo();profile.owned=['fire','shadow'];const w=createCampaign('fire',1,{profile,team:profile.owned});Object.assign(w.player,{grounded:false,jumps:2,jumpAt:.21});w.time=.35;switchTeamHero(w,1);assert.equal(w.player.jumpAt,.21);assert.equal(w.player.jumps,2);
});
test('every basic attack retracts before release, extends on release and returns without moving a shoulder root',()=>{
 setCharacterMotionVersion('v2');for(const hero of heroes)for(const face of [-1,1]){const w=flat(hero),s=HEROES[hero].skills.attack;w.player.face=face;w.aim={x:w.player.x+400*face,y:w.player.y-110};
  const samples=[];for(const age of [s.release*.45,s.release,s.duration]){w.player.cast={key:'attack',age,releaseAt:s.release,duration:s.duration};samples.push(targetPose(w));}
  assert.ok(samples[1].shift>samples[0].shift+2,hero);assert.ok(Math.abs(samples[2].shift)<.001,hero);
  for(const p of samples){const bounds={w:RIGS[hero].aspect,h:1},f=bodyFrame(hero,p,bounds);for(const uv of [RIGS[hero].nearShoulder,RIGS[hero].farShoulder]){const warped=corePoint(hero,p,uv,bounds),fixed={x:(uv[0]-RIGS[hero].hip[0])*bounds.w*98,y:(uv[1]-RIGS[hero].hip[1])*98};assert.ok(distance(warped,fixed)<1e-8,hero+' pinned shoulder');}assert.ok(Object.values(f.near).every(Number.isFinite));}
 }
});
test('neck and hair skin remains connected with no flipped triangles over the full motion envelope',()=>{
 setCharacterMotionVersion('v2');for(const hero of heroes)for(const head of [-.11,0,.11])for(const hair of [-2,2]){
  const bounds={w:RIGS[hero].aspect,h:1},pose={...basePose(),head,hair},mesh=skinMesh(hero,pose,bounds);
  for(const face of mesh.faces){const [a,b,c]=face.map(i=>mesh.points[i]),area=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);assert.ok(Number.isFinite(area)&&area>.001,hero+' inverted skin');}
  for(const shoulder of [RIGS[hero].nearShoulder,RIGS[hero].farShoulder]){const index=mesh.uv.findIndex(uv=>Math.hypot(uv[0]-shoulder[0],uv[1]-shoulder[1])<1e-9);assert.ok(index>=0,hero+' shoulder missing from actual mesh');const expected={x:(shoulder[0]-RIGS[hero].hip[0])*bounds.w*98,y:(shoulder[1]-RIGS[hero].hip[1])*98};assert.ok(distance(mesh.points[index],expected)<1e-8,hero+' actual mesh shoulder detached');}
  const hip=corePoint(hero,pose,RIGS[hero].hip,bounds);assert.ok(distance(hip,{x:0,y:0})<1e-8);
 }
});
test('legacy switch restores original poses, bones and body anchors rather than approximating them',()=>{
 for(const hero of heroes){const w=flat(hero);for(const mode of ['idle','walk','air','attack','r']){Object.assign(w.player,{vx:mode==='walk'?280:0,grounded:mode!=='air',jumps:2,vy:-280});w.player.cast=['attack','r'].includes(mode)?{key:mode,age:.12,releaseAt:.2,duration:.7}:null;
  setCharacterMotionVersion('legacy');const pose=targetPose(w),reference=old.targetPose(w);for(const [k,v]of Object.entries(reference))assert.equal(pose[k],v,hero+' '+k);
  for(const back of [false,true])assert.deepEqual(legChain(w,pose,back),old.legChain(w,reference,back));
  assert.deepEqual(bodyFrame(hero,pose,{w:RIGS[hero].aspect,h:1}).near,old.bodyFrame(hero,reference,{w:RIGS[hero].aspect,h:1}).near);
 }}setCharacterMotionVersion('v2');
});
test('desktop preload carries the selected animation mode across every local page without touching a save',()=>{
 const source=readFileSync(new URL('../desktop/preload.cjs',import.meta.url),'utf8');
 for(const legacy of [false,true]){let exposed;runInNewContext(source,{process:{argv:['electron',legacy?'--arcane-motion=legacy':'--arcane-motion=v2']},require:()=>({contextBridge:{exposeInMainWorld(name,value){assert.equal(name,'arcaneDesktop');exposed=value;}},ipcRenderer:{invoke(){throw Error('motion selection must not invoke a transaction');}}})});assert.equal(exposed.motionVersion,legacy?'legacy':'v2');}
});
