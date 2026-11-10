export const SHOP_OFFERS=Object.freeze([
 {id:'coins',name:'金币宝箱',type:'coins',count:300,limit:3,copy:'直接获得金币，用于学习与强化。',icon:'chestMedium'},
 {id:'experience',name:'修行灵药',type:'xpMedium',count:1,limit:3,copy:'中型角色经验药水，使用后获得100经验。',icon:'xpMedium'},
 {id:'stone',name:'基础灵石',type:'stoneSmall',count:1,limit:3,copy:'小灵石，用于装备升品或合成中等灵石。',icon:'stoneSmall'},
 {id:'ticket',name:'召唤之约',type:'ticket',count:1,limit:2,adsRequired:2,copy:'完成2次激励广告获得1张抽奖券，每天最多2张。',icon:'ticket'}
]);
// Economy tuning: later milestones make the same single chest more valuable.
export const AD_GOLD_TIERS=Object.freeze([
 {stage:null,coins:300,label:'启程馈赠'},
 {stage:5,coins:400,label:'第一章第5关'},
 {stage:10,coins:500,label:'第一章第10关'},
 {stage:15,coins:650,label:'第二章第4关'},
 {stage:19,coins:800,label:'第二章第8关'}
]);
export function adGoldTier(profile){const cleared=new Set(profile?.cleared||[]);return [...AD_GOLD_TIERS].reverse().find(t=>t.stage===null||cleared.has(t.stage));}
export function shopOffers(profile){const tier=adGoldTier(profile);return SHOP_OFFERS.map(o=>o.id==='coins'?{...o,count:tier.coins,copy:`每次获得${tier.coins}金币，直接到账；随主线进度提升。`}:o);}
export function localDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function normalizeShop(raw){return {day:typeof raw?.day==='string'?raw.day:'',counts:Object.fromEntries(SHOP_OFFERS.map(o=>[o.id,Math.max(0,Math.min(o.limit,Math.floor(Number(raw?.counts?.[o.id])||0)+(o.id==='coins'?Math.max(0,Math.floor(Number(raw?.counts?.treasure)||0)):0)))])),ticketAds:raw?.ticketAds===1?1:0,receipts:Array.isArray(raw?.receipts)?[...new Set(raw.receipts.filter(v=>typeof v==='string'&&v.length<=256))].slice(-512):[]};}
export function shopToday(profile,day=localDay()){const state=normalizeShop(profile.shop);if(state.day!==day){state.day=day;state.counts={};state.ticketAds=0;}return state;}
export function prepareShopClaim(profile,id,receipt,{completed=false,day=localDay()}={}){
 const offer=shopOffers(profile).find(o=>o.id===id);if(!offer)throw Error('这份馈赠不可用');
 if(!completed||typeof receipt!=='string'||!receipt||receipt.length>256)throw Error('广告尚未完成，本次没有领取奖励');
 const state=shopToday(profile,day);if(state.receipts.includes(receipt))throw Error('这次奖励已经领取');
 if((state.counts[id]||0)>=offer.limit)throw Error('今日这份馈赠已领完');
 let granted=true;
 if(offer.adsRequired===2){state.ticketAds++;granted=state.ticketAds>=2;if(granted)state.ticketAds=0;}
 if(granted)state.counts[id]=(state.counts[id]||0)+1;
 state.receipts.push(receipt);state.receipts=state.receipts.slice(-512);return {offer,state,granted};
}
