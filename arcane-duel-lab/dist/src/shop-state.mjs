export const SHOP_OFFERS=Object.freeze([
 {id:'coins',name:'旅途金币',type:'coins',count:100,limit:3,copy:'直接获得100金币，用于学习与强化。',icon:'chestSmall'},
 {id:'experience',name:'修行灵药',type:'xpMedium',count:1,limit:3,copy:'中型角色经验药水，使用后获得100经验。',icon:'xpMedium'},
 {id:'treasure',name:'金币宝箱',type:'chestSmall',count:1,limit:2,copy:'小金币宝箱，放入背包，打开获得100金币。',icon:'chestSmall'},
 {id:'stone',name:'基础灵石',type:'stoneSmall',count:1,limit:3,copy:'小灵石，用于装备升品或合成中等灵石。',icon:'stoneSmall'}
]);
export function localDay(now=new Date()){return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
export function normalizeShop(raw){return {day:typeof raw?.day==='string'?raw.day:'',counts:Object.fromEntries(SHOP_OFFERS.map(o=>[o.id,Math.max(0,Math.min(o.limit,Math.floor(Number(raw?.counts?.[o.id])||0)))])),receipts:Array.isArray(raw?.receipts)?[...new Set(raw.receipts.filter(v=>typeof v==='string'&&v.length<=256))].slice(-512):[]};}
export function shopToday(profile,day=localDay()){const state=normalizeShop(profile.shop);if(state.day!==day){state.day=day;state.counts={};}return state;}
export function prepareShopClaim(profile,id,receipt,{completed=false,day=localDay()}={}){
 const offer=SHOP_OFFERS.find(o=>o.id===id);if(!offer)throw Error('这份馈赠不可用');
 if(!completed||typeof receipt!=='string'||!receipt||receipt.length>256)throw Error('广告尚未完成，本次没有领取奖励');
 const state=shopToday(profile,day);if(state.receipts.includes(receipt))throw Error('这次奖励已经领取');
 if((state.counts[id]||0)>=offer.limit)throw Error('今日这份馈赠已领完');
 state.counts[id]=(state.counts[id]||0)+1;state.receipts.push(receipt);state.receipts=state.receipts.slice(-512);return {offer,state};
}
