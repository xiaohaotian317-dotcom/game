import {loadSolo,saveSolo,addItem} from './campaign-profile.mjs';
import {GOLD_SHOP_OFFERS} from './shop-state.mjs';
export function prepareShopPurchase(profile,id){
 const offer=GOLD_SHOP_OFFERS.find(o=>o.id===id);
 if(!offer)throw Error('此商品不可购买');
 if(profile.coins<offer.price)throw Error('金币不足');
 if(profile.bag.filter(i=>i.type===offer.type).reduce((n,i)=>n+i.count,0)+offer.count>9999)throw Error('此物品已达到持有上限');
 const draft=structuredClone(profile);draft.coins-=offer.price;
 addItem(draft,{type:offer.type,count:offer.count});return {profile:draft,offer};
}
export function commitShopPurchase(storage,id){
 const {profile,offer}=prepareShopPurchase(loadSolo(storage),id);
 if(!saveSolo(storage,profile))throw Error('购买未能保存，金币和物品没有改变');
 return {profile,offer};
}
