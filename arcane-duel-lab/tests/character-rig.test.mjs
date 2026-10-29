import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {RIGS,partTransform,basePose,bodyFrame,rotatePoint,castMuzzle,targetPose,blendPose,armChain} from '../dist/src/character-rig.mjs';
import {createWorld,requestCast,STEP,step} from '../dist/src/simulation.mjs';
const bounds=JSON.parse(readFileSync(new URL('../dist/assets/rig-bounds.json',import.meta.url)));
test('zero or slightly negative resume frame times never poison the pose',()=>{
  for(const hero of ['fire','nature']){const w=createWorld(hero),o=basePose();requestCast(w,'r');for(const dt of [0,-.0002,STEP,0,STEP]){blendPose(o,targetPose(w),dt,true);assert.ok(Object.values(o).every(Number.isFinite));}assert.ok(Number.isFinite(bodyFrame(hero,o,{w:RIGS[hero].aspect,h:1}).near.y));}
});
test('painted limb endpoints stay attached under rotation without stretching artwork',()=>{
  for(const hero of ['fire','nature'])for(const key of ['upperArm','forearm','thigh','shin'])for(const end of [{x:21,y:40},{x:-37,y:-15}]){
    const b=bounds[hero][key],a=RIGS[hero][key],start={x:7,y:-80},m=partTransform(b,a,start,end);
    const relative={x:(a.end[0]-a.start[0])*b.w*m.scale,y:(a.end[1]-a.start[1])*b.h*m.scale},q=rotatePoint(relative,m.angle);
    assert.ok(Math.abs(start.x+q.x-end.x)<1e-8);assert.ok(Math.abs(start.y+q.y-end.y)<1e-8);
    assert.ok(m.scale>0&&Number.isFinite(m.scale));
  }
});
test('shoulders follow the same torso pivot when running in either direction',()=>{
  for(const hero of ['fire','nature']){
    const r=RIGS[hero],core={w:r.aspect,h:1},w=createWorld(hero);w.player.vx=310;const right=targetPose(w);w.player.vx=-310;w.player.face=-1;const left=targetPose(w);
    assert.equal(right.lean,left.lean);
    for(const angle of [-.25,.3]){const o={...basePose(),lean:angle,bob:5},f=bodyFrame(hero,o,core),local=f.local(r.nearShoulder),q=rotatePoint(local,angle);assert.ok(Math.hypot(f.near.x-f.origin.x-q.x,f.near.y-f.origin.y-q.y)<1e-8);}
  }
});
test('left and right attacks spawn projectiles and muzzle effects at the held staff tip',()=>{
  for(const hero of ['fire','nature'])for(const face of [-1,1]){
    const w=createWorld(hero);w.player.face=face;requestCast(w,'attack',w.player.x+face*500,w.player.y-130);
    while(!w.projectiles.length)step(w,STEP);
    const shot=w.projectiles[0],muzzle=w.effects.find(e=>['muzzle','seedCast'].includes(e.kind)),socket=castMuzzle(w);
    assert.ok(muzzle);assert.ok(Math.abs(shot.px-muzzle.x)<.01);assert.ok(Math.abs(shot.py-muzzle.y)<.01);
    assert.ok(Math.hypot(socket.x-muzzle.x,socket.y-muzzle.y)<2);
    assert.ok((muzzle.x-w.player.x)*face>40);assert.ok(muzzle.y<w.player.y-65);
  }
});
test('repeated R cycles keep both shoulder roots fixed and joint motion bounded',()=>{
  for(const hero of ['fire','nature'])for(const face of [-1,1]){
    const w=createWorld(hero),o=basePose(),r=RIGS[hero];w.player.face=face;
    const skill=w.hero==='fire'?{duration:1,releaseAt:.52}:{duration:1.04,releaseAt:.55};
    for(let frameIndex=0;frameIndex<480;frameIndex++){
      w.time=frameIndex/120;w.player.cast={key:'r',age:w.time%skill.duration,...skill};
      const before={...o};blendPose(o,targetPose(w),1/120,true);
      assert.ok(Math.abs(o.armA-before.armA)<=2.4/120+1e-8);
      assert.ok(Math.abs(o.elbowA-before.elbowA)<=3.2/120+1e-8);
      assert.ok(o.armA<.87);assert.ok(o.armB>=0);
      const f=bodyFrame(hero,o,{w:r.aspect,h:1});
      for(const [socket,a,b] of [[f.near,o.armA,o.elbowA],[f.far,o.armB,o.elbowB]]){
        const arm=armChain(socket,a,b,o.lean);
        assert.deepEqual(arm.shoulder,socket);
        assert.ok(Math.abs(Math.hypot(arm.elbow.x-socket.x,arm.elbow.y-socket.y)-28)<1e-8);
        assert.ok(Math.abs(Math.hypot(arm.hand.x-arm.elbow.x,arm.hand.y-arm.elbow.y)-29)<1e-8);
      }
    }
  }
});
test('free hand stays relaxed and motionless relative to the torso through every cast',()=>{
  for(const hero of ['fire','nature'])for(const key of ['attack','q','e','r']){
    const w=createWorld(hero),r=RIGS[hero];let reference;
    for(let phase=0;phase<=1;phase+=.05){
      w.time=phase*2;w.player.vx=250;w.player.cycle=phase*8;
      w.player.cast={key,age:phase,releaseAt:.52,duration:1};
      const pose=targetPose(w),f=bodyFrame(hero,pose,{w:r.aspect,h:1}),hand=armChain(f.far,pose.armB,pose.elbowB,pose.lean).hand;
      const relative=rotatePoint({x:hand.x-f.far.x,y:hand.y-f.far.y},-pose.lean);
      reference??=relative;
      assert.ok(Math.hypot(relative.x-reference.x,relative.y-reference.y)<1e-8);
      assert.ok(relative.x>10&&relative.y>45);
    }
  }
});
