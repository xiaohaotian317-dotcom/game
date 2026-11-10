import {cameraView,worldPoint} from './camera.mjs';
import {clearLine} from './collision.mjs';
import {groundTarget} from './targeting.mjs';
import {controlLayout,applyControlLayout} from './mobile-preferences.mjs';
const instances=new Set();

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finite=n=>Number.isFinite(n);
const neutral=()=>({move:0,attack:false,down:false,artifact:false,aim:null});
const skillKeys=new Set(['q','e','r']);
const actionRoles=new Set(['jump','dash','pickup','settle','capture','interact','switch-0','switch-1','artifact-use']);
const center=p=>({x:p.x,y:p.y-(p.h||90)*.48});

// This state machine owns fingers independently. It has no browser or game side effects.
export class TouchInputState {
  constructor({deadZone=14,downThreshold=25,dragThreshold=12,joystickRadius=48}={}){
    Object.assign(this,{deadZone,downThreshold,dragThreshold,joystickRadius});
    this.pointers=new Map();this.owners=new Map();
  }
  press(id,role,point={x:0,y:0}){
    if(this.pointers.has(id)||this.owners.has(role)||!finite(point.x)||!finite(point.y))return null;
    const p={id,role,start:{...point},point:{...point},dragged:false,canceled:false,aim:null};
    this.pointers.set(id,p);this.owners.set(role,id);
    if(role==='artifact')return {action:'artifact-use'};
    return actionRoles.has(role)?{action:role}:null;
  }
  move(id,point,{canceled=false,aim=null}={}){
    const p=this.pointers.get(id);if(!p||!finite(point.x)||!finite(point.y))return false;
    p.point={...point};p.dragged||=Math.hypot(point.x-p.start.x,point.y-p.start.y)>=this.dragThreshold;
    p.canceled=Boolean(canceled);p.aim=aim;return true;
  }
  release(id,{cancel=false,aim=null}={}){
    const p=this.pointers.get(id);if(!p)return null;
    this.pointers.delete(id);this.owners.delete(p.role);
    if(skillKeys.has(p.role)&&!cancel&&!p.canceled)return {action:p.role,aim:aim||p.aim};
    return null;
  }
  pointerFor(role){return this.pointers.get(this.owners.get(role))||null;}
  get activeSkill(){return [...this.pointers.values()].find(p=>skillKeys.has(p.role))||null;}
  read(aim=null){
    const s=neutral(),p=this.pointerFor('joystick');
    if(p){const dx=p.point.x-p.start.x,dy=p.point.y-p.start.y;s.move=Math.abs(dx)>this.deadZone?Math.sign(dx):0;s.down=dy>this.downThreshold;}
    s.attack=this.owners.has('attack');s.artifact=this.owners.has('artifact');
    s.aim=this.activeSkill?.aim||aim;return s;
  }
  reset(){this.pointers.clear();this.owners.clear();}
}

export function skillAimKind(hero,key,skill={}){
  if(['direction','ground','self'].includes(skill.kind))return skill.kind;
  const alternate=skill.id?.endsWith('-1');
  if(alternate){
    if(key==='q')return hero==='fire'?'ground':'direction';
    if(key==='e')return ['nature','star'].includes(hero)?'self':'direction';
    return hero==='lightning'?'self':'ground';
  }
  if(key==='q')return ['fire','nature','frost','star'].includes(hero)?'ground':'direction';
  if(key==='e')return ['nature','frost'].includes(hero)?'self':['fire','lightning'].includes(hero)?'direction':'ground';
  return 'ground';
}

function projectGround(w,point){
  const hit=groundTarget({...w,platforms:w.platforms||[]},point.x,point.y);
  return hit?{x:hit.x,y:hit.y}:point;
}

export function assistAim(w,{kind='direction',range=680,terrain=true,frontOnly=false}={}){
  const p=w?.player;if(!p)return null;
  const origin=center(p),face=p.face<0?-1:1,view=cameraView(w);
  if(kind==='self')return origin;
  const candidates=(w.targets||[]).filter(t=>{
    if(!t||t===p||t.hp<=0||t.targetable===false||t.hidden===true||(t.deadUntil||0)>(w.time||0))return false;
    const c=center(t),dx=c.x-origin.x,dy=c.y-origin.y;
    if(c.x<view.x||c.x>view.x+view.width||c.y<view.y-30||c.y>view.y+view.height+30||Math.hypot(dx,dy)>range)return false;
    if(frontOnly&&dx*face<-(p.w||20)-(t.w||20))return false;
    return !terrain||clearLine({...w,platforms:w.platforms||[]},origin.x,origin.y,c.x,c.y);
  });
  // Facing is a preference for spells, a restriction only for forward basic attacks.
  candidates.sort((a,b)=>{
    const score=t=>Math.hypot(t.x-origin.x,center(t).y-origin.y)+((t.x-p.x)*face<0?range*.25:0);
    return score(a)-score(b);
  });
  const t=candidates[0];
  const point=t?center(t):worldPoint(w,(origin.x+face*Math.min(300,view.width*.3)-view.x)/view.width,(origin.y-view.y)/view.height);
  return kind==='ground'?projectGround(w,t?{x:t.x,y:t.y-.1}:point):point;
}

export function dragAim(w,start,point,{kind='direction',radius=100,range}={}){
  if(!w?.player)return null;
  const origin=center(w.player),view=cameraView(w);
  if(kind==='self')return origin;
  const dx=point.x-start.x,dy=point.y-start.y,d=Math.hypot(dx,dy);
  if(d<.001)return assistAim(w,{kind,terrain:false});
  const distance=clamp(d/radius,0,1)*(range||Math.min(700,view.width*.52));
  const aim=worldPoint(w,(origin.x+dx/d*distance-view.x)/view.width,(origin.y+dy/d*distance-view.y)/view.height);
  return kind==='ground'?projectGround(w,aim):aim;
}

export function hasNearbyInteraction(w){
  const p=w?.player,m=w?.mechanisms;if(!p||!m)return false;
  const list=[];if(w.mirror?.enabled)list.push({x:w.mirror.x,y:w.mirror.y+35});
  if(m.lift)list.push({x:m.lift.switchX,y:m.lift.switchY});if(m.valve)list.push(m.valve);
  if(m.wind)list.push(m.wind);if(m.vine)list.push({x:m.vine.budX,y:m.vine.budY});
  return list.some(a=>Math.hypot(a.x-p.x,a.y-(p.y-55))<150);
}

const names={attack:'普攻',jump:'跳跃',dash:'闪避',q:'技艺',e:'秘术',r:'终式',pickup:'拾取',settle:'结算',capture:'捕捉',interact:'交互',artifact:'法器'};

export function mobileControlsMarkup(){return `<div class="mobile-joystick" data-mobile-role="joystick" aria-label="移动摇杆"><span class="mobile-stick-runes"></span><span class="mobile-stick-knob"></span><span class="mobile-stick-down">下落</span></div><div class="mobile-action-cluster">${['attack','jump','dash','q','e','r'].map(role=>`<button type="button" class="mobile-control mobile-${role}" data-mobile-role="${role}" aria-label="${names[role]}"><i class="mobile-control-icon"></i><span class="mobile-control-name">${names[role]}</span><span class="mobile-control-cooldown"></span></button>`).join('')}</div><button type="button" class="mobile-control mobile-artifact" data-mobile-role="artifact" aria-label="法器"><i class="mobile-control-icon"></i><span class="mobile-control-name">法器</span></button><button type="button" class="mobile-control mobile-context" hidden><span class="mobile-control-name"></span></button><button type="button" class="mobile-pause" data-mobile-role="pause" aria-label="暂停"><span>Ⅱ</span></button><div class="mobile-cancel" hidden><span>×</span>移入取消</div><div class="mobile-aim-line" hidden></div><div class="mobile-aim-reticle" hidden><span></span></div>`;}

/** Static preview shares the exact live icon markup, with no input listeners. */
export function createMobileControlPreview({document=globalThis.document,model={}}={}){
 const live=[...instances].reverse().find(v=>v.model.visible);
 const root=live?live.root.cloneNode(true):document.createElement('div');
 if(!live){root.className='mobile-controls';root.innerHTML=mobileControlsMarkup();root.dataset.hero=model.hero||'fire';for(const key of ['attack','dash','q','e','r']){const b=root.querySelector('[data-mobile-role="'+key+'"]'),s=model.skills?.[key];if(s){b.querySelector('.mobile-control-name').textContent=s.name||names[key];MobileControls.prototype.setIcon(b,s.style);}}}
 root.hidden=false;root.classList.add('mobile-editor-controls');root.querySelectorAll('.mobile-pause,.mobile-cancel,.mobile-aim-line,.mobile-aim-reticle,.mobile-layout-safe-area').forEach(e=>e.remove());
 for(const e of root.querySelectorAll('[data-mobile-role]')){e.disabled=false;e.classList.remove('is-held','is-cooling','is-locked');e.querySelector('.mobile-control-cooldown')?.replaceChildren();}
 root.querySelector('.mobile-artifact').hidden=false;const context=root.querySelector('.mobile-context');context.hidden=false;context.dataset.mobileRole='context';context.querySelector('.mobile-control-name').textContent='交互';return root;
}

export class MobileControls {
  constructor({canvas,getWorld,onAction=()=>{},onPause=()=>{},mode='campaign',mount}={}){
    if(!canvas||typeof getWorld!=='function')throw new TypeError('MobileControls requires canvas and getWorld');
    this.canvas=canvas;this.getWorld=getWorld;this.onAction=onAction;this.onPause=onPause;
    this.document=canvas.ownerDocument;this.window=this.document.defaultView;this.input=new TouchInputState();
    this.editing=false;this.layout=controlLayout();instances.add(this);
    this.model={visible:false,paused:false,hero:'fire',skills:{},context:{}};this.listeners=[];
    const root=this.document.createElement('div');this.root=root;root.className='mobile-controls';root.hidden=true;root.dataset.mode=mode;
    root.setAttribute('aria-label','触屏战斗操作');
    root.innerHTML=mobileControlsMarkup();
    (mount||this.document.body).append(root);
    this.buttons=new Map([...root.querySelectorAll('[data-mobile-role]')].map(el=>[el.dataset.mobileRole,el]));
    this.contextButton=root.querySelector('.mobile-context');this.knob=root.querySelector('.mobile-stick-knob');
    this.cancel=root.querySelector('.mobile-cancel');this.reticle=root.querySelector('.mobile-aim-reticle');this.line=root.querySelector('.mobile-aim-line');
    this.listen(root,'pointerdown',event=>this.pointerDown(event),{capture:true,passive:false});
    this.listen(this.window,'pointermove',event=>this.pointerMove(event),{capture:true,passive:false});
    this.listen(this.window,'pointerup',event=>this.pointerUp(event),{capture:true,passive:false});
    this.listen(this.window,'pointercancel',event=>this.pointerUp(event,true),{capture:true,passive:false});
    this.listen(root,'lostpointercapture',event=>{if(this.input.pointers.has(event.pointerId))this.pointerUp(event,true);},true);
    this.listen(root,'contextmenu',event=>event.preventDefault());
    this.listen(root,'click',event=>{event.preventDefault();event.stopPropagation();},true);
    this.listen(this.window,'blur',()=>this.reset());
    this.listen(this.document,'visibilitychange',()=>{if(this.document.hidden)this.reset();});
    this.listen(this.window,'resize',()=>{this.reset();this.applyLayout();});
    if(this.window.visualViewport)this.listen(this.window.visualViewport,'resize',()=>{this.reset();this.applyLayout();});
    this.applyLayout();
    if(this.window.ResizeObserver){this.layoutObserver=new this.window.ResizeObserver(()=>{this.reset();if(this.enabled)this.applyLayout();});this.layoutObserver.observe(this.root.querySelector('.mobile-layout-safe-area'));}
    if(this.window.MutationObserver){this.insetsObserver=new this.window.MutationObserver(()=>{if(this.enabled)this.applyLayout();});this.insetsObserver.observe(this.document.documentElement,{attributes:true,attributeFilter:['style']});}
    this.listen(this.window,'arcane-control-layout-changed',()=>{this.reset();this.layout=controlLayout();this.applyLayout();});
    this.listen(this.window,'arcane-controls-edit',e=>{this.editing=Boolean(e.detail?.active);this.reset();this.root.hidden=!this.enabled;if(this.enabled)this.applyLayout();});
  }
  listen(target,type,fn,options){target.addEventListener(type,fn,options);this.listeners.push(()=>target.removeEventListener(type,fn,options));}
  get enabled(){return this.model.visible&&!this.model.paused&&!this.editing;}
  applyLayout(){applyControlLayout(this.root,this.layout);}
  point(event){return {x:event.clientX,y:event.clientY};}
  block(event){if(event.cancelable)event.preventDefault();event.stopPropagation();}
  emit(record){if(record)this.onAction(record.action,{aim:record.aim||null,source:'touch'});}
  aimFor(p){
    const w=this.getWorld();if(!w)return null;
    const kind=p.role==='artifact'?'ground':skillAimKind(this.model.hero,p.role,this.model.skills[p.role]);
    return p.dragged?dragAim(w,p.start,p.point,{kind}):assistAim(w,{kind,terrain:false});
  }
  pointerDown(event){
    const button=event.target.closest?.('[data-mobile-role]');if(!button||!this.root.contains(button))return;
    this.block(event);if(!this.enabled||button.disabled)return;
    const role=button.dataset.mobileRole;
    if(role==='pause'){this.reset();this.onPause();return;}
    if(this.input.owners.has(role)||this.input.pointers.has(event.pointerId))return;
    const result=this.input.press(event.pointerId,role,this.point(event));
    const p=this.input.pointers.get(event.pointerId);if(!p)return;
    p.element=button;try{button.setPointerCapture(event.pointerId);}catch{}
    if(skillKeys.has(role)||role==='artifact'){p.aim=this.aimFor(p);if(role!=='artifact')this.cancel.hidden=false;}
    this.emit(result);button.classList.add('is-held');this.refreshVisuals();
  }
  pointerMove(event){
    const p=this.input.pointers.get(event.pointerId);if(!p)return;
    this.block(event);const point=this.point(event);let canceled=false;
    if(skillKeys.has(p.role)){
      const r=this.cancel.getBoundingClientRect();canceled=point.x>=r.left&&point.x<=r.right&&point.y>=r.top&&point.y<=r.bottom;
      canceled||=point.x<0||point.y<0||point.x>this.window.innerWidth||point.y>this.window.innerHeight;
    }
    this.input.move(event.pointerId,point,{canceled});
    if(skillKeys.has(p.role)||p.role==='artifact')p.aim=this.aimFor(p);
    this.refreshVisuals();
  }
  pointerUp(event,cancel=false){
    const p=this.input.pointers.get(event.pointerId);if(!p)return;
    this.block(event);
    if(!cancel&&finite(event.clientX)&&finite(event.clientY))this.pointerMove(event);
    const result=this.input.release(event.pointerId,{cancel:cancel||!this.enabled,aim:skillKeys.has(p.role)?this.aimFor(p):null});
    p.element?.classList.remove('is-held');try{p.element?.releasePointerCapture(event.pointerId);}catch{}
    this.emit(result);this.refreshVisuals();
  }
  read(){
    if(!this.enabled)return neutral();
    const w=this.getWorld();if(!w?.player)return neutral();
    const skill=this.input.activeSkill,artifact=this.input.pointerFor('artifact');if(skill)skill.aim=this.aimFor(skill);if(artifact)artifact.aim=this.aimFor(artifact);
    const aim=artifact?.aim||(this.input.pointerFor('attack')?assistAim(w,{terrain:true,frontOnly:false}):null);
    this.refreshVisuals();return this.input.read(aim);
  }
  update(patch={}){
    const previous=this.model;
    this.model={...previous,...patch,skills:patch.skills?{...previous.skills,...patch.skills}:previous.skills,context:patch.context||previous.context};
    this.root.hidden=!this.enabled;this.root.dataset.hero=this.model.hero;
    if(this.enabled&&(!previous.visible||previous.paused))this.applyLayout();
    if(!this.enabled){this.reset();return;}
    for(const key of ['attack','dash',...skillKeys]){
      const skill=this.model.skills[key]||{},button=this.buttons.get(key),cooldown=Math.max(0,Number(skill.cooldown)||0);
      button.disabled=Boolean(skill.locked);button.classList.toggle('is-cooling',cooldown>0);button.classList.toggle('is-locked',Boolean(skill.locked));
      button.querySelector('.mobile-control-name').textContent=skill.name||names[key];
      button.querySelector('.mobile-control-cooldown').textContent=skill.locked?'未解锁':cooldown>0?String(Math.ceil(cooldown)):'';
      this.setIcon(button,skill.style);
      if(skill.locked){const p=this.input.pointerFor(key);if(p)this.cancelPointer(p);}
    }
    const context=this.model.context,contextRole=['pickup','capture','interact','settle'].find(key=>context[key]);
    this.contextButton.hidden=!contextRole;
    if(contextRole){this.contextButton.dataset.mobileRole=contextRole;this.contextButton.querySelector('span').textContent=typeof context[contextRole]==='string'?context[contextRole]:names[contextRole];}
    else delete this.contextButton.dataset.mobileRole;
    if(contextRole!==this.contextRole||Boolean(context.artifact)!==Boolean(previous.context.artifact)){this.applyLayout();this.contextRole=contextRole;}
    // The mirror and held sword share the same physical slot; simulation decides use semantics.
    const artifact=this.buttons.get('artifact');artifact.hidden=!context.artifact;
    if(context.artifact&&typeof context.artifact==='object'){
      artifact.querySelector('.mobile-control-name').textContent=context.artifact.name||'法器';this.setIcon(artifact,context.artifact.style);
    }
    for(const p of [...this.input.pointers.values()]){
      if((['pickup','capture','interact','settle'].includes(p.role)&&p.role!==contextRole)||(p.role==='artifact'&&!context.artifact))this.cancelPointer(p);
    }
    this.refreshVisuals();
  }
  setIcon(button,style){
    if(style===undefined)return;
    const icon=button.querySelector('.mobile-control-icon');
    if(typeof style==='string'){
      if(/(?:^|;)\s*(?:--|[a-z-]+)\s*:/i.test(style)&&!/^https?:/i.test(style)){if(icon.getAttribute('style')!==style)icon.setAttribute('style',style);}
      else icon.style.backgroundImage=style?`url("${style.replaceAll('"','%22')}")`:'';
    }else if(style&&typeof style==='object'){for(const [key,value]of Object.entries(style))icon.style[key]=value;}
  }
  cancelPointer(p){this.input.release(p.id,{cancel:true});p.element?.classList.remove('is-held');try{p.element?.releasePointerCapture(p.id);}catch{}}
  refreshVisuals(){
    const p=this.input.pointerFor('joystick');let x=0,y=0;
    if(p){x=p.point.x-p.start.x;y=p.point.y-p.start.y;const d=Math.hypot(x,y),scale=Math.min(1,this.input.joystickRadius/Math.max(1,d));x*=scale;y*=scale;}
    this.knob.style.transform=`translate(${x}px, ${y}px)`;
    const skill=this.input.activeSkill||(this.input.pointerFor('artifact')?.dragged?this.input.pointerFor('artifact'):null);this.cancel.hidden=!this.input.activeSkill;this.cancel.classList.toggle('is-canceling',Boolean(skill?.canceled));
    const w=this.getWorld(),aim=skill?.aim;
    this.reticle.hidden=!aim||Boolean(skill?.canceled);this.line.hidden=this.reticle.hidden;
    if(!aim||!w||!w.player)return;
    const v=cameraView(w),rect=this.canvas.getBoundingClientRect(),origin=center(w.player);
    const px=rect.left+(aim.x-v.x)/v.width*rect.width,py=rect.top+(aim.y-v.y)/v.height*rect.height;
    const ox=rect.left+(origin.x-v.x)/v.width*rect.width,oy=rect.top+(origin.y-v.y)/v.height*rect.height;
    this.reticle.style.left=`${px}px`;this.reticle.style.top=`${py}px`;
    this.reticle.dataset.kind=skill.role==='artifact'?'ground':skillAimKind(this.model.hero,skill.role,this.model.skills[skill.role]);
    this.line.style.left=`${ox}px`;this.line.style.top=`${oy}px`;this.line.style.width=`${Math.hypot(px-ox,py-oy)}px`;this.line.style.transform=`rotate(${Math.atan2(py-oy,px-ox)}rad)`;
  }
  reset(){
    for(const p of [...this.input.pointers.values()])this.cancelPointer(p);
    this.input.reset();this.cancel.hidden=true;this.reticle.hidden=true;this.line.hidden=true;this.knob.style.transform='translate(0px, 0px)';
    this.root.querySelectorAll('.is-held').forEach(el=>el.classList.remove('is-held'));
  }
  destroy(){instances.delete(this);this.layoutObserver?.disconnect();this.insetsObserver?.disconnect();this.reset();this.listeners.forEach(remove=>remove());this.listeners.length=0;this.root.remove();}
}

export const mountMobileControls=options=>new MobileControls(options);

