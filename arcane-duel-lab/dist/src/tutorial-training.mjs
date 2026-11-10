import {cameraView} from './camera.mjs';
import {TRAINING_STEPS} from './tutorial-training-state.mjs';
const lessons={
 move:{title:'左右移动',role:'joystick',desktop:'按 A / D 或左右方向键，向左和向右各走一小段。',touch:'拖动左侧摇杆，向左和向右各走一小段。'},
 jump:{title:'跃起',role:'jump',desktop:'按一次空格起跳。',touch:'点一下“跳跃”，让英雄离开地面。'},
 doubleJump:{title:'空中二段跳',role:'jump',desktop:'在空中再按一次空格，完成二段跳。落地后也可重新尝试。',touch:'还在空中时再点一次“跳跃”。落地后可重新起跳再试。'},
 dash:{title:'闪避',role:'dash',desktop:'按 Shift 施放共用闪避，快速移开并短暂避伤。',touch:'点击“闪避”，快速移开并短暂避伤。'},
 approach:{title:'向前探索',role:'joystick',desktop:'按 D 向右前进，走近前方小怪，学习攻击。',touch:'摇杆向右推动，走近前方小怪，学习攻击。'},
 attack:{title:'普通攻击',role:'attack',desktop:'朝目标移动鼠标，按住左键连续普攻。成功放出一次攻击。',touch:'按住“普攻”连续攻击；按住滑动可调整方向，松手停止。'},
 skill:{title:'释放第一个技能',role:'q',desktop:'将鼠标指向敌人脚下，按 F 成功释放一次初始技能。',touch:'点按第一个技能；也可按住拖动瞄准，松手释放。成功施放一次。'},
 complete:{title:'基础操作已掌握',role:null,desktop:'清理两波小兵后向右前进，靠近传送门按 X 结算。',touch:'清理两波小兵后向右前进，靠近传送门点击“结算”。'}
};
const overlaps=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
export class TutorialTrainingGuide{
 constructor({getWorld,getMobile=()=>null,isPaused=()=>false,document=globalThis.document}={}){
  Object.assign(this,{getWorld,getMobile,isPaused,document,lastKey:'',lastAt:0});if(!document)return;
  if(!document.querySelector('[data-tutorial-training-style]')){const style=document.createElement('link');style.rel='stylesheet';style.href='tutorial-training.css';style.dataset.tutorialTrainingStyle='';document.head.append(style);}
  this.root=document.createElement('aside');this.root.className='tutorial-training-note';this.root.hidden=true;this.root.setAttribute('role','status');this.root.setAttribute('aria-live','polite');this.root.innerHTML='<small>启程演练</small><strong></strong><p></p><span></span>';document.body.append(this.root);
 }
 hide(){if(this.root)this.root.hidden=true;this.highlight?.classList.remove('training-control-focus');this.highlight=null;}
 update(){
  const w=this.getWorld?.(),t=w?.campaign?.training;if(!this.root||!t||this.isPaused()||['complete','defeat'].includes(w.campaign.state)){this.hide();return;}
  const mobile=this.getMobile?.(),touch=!!mobile?.enabled,lesson=lessons[t.step]||lessons.move,key=t.step+':'+t.left+':'+t.right+':'+touch;
  if(key!==this.lastKey){this.lastKey=key;this.root.dataset.step=t.step;this.root.querySelector('strong').textContent=lesson.title;this.root.querySelector('p').textContent=touch?lesson.touch:lesson.desktop;this.root.querySelector('span').textContent=t.step==='move'?`${t.left?'✓':'○'} 向左　${t.right?'✓':'○'} 向右`:`${TRAINING_STEPS.indexOf(t.step)+1} / ${TRAINING_STEPS.length} · 做一次即可继续`;}
  const target=touch&&lesson.role?mobile.buttons.get(lesson.role):null;if(target!==this.highlight){this.highlight?.classList.remove('training-control-focus');this.highlight=target;target?.classList.add('training-control-focus');}
  this.root.hidden=false;const now=globalThis.performance?.now?.()||Date.now();if(now-this.lastAt<80)return;this.lastAt=now;this.place(w,mobile);
 }
 place(w,mobile){
  const win=this.document.defaultView,width=win.innerWidth,height=win.innerHeight,r=this.root.getBoundingClientRect(),cw=r.width||300,ch=r.height||90,view=cameraView(w),canvas=this.document.querySelector('#campaign-arena'),c=canvas?.getBoundingClientRect();
  const blocks=[];if(c){const p=w.player,sx=c.width/view.width,sy=c.height/view.height;blocks.push({x:c.left+(p.x-view.x-65)*sx,y:c.top+(p.y-view.y-p.h-35)*sy,width:130*sx,height:(p.h+50)*sy});}
  for(const el of [this.document.querySelector('#party-hud'),this.document.querySelector('#solo-toolbar'),this.document.querySelector('#pause'),...(mobile?.enabled?[...mobile.buttons.values()]:[])])if(el&&!el.hidden&&el.getClientRects().length){const b=el.getBoundingClientRect();blocks.push({x:b.left,y:b.top,width:b.width,height:b.height});}
  const clamp=(n,a,b)=>Math.max(a,Math.min(Math.max(a,b),n)),candidates=[{x:(width-cw)/2,y:66},{x:(width-cw)/2,y:12},{x:(width-cw)/2,y:height-ch-12},{x:12,y:height*.38},{x:width-cw-12,y:height*.38}].map(p=>({x:clamp(p.x,8,width-cw-8),y:clamp(p.y,8,height-ch-8),width:cw,height:ch}));
  const score=p=>blocks.reduce((sum,b)=>sum+overlaps(p,b),0),best=candidates.sort((a,b)=>score(a)-score(b))[0];this.root.style.left=best.x+'px';this.root.style.top=best.y+'px';
 }
 destroy(){this.hide();this.root?.remove();}
}
