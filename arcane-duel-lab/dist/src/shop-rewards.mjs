import {loadSolo,saveSolo,addItem} from './campaign-profile.mjs';
import {prepareShopClaim} from './shop-state.mjs';
import {advanceDaily} from './daily-quests.mjs';
export function commitShopReward(storage,id,result,options){
 const profile=loadSolo(storage);
 if(profile.daily?.adReceipts?.includes(result?.receipt))throw Error('这次奖励已经领取');
 const {offer,state,granted}=prepareShopClaim(profile,id,result?.receipt,{...options,completed:result?.completed===true});
 profile.shop=state;
 if(granted){if(offer.type==='coins')profile.coins+=offer.count;else addItem(profile,{type:offer.type,count:offer.count});}
 const metric={coins:'shopCoins',stone:'shopStone',experience:'shopExperience',ticket:'shopTicket'}[id];
 if(granted&&metric)advanceDaily(profile,metric,1,new Date(state.day+'T12:00:00'));
 if(!saveSolo(storage,profile))throw Error('奖励未能保存，请重试；本次未记为已领取');return profile;
}
