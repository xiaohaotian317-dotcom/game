import {AdvertisingPlatform,AD_PLACEMENTS} from './advertising-platform.mjs';
import {RELEASE_AD_POLICY,commitResultInterstitialReservation,resultInterstitialShownDraft,releaseFeatureEnabled} from './release-ad-policy.mjs';
import {campaignAdAttempt,campaignReviveChoice,commitCampaignAdRevive} from './campaign-ad-recovery.mjs';
export class CampaignOperations{
 constructor({resultDialog,getWorld,getProfile,onSave,onRecovered,notice,policy=RELEASE_AD_POLICY,provider=globalThis.arcaneMobile?.ads||globalThis.arcaneAds||null}){
  Object.assign(this,{resultDialog,getWorld,getProfile,onSave,onRecovered,notice,policy});this.ads=new AdvertisingPlatform(provider);this.busy=false;this.generation=0;
  this.reviveButton=document.createElement('button');this.reviveButton.type='button';this.reviveButton.hidden=true;this.reviveButton.className='campaign-revive-button';this.reviveButton.innerHTML='<i class="result-button-art" aria-hidden="true"></i><span>观看广告 · 续战</span>';resultDialog.querySelector('.result-actions').append(this.reviveButton);this.reviveButton.onclick=()=>this.openRevive();
 }
 async refresh(world){
  const generation=++this.generation;this.reviveButton.hidden=true;if(!campaignReviveChoice(world,this.getProfile(),{policy:this.policy}))return;
  try{const status=await this.ads.status();if(generation===this.generation&&this.getWorld()===world&&status.configured&&status.rewarded)this.reviveButton.hidden=false;}catch{}
 }
 openRevive(){
  const world=this.getWorld(),choice=campaignReviveChoice(world,this.getProfile(),{policy:this.policy});if(!choice||this.busy)return;
  const dialog=document.createElement('dialog');dialog.className='campaign-ad-choice';dialog.innerHTML='<button type="button" class="close" aria-label="关闭复活选择">×</button><h2>再燃战意</h2><p>自愿看完激励广告后，在原战场恢复当前英雄一半生命与法力。每次挑战限一次，不重置敌人或战利品。</p><label><input type="checkbox"> 我已阅读并同意<a href="mobile-privacy.html" target="_blank" rel="noopener noreferrer">隐私与广告说明</a></label><div><button type="button" data-return>返回结算</button><button type="button" data-watch>观看广告 · 续战</button></div><p role="status"></p>';document.body.append(dialog);
  const close=()=>{if(!this.busy)dialog.close();};dialog.querySelector('.close').onclick=close;dialog.querySelector('[data-return]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('[data-watch]').onclick=async()=>{
   if(this.busy)return;const message=dialog.querySelector('[role="status"]');if(!dialog.querySelector('input').checked){message.textContent='请先阅读并勾选隐私说明。';return;}
   this.busy=true;dialog.querySelectorAll('button').forEach(b=>b.disabled=true);message.textContent='正在请求广告，请稍候…';
   try{const result=await this.ads.showRewarded(AD_PLACEMENTS.revive,{privacyAccepted:true});if(!result.completed)throw Error('广告未完成，本次没有使用复活机会。');commitCampaignAdRevive({world,getWorld:this.getWorld,getProfile:this.getProfile,onSave:this.onSave,choice,adResult:result,policy:this.policy});dialog.close();this.resultDialog.close();this.reviveButton.hidden=true;this.onRecovered();}
   catch(error){message.textContent=error.message||'本次未复活，可返回结算。';}
   finally{this.busy=false;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);}
  };dialog.showModal();
 }
 async leave(navigate){
  if(this.busy)return;if(!releaseFeatureEnabled(this.policy,'result')){navigate();return;}
  const world=this.getWorld(),c=world?.campaign;if(!c||c.tower||c.mode==='tutorial'){navigate();return;}
  this.busy=true;try{
   const status=await this.ads.status();if(!status.configured||!status.interstitial||!status.privacyAccepted)return;
   // Settlement is persisted before reserving a request. Neither a failed
   // request nor a cancelled ad changes the underlying level reward.
   if(this.onSave(structuredClone(this.getProfile()))!==true)return;
   const context={attemptId:campaignAdAttempt(world),mode:c.petDungeon?'pet':c.mode||'story',settlementSaved:true,leaving:true,duel:false};
   const choice=commitResultInterstitialReservation({getProfile:this.getProfile,onSave:this.onSave,context,policy:this.policy});if(!choice)return;
   const result=await this.ads.showResultInterstitial({privacyAccepted:true,duel:false}),draft=resultInterstitialShownDraft(this.getProfile(),choice,result);if(draft)this.onSave(draft);
  }catch{this.notice?.('本次广告未显示，已保留关卡收益。');}
  finally{this.busy=false;navigate();}
 }
}
