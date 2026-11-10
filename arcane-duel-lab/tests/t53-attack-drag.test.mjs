import test from 'node:test';import assert from 'node:assert/strict';
import {TouchInputState,MobileControls,assistAim} from '../dist/src/mobile-controls.mjs';
import {createWorld,step,STEP} from '../dist/src/simulation.mjs';
function controls(){const w=createWorld('fire');w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.targets=[];w.mirror.enabled=false;const ui={input:new TouchInputState(),enabled:true,model:{hero:'fire',skills:{}},getWorld:()=>w,refreshVisuals(){},aimFor:MobileControls.prototype.aimFor};return {w,ui,read:()=>MobileControls.prototype.read.call(ui)};}
test('attack press retains continuous automatic targeting until the drag threshold is crossed',()=>{
 const {w,ui,read}=controls();w.targets=[{x:550,y:w.floor,h:100,w:24,hp:100}];ui.input.press(1,'attack',{x:700,y:280});assert.deepEqual(read().aim,assistAim(w,{terrain:true,frontOnly:false}));assert.equal(read().attack,true);ui.input.move(1,{x:708,y:284});assert.equal(ui.input.pointerFor('attack').dragged,false);assert.deepEqual(read().aim,assistAim(w,{terrain:true,frontOnly:false}));ui.input.move(1,{x:640,y:240});const aimed=read();assert.equal(ui.input.pointerFor('attack').dragged,true);assert.ok(aimed.aim.x<w.player.x&&aimed.aim.y<w.player.y-55);assert.equal(aimed.attack,true);
});
test('dragged attack does not steal joystick or spell pointers and releasing each finger only stops its own action',()=>{
 const {ui,read}=controls();ui.input.press(1,'joystick',{x:80,y:280});ui.input.move(1,{x:120,y:280});ui.input.press(2,'attack',{x:700,y:280});ui.input.move(2,{x:640,y:240});const aimed=read().aim;ui.input.press(3,'q',{x:500,y:250});ui.input.move(3,{x:550,y:220},{aim:{x:500,y:100},canceled:true});assert.equal(ui.input.release(3),null);assert.equal(read().move,1);assert.equal(read().attack,true);assert.deepEqual(read().aim,aimed);assert.equal(ui.input.release(2),null);assert.equal(read().attack,false);assert.equal(read().move,1);assert.equal(read().aim,null);ui.input.release(1);assert.equal(read().move,0);
});
test('the next real held basic faces and fires along the dragged direction, and release stops future attacks',()=>{
 const {w,ui,read}=controls();ui.input.press(2,'attack',{x:700,y:280});for(let n=0;n<8;n++)step(w,STEP,{...read(),touchAim:true});ui.input.move(2,{x:650,y:230});let leftShot=false;for(let n=0;n<180;n++){step(w,STEP,{...read(),touchAim:true});leftShot||=w.projectiles.some(p=>p.owner==='player'&&p.vx<0&&p.vy<0);}
 assert.ok(leftShot);assert.equal(w.player.face,-1);ui.input.release(2);for(let n=0;n<70;n++)step(w,STEP,{...read(),touchAim:true});const casts=w.stats.casts;for(let n=0;n<180;n++)step(w,STEP,{...read(),touchAim:true});assert.equal(w.stats.casts,casts);assert.equal(read().attack,false);
});
