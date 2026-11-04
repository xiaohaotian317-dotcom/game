import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createWorld,step,STEP,requestCast} from '../dist/src/simulation.mjs';
import {RIGS,targetPose,basePose,blendPose,legChain} from '../dist/src/character-rig.mjs';
import {castWarning,warningProgress,drawLandingWarning,drawPunchStrike} from '../dist/src/combat-feedback.mjs';
import {switchTeamHero} from '../dist/src/campaign-team.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {createCampaign} from '../dist/src/campaign-simulation.mjs';
const heroes=Object.keys(RIGS);
function flat(hero){const w=createWorld(hero);w.targets=[];w.obstacles=[];w.platforms=[{id:'ground',active:true,x:0,y:w.floor,w:w.width,type:'stone'}];w.spring.enabled=false;return w;}

test('all six flight poses vary continuously through the apex instead of switching fixed silhouettes',()=>{
 const signatures=new Set();
 for(const hero of heroes){const w=flat(hero);w.player.grounded=false;w.player.jumps=1;
  w.player.vy=-1;const a=targetPose(w);w.player.vy=1;const b=targetPose(w);
  for(const key of ['legA','legB','kneeA','kneeB','cape'])assert.ok(Math.abs(a[key]-b[key])<.02,hero+' '+key);
  w.player.vy=-380;const rising=targetPose(w);w.player.vy=700;const falling=targetPose(w);
  assert.ok(Math.abs(rising.kneeA-falling.kneeA)>.35,hero);signatures.add([rising.legA,rising.kneeA,rising.legB].join(','));
 }
 assert.equal(signatures.size,6);
});

test('real run/double-jump/landing uses continuous planted feet and constant length leg bones without mutating physics',()=>{
 for(const hero of heroes){const w=flat(hero),pose=basePose();let previous=[],maxStep=0,landed=false;
  for(let i=0;i<250;i++){
   step(w,STEP,{move:1,jump:i===1||i===34});const player=structuredClone(w.player);
   blendPose(pose,targetPose(w),STEP);
   for(const [index,back]of [false,true].entries()){
    const chain=legChain(w,pose,back),foot={x:w.player.x+chain.ankle.x,y:w.player.y+chain.ankle.y};
    assert.ok(Math.abs(Math.hypot(chain.knee.x-chain.hip.x,chain.knee.y-chain.hip.y)-41)<1e-8);
    assert.ok(Math.abs(Math.hypot(chain.ankle.x-chain.knee.x,chain.ankle.y-chain.knee.y)-43)<1e-8);
    if(previous[index])maxStep=Math.max(maxStep,Math.hypot(foot.x-previous[index].x,foot.y-previous[index].y));previous[index]=foot;
    if(w.player.grounded)assert.ok(chain.ankle.y<1e-7,hero+' foot below ground');
   }
   assert.deepEqual(w.player,player);if(i>100&&w.player.grounded)landed=true;
  }
  assert.ok(landed,hero);assert.ok(maxStep<20,hero+' foot step '+maxStep);
 }
});

test('airborne team switches carry current landing state rather than a reserve hero stale landing',()=>{
 const p=freshSolo();p.owned=['fire','lightning'];const w=createCampaign('fire',1,{profile:p,team:p.owned});
 w.player.grounded=false;w.player.vy=250;w.player.land=0;w.player.landImpact=.8;w.campaign.team[1].player.land=.17;
 switchTeamHero(w,1);assert.equal(w.player.land,0);assert.equal(w.player.landImpact,.8);assert.ok(Object.values(targetPose(w)).every(Number.isFinite));
});

test('painted warning follows the selected support while previewing the real spell radius',()=>{
 const w=flat('fire');w.platforms.push({id:'deck',active:true,x:400,y:400,w:400,type:'stone'});
 requestCast(w,'r',500,450);let warning=castWarning(w);assert.equal(warning.y,w.floor);assert.equal(warning.radius,155);
 w.player.cast=null;w.player.cooldowns.r=0;requestCast(w,'r',500,350);warning=castWarning(w);assert.equal(warning.y,400);
 w.platforms[1].x+=20;w.platforms[1].y-=30;warning=castWarning(w);assert.equal(warning.x,520);assert.equal(warning.y,370);
 w.player.cast.released=true;assert.equal(castWarning(w),null);
});

test('lightning ultimate warning and actual dive share the exact enemy-front landing point',()=>{
 const w=flat('lightning'),enemy=createWorld('fire').targets[0];Object.assign(enemy,{x:700,y:w.floor,prevX:700,prevY:w.floor,attackAt:1e9});w.targets=[enemy];
 requestCast(w,'r',700,w.floor-40);const warning=castWarning(w);assert.equal(warning.x,646);
 for(let i=0;i<100&&!w.player.burst;i++)step(w,STEP);
 assert.equal(w.player.burst.kind,'thunderDive');assert.equal(w.player.burst.target.x,warning.x);assert.equal(w.player.burst.target.y,warning.y);
});

test('meteor warning progress continues across cast release and reaches one only at impact',()=>{
 const w=flat('fire');requestCast(w,'r',700,w.floor-20);let before=0;
 while(!w.effects.some(e=>e.kind==='meteor')){before=castWarning(w)?.progress??before;step(w,STEP);}
 const e=w.effects.find(e=>e.kind==='meteor'),after=warningProgress(e.age,e.warningLead,e.delay);
 assert.ok(before>0&&before<.3);assert.ok(after>=before&&after-before<.03);assert.equal(warningProgress(e.delay,e.warningLead,e.delay),1);
});

test('new punch and six warning materials preserve source hashes, valid rectangles and finite rendering',()=>{
 const root=new URL('../dist/assets/combat-feedback/',import.meta.url),meta=JSON.parse(readFileSync(new URL('feedback-meta-v1.json',root)));
 const drawCalls=[],ctx=new Proxy({globalAlpha:1,drawImage(...args){drawCalls.push(args);}}, {get:(o,k)=>k in o?o[k]:(()=>{})});
 const assets={feedbackMeta:meta,lightningPunch:{},landingRings:{}};
 for(const m of Object.values(meta)){assert.equal(createHash('sha256').update(readFileSync(new URL(m.file,root))).digest('hex'),m.sha256);for(const f of Object.values(m.frames)){const [x,y,w,h]=f.rect;assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=m.size[0]&&y+h<=m.size[1]);}}
 for(const hero of heroes)drawLandingWarning(ctx,assets,{hero,x:100,y:200,radius:155,progress:.7,clock:3});
 for(const face of [-1,1])for(let age=0;age<.34;age+=.02)drawPunchStrike(ctx,assets,100,200,face,age);
 assert.ok(drawCalls.length>40);for(const args of drawCalls)assert.ok(args.slice(1).every(Number.isFinite));
});
