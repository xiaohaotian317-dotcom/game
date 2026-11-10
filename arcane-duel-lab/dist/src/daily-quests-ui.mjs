import {dailyView,dailyDate,DAILY_REWARDS} from './daily-quests.mjs';
import {dailyChestChoice,commitDailyChest} from './daily-quest-rewards.mjs';
import {AdvertisingPlatform,AD_PLACEMENTS} from './advertising-platform.mjs';
import {dailyArtStyle,dailyTaskFrame,dailyProgressFill,dailyNodeLeft} from './daily-ui-art.mjs';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderDailyBoard(profile,now=new Date()){
 const view=dailyView(profile,now),available=view.tasks.find(t=>t.complete&&!t.claimed),full=view.count>=3;
 return `<div class="daily-intro"><div><small>THE DAILY COVENANT</small><h2>每日委托</h2><p>完成任意三项，手动打开上方宝箱领取。</p></div><div class="daily-total"><span>今日已领取</span><b>${view.total}<small> 金币</small></b><em>基础 ${view.baseTotal} / 500 · 广告额外 ${view.bonusTotal}</em></div></div>
 <section class="daily-rewards" aria-label="每日奖励进度"><div class="daily-rail" style="${dailyArtStyle('track')}"><div class="daily-progress" role="progressbar" aria-label="已领取宝箱" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${view.count}"><i style="width:${dailyProgressFill(view.count)}%"></i></div>${DAILY_REWARDS.map((reward,i)=>{const opened=view.count>i,ready=!full&&view.count===i&&!!available;return `<button type="button" class="daily-chest ${opened?'opened':ready?'ready':'locked'}" style="left:${dailyNodeLeft(i)}%" data-daily-tier="${i}" ${!ready?'disabled':''} aria-label="第${i+1}个宝箱 基础${reward}金币 ${opened?'已领取':ready?'可打开':'待完成任务'}"><i style="${dailyArtStyle('chest'+i+(opened?'Open':'Closed'))}"></i><b>${reward} <span>金币</span></b><small>${opened?'已领取':ready?'点击开启':`完成${i+1}项`}</small></button>`;}).join('')}</div></section>
 <div class="daily-list-heading"><h3>今日委托 <small>五选三</small></h3><span>${esc(view.day)} · 每日 00:00 更新</span></div><div class="daily-task-list">${view.tasks.map((t,i)=>`<article class="daily-task ${t.claimed?'claimed':t.complete?'complete':''}">${dailyTaskFrame()}<span class="daily-task-seal" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="daily-task-copy"><h4>${t.name}</h4><p>${t.description}</p></div><span class="daily-task-count">${t.current}<small> / ${t.goal}</small></span><span class="daily-task-state">${t.claimed?'已领取':full?'今日已领满':t.complete?'已完成':'进行中'}${t.complete&&!t.claimed&&!full?'<small>可领取上方宝箱</small>':''}</span></article>`).join('')}</div><p class="daily-bottom-note">基础酬金 100 / 100 / 300 · 自愿观看广告可将本次宝箱奖励翻倍，每日最多1000金币</p>`;
}

export class DailyQuestDialog{
 constructor({getProfile,onSave,onOpen=()=>{},onClose=()=>{},now=()=>new Date(),adsProvider=globalThis.arcaneMobile?.ads||globalThis.arcaneAds||null}){
  Object.assign(this,{getProfile,onSave,onOpen,onClose,now,choice:null,busy:false,adAvailable:false,request:0,rewardMessage:'',message:''});
  this.ads=new AdvertisingPlatform(adsProvider);
  this.dialog=document.createElement('dialog');this.dialog.className='daily-dialog';this.dialog.setAttribute('aria-label','每日任务');document.body.append(this.dialog);
  this.rewardDialog=document.createElement('dialog');this.rewardDialog.className='daily-claim-dialog';this.rewardDialog.setAttribute('aria-label','每日宝箱领取');document.body.append(this.rewardDialog);
  this.dialog.addEventListener('cancel',e=>{e.preventDefault();this.close();});
  this.dialog.addEventListener('close',()=>{clearInterval(this.timer);this.closeReward();this.onClose();});
  this.rewardDialog.addEventListener('cancel',e=>{e.preventDefault();this.closeReward();});
  this.rewardDialog.addEventListener('close',()=>{this.choice=null;this.request++;});
  this.dialog.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-daily-close'))return this.close();if(button.dataset.dailyTier!==undefined)this.openReward(Number(button.dataset.dailyTier));});
  this.rewardDialog.addEventListener('click',e=>{const button=e.target.closest('button');if(!button||button.disabled)return;if(button.hasAttribute('data-daily-claim-close'))return this.closeReward();if(button.hasAttribute('data-daily-claim-normal'))this.claim(false);if(button.hasAttribute('data-daily-claim-double'))this.claim(true);});
  this.rewardDialog.addEventListener('change',e=>{if(e.target.matches('[data-daily-ad-consent]'))this.refreshRewardControls();});
 }
 open(){if(this.dialog.open)return;this.onOpen();this.message='';this.render();this.dialog.showModal();this.timer=setInterval(()=>{if(dailyDate(this.now())!==this.day){this.closeReward();this.message='新的委托已送达，请查看今日宝箱';this.render();}},10000);}
 close(){this.closeReward();if(this.dialog.open)this.dialog.close();}
 closeReward(){this.choice=null;this.request++;if(this.rewardDialog.open)this.rewardDialog.close();}
 render(){this.day=dailyDate(this.now());this.dialog.innerHTML=`<button class="daily-close" data-daily-close aria-label="关闭每日任务">×</button><div class="daily-board">${renderDailyBoard(this.getProfile(),this.now())}</div><footer class="daily-footer"><span role="status">${esc(this.message)||'完成任务后，点击上方宝箱选择领取方式'}</span><button data-daily-close>返回游戏 ›</button></footer>`;}
 async openReward(tier){
  if(this.busy)return;
  try{this.choice=dailyChestChoice(this.getProfile(),tier,this.now());}catch(error){this.message=error.message;this.render();return;}
  this.adAvailable=false;this.rewardMessage='正在查看广告是否可用；可直接普通领取。';this.renderReward();this.rewardDialog.showModal();const token=++this.request;
  try{const status=await this.ads.status();if(token!==this.request||!this.rewardDialog.open)return;this.adAvailable=status?.configured===true&&status?.rewarded===true;this.rewardMessage=!this.choice.canDouble?'广告领取记录暂时无法核对，可直接普通领取。':this.adAvailable?'双倍领取为自愿选择，完整观看后发放；也可直接领取基础奖励。':'广告暂未开放，可直接领取基础奖励。';}
  catch{if(token===this.request)this.rewardMessage='广告暂时不可用，可直接领取基础奖励。';}
  if(token===this.request)this.refreshRewardControls();
 }
 renderReward(){
  const c=this.choice;if(!c)return;
  this.rewardDialog.innerHTML=`<button class="daily-claim-close" data-daily-claim-close aria-label="关闭宝箱领取">×</button><header><small>THE COVENANT'S TREASURE</small><h2>启封第 ${c.tier+1} 份酬金</h2></header><div class="daily-claim-treasure"><i aria-hidden="true" style="${dailyArtStyle('chest'+c.tier+'Closed')}"></i><div><span>本次基础酬金</span><strong>${c.reward}<small> 金币</small></strong><p>选择一种方式，领取后宝箱开启。</p></div></div><div class="daily-claim-actions"><button type="button" class="daily-claim-action ordinary" data-daily-claim-normal><span>领取</span><b>${c.reward} 金币</b></button><button type="button" class="daily-claim-action doubled" data-daily-claim-double disabled><span>看广告 · 双倍领取</span><b>${c.reward*2} 金币</b></button></div><label class="daily-ad-consent"><input type="checkbox" data-daily-ad-consent><span>自愿观看前，我已阅读并同意<a href="mobile-privacy.html">隐私与广告说明</a></span></label><p class="daily-claim-status" role="status" aria-live="polite"></p>`;
  this.refreshRewardControls();
 }
 refreshRewardControls(){
  if(!this.choice)return;const consent=this.rewardDialog.querySelector('[data-daily-ad-consent]')?.checked;
  this.rewardDialog.querySelector('[data-daily-claim-normal]').disabled=this.busy;
  this.rewardDialog.querySelector('[data-daily-claim-double]').disabled=this.busy||!this.adAvailable||!consent||!this.choice.canDouble;
  this.rewardDialog.querySelector('[data-daily-ad-consent]').disabled=this.busy;
  this.rewardDialog.querySelector('.daily-claim-status').textContent=this.rewardMessage;
 }
 async claim(double){
  if(this.busy||!this.choice)return;const choice={...this.choice};
  if(double&&(!this.adAvailable||!this.rewardDialog.querySelector('[data-daily-ad-consent]')?.checked))return;
  // Validate the current chest before requesting an ad or spending this choice.
  try{const latest=dailyChestChoice(this.getProfile(),choice.tier,this.now());if(latest.day!==choice.day||latest.taskId!==choice.taskId)throw Error('宝箱状态已变化，请重新打开');if(double&&!latest.canDouble)throw Error('广告领取记录暂时无法核对，可选择普通领取');}
  catch(error){this.rewardMessage=error.message;this.refreshRewardControls();return;}
  this.busy=true;this.rewardMessage=double?'广告正在播放，请等待播放结束并关闭。':'正在保存酬金…';this.refreshRewardControls();const token=++this.request;
  try{
   const adResult=double?await this.ads.showRewarded(AD_PLACEMENTS.coins,{privacyAccepted:true}):null;
   if(token!==this.request||!this.rewardDialog.open||!this.dialog.open)return;
   if(double&&!adResult.completed){this.rewardMessage='本次广告未完成，奖励未领取。可重试或选择普通领取。';return;}
   const result=commitDailyChest({getProfile:this.getProfile,onSave:this.onSave,choice,double,adResult,now:this.now()});
   this.message=`获得 ${result.reward} 金币${result.bonus?`（基础${result.base}＋广告额外${result.bonus}）`:''} · 今日累计 ${result.view.total} 金币`;
   this.closeReward();this.render();
  }catch(error){if(token===this.request&&this.rewardDialog.open)this.rewardMessage=error.message||'领取未完成，可选择普通领取。';}
  finally{this.busy=false;if(this.rewardDialog.open)this.refreshRewardControls();}
 }
}
