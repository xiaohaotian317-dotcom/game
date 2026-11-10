import {loadSolo,saveSolo,addItem} from './campaign-profile.mjs';
import {prepareShopClaim} from './shop-state.mjs';
export function commitShopReward(storage,id,result,options){
 const profile=loadSolo(storage),{offer,state}=prepareShopClaim(profile,id,result?.receipt,{...options,completed:result?.completed===true});
 profile.shop=state;if(offer.type==='coins')profile.coins+=offer.count;else addItem(profile,{type:offer.type,count:offer.count});
 if(!saveSolo(storage,profile))throw Error('奖励未能保存，请重试；本次未记为已领取');return profile;
}
