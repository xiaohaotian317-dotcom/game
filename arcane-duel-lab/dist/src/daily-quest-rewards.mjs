import {operationReceiptUsed} from './release-ad-policy.mjs';
import {dailyView,dailyDate,claimDaily,DAILY_REWARDS,DAILY_AD_RECEIPT_LIMIT,validDailyAdReceipt} from './daily-quests.mjs';

/** Capture a chest choice only. No task click, dialog opening or SDK status awards coins. */
export function dailyChestChoice(profile,tier,now=new Date()){
 const view=dailyView(structuredClone(profile),now),task=view.tasks.find(t=>t.complete&&!t.claimed);
 if(!Number.isInteger(tier)||tier!==view.count||tier<0||tier>=DAILY_REWARDS.length||!task)throw Error('这个宝箱尚不可领取');
 return {day:view.day,tier,taskId:task.id,reward:DAILY_REWARDS[tier],canDouble:!view.adBlocked&&view.adReceipts.length<DAILY_AD_RECEIPT_LIMIT};
}

/** Prepare one complete local transaction, preserving the current real profile. */
export function dailyRewardDraft(profile,choice,{double=false,adResult=null,now=new Date()}={}){
 if(choice?.day!==dailyDate(now))throw Error('已经跨天，请重新打开今日宝箱；本次未领取奖励');
 const next=structuredClone(profile),view=dailyView(next,now);
 if(!Number.isInteger(choice.tier)||choice.tier!==view.count||choice.reward!==DAILY_REWARDS[choice.tier])throw Error('宝箱状态已变化，请重新查看；本次未重复领取');
 const task=view.tasks.find(t=>t.id===choice.taskId);
 if(!task||!task.complete||task.claimed)throw Error('这项委托尚未完成或已经领取');
 if(double){
  if(adResult?.completed!==true||!validDailyAdReceipt(adResult.receipt)||adResult.placement!==undefined&&adResult.placement!=='reward-coins')throw Error('广告尚未完成，本次未领取奖励，可继续普通领取');
  if(view.adBlocked)throw Error('广告领取记录暂时无法核对，可选择普通领取');
  if(operationReceiptUsed(profile,adResult.receipt))throw Error('这次广告奖励已经使用，可重新选择领取方式');
  if(view.adReceipts.length>=DAILY_AD_RECEIPT_LIMIT)throw Error('广告领取记录已满，可选择普通领取');
 }
 const base=claimDaily(next,choice.taskId,now).reward;
 if(double){next.daily.adReceipts.push(adResult.receipt);next.daily.adBonuses.push({taskId:choice.taskId,coins:base,receipt:adResult.receipt});next.coins+=base;}
 // The formal Solo profile caps coins at 10,000,000; do not consume a chest
 // when normalization would silently truncate any part of the reward.
 if(!Number.isSafeInteger(next.coins)||next.coins>10000000)throw Error('金币已接近存档上限，请先使用部分金币后再领取');
 const updated=dailyView(next,now);return {profile:next,reward:base*(double?2:1),base,bonus:double?base:0,view:updated};
}

/** onSave is the existing lobby/campaign transaction exit; it updates live memory. */
export function commitDailyChest({getProfile,onSave,choice,double=false,adResult=null,now=new Date()}={}){
 if(typeof getProfile!=='function'||typeof onSave!=='function')throw Error('存档暂时不可用，本次未领取');
 const result=dailyRewardDraft(getProfile(),choice,{double,adResult,now});
 if(onSave(result.profile)===false)throw Error('存档写入失败，宝箱未领取，请重试');
 return result;
}
