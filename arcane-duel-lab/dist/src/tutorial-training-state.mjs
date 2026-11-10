// Pure progress/state helpers; safe for profile normalization without simulation imports.
export const TRAINING_STEPS=['move','jump','doubleJump','dash','approach','attack','skill','complete'];
export const TUTORIAL_ENEMY_LEAD=600,TUTORIAL_ATTACK_DISTANCE=480;
const controls={move:['joystick'],jump:['jump'],doubleJump:['jump'],dash:['dash'],approach:['joystick'],attack:['attack'],skill:['q']};
export function normalizeTutorialTraining(raw){const step=TRAINING_STEPS.includes(raw?.step)?raw.step:'move';return {version:2,step,left:step!=='move'||raw?.left===true,right:step!=='move'||raw?.right===true,...(step==='approach'&&['attack','skill'].includes(raw?.resumeStep)?{resumeStep:raw.resumeStep}:{})};}
export function initTutorialTraining(w){if(w.campaign?.mode!=='tutorial')return;const saved=normalizeTutorialTraining(w.campaign.progression?.tutorialTraining);if(['attack','skill'].includes(saved.step)){saved.resumeStep=saved.step;saved.step='approach';}w.campaign.training={...saved,leftDistance:0,rightDistance:0};if(saved.step!=='complete')w.campaign.noticeUntil=0;}
export const tutorialAllowedControls=w=>controls[w.campaign?.training?.step]||null;
export const tutorialCombatReady=w=>!w.campaign?.training||TRAINING_STEPS.indexOf(w.campaign.training.step)>=TRAINING_STEPS.indexOf('approach');
export const tutorialTrainingComplete=w=>!w.campaign?.training||w.campaign.training.step==='complete';
export function tutorialTrainingInput(w,input){const state=w.campaign?.training;if(!state||state.step==='complete')return input;const allowed=tutorialAllowedControls(w)||[];return {...input,move:allowed.includes('joystick')?input.move:0,jump:allowed.includes('jump')&&input.jump,dash:allowed.includes('dash')&&input.dash,attack:allowed.includes('attack')&&input.attack,cast:allowed.includes('q')&&input.cast==='q'?'q':undefined,artifact:false,switchSlot:undefined,pickup:false,settle:false,capture:false,interact:false,drop:false,down:false};}
export function tutorialActionSnapshot(w){const p=w.player;return {time:w.time,x:p.x,jumps:p.jumps,jumpAt:p.jumpAt,dash:p.dash,cast:p.cast?{id:p.cast.id,key:p.cast.key,released:p.cast.released}:null};}
export function observeTutorialTraining(w,before,input){
 const c=w.campaign,t=c?.training,p=w.player;if(!t||t.step==='complete'||w.time<=before.time||p.hp<=0)return false;
 const prior=normalizeTutorialTraining(t);let done=false;
 if(t.step==='move'){
  const dx=p.x-before.x;if(!(p.dash>0)&&!(before.dash>0)&&Math.abs(dx)<40){if(input.move<0&&dx<0)t.leftDistance-=dx;if(input.move>0&&dx>0)t.rightDistance+=dx;}
  if(t.leftDistance>=40)t.left=true;if(t.rightDistance>=40)t.right=true;done=t.left&&t.right;
 }else if(t.step==='jump'||t.step==='doubleJump')done=p.jumpAt>before.jumpAt&&p.vy<0&&!p.grounded&&p.jumps===(t.step==='jump'?1:2);
 else if(t.step==='dash')done=p.dash>0&&!(before.dash>0)&&p.invuln>0&&Math.abs(p.x-before.x)>0;
 else if(t.step==='approach')done=c.encounter>0&&w.targets.some(e=>e.enemyKind&&e.hp>0&&!e.fallingSpawn&&e.grounded&&Math.abs(e.x-p.x)<=TUTORIAL_ATTACK_DISTANCE&&Math.abs(e.y-p.y)<120);
 else if(t.step==='attack'||t.step==='skill'){const cast=p.cast;done=cast?.key===(t.step==='attack'?'attack':'q')&&cast.released&&(!before.cast||cast.id!==before.cast.id||!before.cast.released);}
 if(done){t.step=t.step==='approach'&&t.resumeStep?t.resumeStep:TRAINING_STEPS[TRAINING_STEPS.indexOf(t.step)+1];delete t.resumeStep;if(['jump','attack','skill'].includes(t.step))p.vx=0;}
 const next=normalizeTutorialTraining(t),changed=JSON.stringify(next)!==JSON.stringify(prior);
 if(changed){if(c.progression)c.progression.tutorialTraining=next;c.dirty=true;}
 return changed;
}
