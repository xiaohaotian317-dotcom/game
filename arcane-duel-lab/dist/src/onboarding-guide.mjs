import {loadSolo,saveSolo} from './campaign-profile.mjs';
import {normalizeOnboarding} from './onboarding-state.mjs';
const visible=el=>el&&!el.hidden&&!el.closest('[inert]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden';
// A first-run guide must never intercept consent, official authentication,
// privacy or withdrawal controls, including before its refresh timer runs.
const serviceDialogOpen=()=>!!document.querySelector('.platform-safety-gate[open],.service-policy-view[open],.service-withdraw-dialog[open]');
export function installOnboarding(page,{storage=globalThis.localStorage,getProfile=()=>loadSolo(storage),persist=p=>saveSolo(storage,p),getWorld=()=>null,closeSystem=()=>{},openMenu=()=>{}}={}){
 if(typeof document==='undefined')return;
 let current,target,next,popoverHost,passive=false,last='',timer;
 const state=()=>normalizeOnboarding(getProfile().onboarding),set=patch=>{const profile=getProfile();profile.onboarding={...state(),...patch};if(!persist(profile)){bubble.querySelector('p').textContent='无法保存教学进度，请确认本机存储可用后重试。';return false;}last='';return true;};
 if(state().step==='done')return;
 if(!document.querySelector('[data-onboarding-style]')){const css=document.createElement('link');css.rel='stylesheet';css.href='onboarding.css';css.dataset.onboardingStyle='';document.head.append(css);}
 const layer=document.createElement('div');layer.className='guide-layer';layer.hidden=true;layer.setAttribute('popover','manual');layer.innerHTML='<div class="guide-focus"></div><section class="guide-bubble" aria-live="polite"><small>THE FIRST JOURNEY</small><h3></h3><p></p><button type="button" hidden>知道了</button><em></em></section>';document.body.append(layer);const focus=layer.querySelector('.guide-focus'),bubble=layer.querySelector('.guide-bubble'),button=bubble.querySelector('button');
 function hide(){layer.hidden=true;try{layer.hidePopover();}catch{}target=null;}
 function show(selector,title,copy,advance,label,coach=false){
  target=typeof selector==='string'?document.querySelector(selector):selector;if(!visible(target)){hide();return;}
  const key=state().step+':'+state().menuIndex+':'+title+':'+selector;
  if(key!==last){last=key;bubble.querySelector('h3').textContent=title;bubble.querySelector('p').textContent=copy;bubble.querySelector('em').textContent=advance?'':'点击高亮处继续';}
  next=advance;passive=coach;layer.classList.toggle('battle-coach',coach);button.hidden=!advance;button.textContent=label||'知道了';layer.hidden=false;
  if(layer.showPopover)try{const host=target.closest('dialog[open]')||document.body;if(host!==popoverHost||layer.parentNode!==host){try{layer.hidePopover();}catch{}host.append(layer);popoverHost=host;}layer.showPopover();}catch{}else{const d=target.closest('dialog[open]');if(d&&layer.parentNode!==d)d.append(layer);}
  const r=target.getBoundingClientRect(),pad=4;Object.assign(focus.style,{left:r.left-pad+'px',top:r.top-pad+'px',width:r.width+pad*2+'px',height:r.height+pad*2+'px'});
  const br=bubble.getBoundingClientRect(),width=br.width||270,height=br.height||145,candidates=[{x:r.right+14,y:r.top},{x:r.left-width-14,y:r.top},{x:r.left+(r.width-width)/2,y:r.bottom+14},{x:r.left+(r.width-width)/2,y:r.top-height-14}];
  const fit=p=>({x:Math.max(10,Math.min(innerWidth-width-10,p.x)),y:Math.max(10,Math.min(innerHeight-height-10,p.y))}),overlap=p=>Math.max(0,Math.min(p.x+width,r.right+8)-Math.max(p.x,r.left-8))*Math.max(0,Math.min(p.y+height,r.bottom+8)-Math.max(p.y,r.top-8));const best=candidates.map(fit).sort((a,b)=>overlap(a)-overlap(b))[0];
  bubble.style.left=Math.max(10,Math.min(innerWidth-width-10,best.x))+'px';bubble.style.top=Math.max(10,Math.min(innerHeight-height-10,best.y))+'px';
 }
 function refresh(){
  if(serviceDialogOpen()){hide();last='';return;}
  current=state();if(current.step==='done'){hide();clearInterval(timer);document.removeEventListener('click',capture,true);return;}
  const s=current.step;
  if(page==='title'){show('#start-button','踏入秘境','欢迎来到秘境决斗。先开始旅程，一起认识你的英雄与修行之路。',null);return;}
  if(page==='lobby'){
   if(['start','summon'].includes(s))show('.summon-card','英雄召唤','每位英雄都有独立卡池。点击这里先认识召唤券。',null);
   else if(['tickets','return-pool','shop'].includes(s))show('#shop-open','旅人商店','探索之外，这里可以领取自愿广告提供的基础补给。',null);
   else show('#stages-open','探索地图','从这里进入世界地图，先完成一场轻松的启程试炼。',null);
   return;
  }
  if(page==='summon'){
   if(['start','summon','tickets'].includes(s))show('.ticket-wallet','认识召唤券','召唤只消耗抽奖券，不消耗金币。单抽1券，十连最多10券；指定英雄20抽内必得。首领战利品可获得抽奖券。',()=>set({step:'return-pool'}),'记住了');
   else show('.back-button','回到大厅','先回大厅，再认识旅人商店。',null);
   return;
  }
  if(page==='shop'){
   if(!['return-shop','explore','map','battle','reward','menu','menus'].includes(s))show('#shop-rewards','自愿领取补给','可以选择金币、经验药水、基础灵石或抽奖券。只有完整看完广告才领取；广告没开放时也不影响正常闯关。',()=>set({step:'return-shop'}),'了解商店');
   else show('.shop-back','出发探索','回到大厅，进入探索地图。',null);
   return;
  }
  if(page!=='campaign')return;
  if(s==='battle'){
   const world=getWorld();if(world?.campaign?.training){hide();return;}if(world){if(world.campaign.state==='portal')show('#campaign-arena','试炼完成','靠近传送门，点击“结算”或按X完成教学。',null,null,true);else show('#campaign-arena','启程试炼','向右移动，使用普攻和第一个技能击败小兵。跳跃能越过平台，两波清完后前往传送门。',null,null,true);return;}
   if(visible(document.querySelector('#loading'))||visible(document.querySelector('#team-screen'))){hide();return;}set({step:'map'});return;
  }
  if(s==='reward'){if(!getWorld()&&!document.querySelector('#result-dialog[open]')){set({step:'menu'});return;}show('#result-primary','启程礼已到账','首次完成教学获得500金币。现在返回地图，认识行囊与修行菜单。',null);return;}
  if(s==='menu'){show('.map-menu-toggle','行囊与修行','点击这里展开菜单，角色成长、装备与技能都在其中。',null);return;}
  if(s==='menus'){
   const system=document.querySelector('#solo-system[open]'),daily=document.querySelector('.daily-dialog[open]');
   if(system||daily){closeSystem();return;}
   const menu=document.querySelector('#map-system-links');if(!visible(menu)){openMenu();hide();return;}
   show(menu,'行囊与修行','角色查看属性和装备，背包使用道具；技能学习招式，法器与灵宠助战；锻造提升装备，每日任务领取金币。',()=>set({step:'done'}),'开始自由探索');return;
  }
  if(visible(document.querySelector('#stage-detail[open]')))show('#enter-stage','进入启程试炼','这里有少量小兵。首次完成后可获得500金币。',null);
  else if(visible(document.querySelector('#team-screen'))){const ready=document.querySelector('[data-team-confirm]');if(ready?.disabled)show('[data-team-hero=fire]','选择焰术师','点击焰术师头像，加入第一个出战位置。',null);else show('[data-team-confirm]','准备出发','英雄已就位。点击开始挑战，进入启程试炼。',null);}
  else show('[data-stage="23"]','第一场试炼','点击启程试炼。先熟悉移动、跳跃和攻击，再探索正式秘境。',null);
 }
 function capture(e){if(serviceDialogOpen()||layer.hidden||passive||!target)return;if(bubble.contains(e.target))return;if(target.contains(e.target)&&!next){
   const s=state().step;let step;
   if(page==='title')step='summon';else if(page==='lobby')step=e.target.closest('#shop-open')?'shop-intro':e.target.closest('#stages-open')?'map':'tickets';else if(page==='summon')step='shop';else if(page==='shop')step='explore';
   else if(s==='reward')step='menu';else if(s==='menu')step='menus';else if(s==='menus')step='menus';else if(e.target.closest('[data-team-hero]'))step='team';else if(e.target.closest('[data-team-confirm]'))step='battle';else if(e.target.closest('#enter-stage'))step='team';else step='detail';
   if(!set({step})){e.preventDefault();e.stopImmediatePropagation();}setTimeout(refresh,0);return;
  }e.preventDefault();e.stopImmediatePropagation();}
 button.addEventListener('click',e=>{e.stopPropagation();next?.();refresh();});document.addEventListener('click',capture,true);window.addEventListener('resize',refresh);timer=setInterval(refresh,350);refresh();return {refresh};
}
