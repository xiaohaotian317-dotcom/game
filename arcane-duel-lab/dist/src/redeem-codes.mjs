import {normalizeSolo,addItem,loadSolo,saveSolo} from './campaign-profile.mjs';
export const REDEEM_CODE='秘境决斗666';
export const REDEEM_REWARDS=Object.freeze([{type:'ticket',count:3},{type:'chestMedium',count:3},{type:'xpMedium',count:3}]);
export function redeemGift(profile,input){if(String(input??'').trim().normalize('NFKC')!==REDEEM_CODE)throw Error('兑换码不正确，请检查后重试');const next=normalizeSolo(profile);if(next.redeemedCodes.includes(REDEEM_CODE))throw Error('这份存档已经领取过此礼包');for(const item of REDEEM_REWARDS)addItem(next,item);next.redeemedCodes.push(REDEEM_CODE);return next;}
export function redeemSavedGift(storage,input){const next=redeemGift(loadSolo(storage),input);if(!saveSolo(storage,next))throw Error('无法保存奖励，请检查设备存储后重试。');return next;}
