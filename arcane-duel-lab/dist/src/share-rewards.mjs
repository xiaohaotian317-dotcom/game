import {addItem} from './campaign-profile.mjs';
import {RELEASE_AD_POLICY,normalizeOperations,releaseFeatureEnabled,validOperationId,operationsDay,OPERATION_RECORD_LIMIT} from './release-ad-policy.mjs';

function shareReward(policy){
 const r=policy?.share?.reward||{},coins=r.coins??0,tickets=r.tickets??0,items=r.items??[];
 if(!Number.isSafeInteger(coins)||coins<0||!Number.isSafeInteger(tickets)||tickets<0||!Array.isArray(items)||items.length>20)throw Error('分享奖励尚未配置');
 for(const i of items)if(!i||typeof i.type!=='string'||i.type==='equipment'||!Number.isSafeInteger(i.count)||i.count<1||i.count>10000)throw Error('分享奖励道具配置无效');
 return {coins,tickets,items:items.map(i=>({type:i.type,count:i.count}))};
}
/** No unannounced website or old preview URL is substituted for the owner URL. */
export function shareMessage({policy=RELEASE_AD_POLICY}={}){
 const raw=policy?.share?.url;let url=null;
 if(policy?.share?.urlPublished===true&&typeof raw==='string'&&raw){try{const u=new URL(raw);if(u.protocol==='https:'&&!u.username&&!u.password)url=u.href;}catch{}}
 return {title:'秘境决斗',text:'秘境决斗：六位英雄、秘境探索与双人决斗。',url};
}
export function dailyShareChoice(profile,{requestId,policy=RELEASE_AD_POLICY,now=new Date()}={}){
 if(!releaseFeatureEnabled(policy,'share')||!validOperationId(requestId))return null;
 const reward=shareReward(policy);if(reward.coins===0&&reward.tickets===0&&reward.items.length===0)return null;
 const state=normalizeOperations(profile?.operations),day=operationsDay(now);
 if(state.blocked||state.shareDays.includes(day)||state.shareDays.length>=OPERATION_RECORD_LIMIT)return null;
 return {day,requestId,reward};
}
export function shareRewardDraft(profile,choice,opened,{policy=RELEASE_AD_POLICY,now=new Date()}={}){
 if(!choice||opened?.opened!==true||opened.requestId!==choice.requestId)throw Error('分享入口尚未打开，本次未领取');
 if(choice.day!==operationsDay(now))throw Error('已经跨天，请重新使用分享入口');
 const available=dailyShareChoice(profile,{requestId:choice.requestId,policy,now});if(!available)throw Error('今日奖励已领取或分享奖励尚未开放');
 if(JSON.stringify(choice.reward)!==JSON.stringify(available.reward))throw Error('分享奖励已变化，请重新打开入口');
 const next=structuredClone(profile),reward=available.reward;
 next.coins=(next.coins||0)+reward.coins;next.tickets=(next.tickets||0)+reward.tickets;
 if(!Number.isSafeInteger(next.coins)||next.coins<0||next.coins>10000000||!Number.isSafeInteger(next.tickets)||next.tickets<0||next.tickets>10000000)throw Error('奖励超过存档上限，本次未领取');
 for(const item of reward.items)addItem(next,item);
 // Item-defined currencies also pass through addItem, so check caps afterwards.
 if(next.coins>10000000||next.tickets>10000000)throw Error('奖励超过存档上限，本次未领取');
 const state=normalizeOperations(next.operations);state.shareDays.push(choice.day);next.operations=state;
 return {profile:next,reward,day:choice.day};
}
/** Opening the OS chooser is sufficient; actual sending is intentionally not asserted. */
export function commitDailyShare({getProfile,onSave,choice,opened,policy=RELEASE_AD_POLICY,now=new Date()}={}){
 if(typeof getProfile!=='function'||typeof onSave!=='function')throw Error('存档暂时不可用');
 const result=shareRewardDraft(getProfile(),choice,opened,{policy,now});if(onSave(result.profile)!==true)throw Error('分享奖励未能保存，请重试');return result;
}
