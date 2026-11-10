// Save normalization only. No profile, SDK, clock or network dependencies belong here.
export const MAX_WEEKLY_CLAIMS=512;
const opaque=(value,max=256)=>typeof value==='string'&&value.length>0&&value.length<=max&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
export const validWeeklyAccount=value=>opaque(value,128);
export const validWeeklyPeriod=value=>opaque(value);
export const validWeeklyNonce=value=>typeof value==='string'&&/^[A-Za-z0-9_-]{16,128}$/.test(value);

export function weeklyTowerRewardItems(rank){
 if(!Number.isSafeInteger(rank)||rank<1||rank>50)return [];
 return [...(rank===1?[{type:'heroChoice',count:1}]:[]),{type:rank<=10?'stoneHigh':'stoneMedium',count:3},{type:rank<=10?'chestLarge':'chestMedium',count:3}];
}
export function normalizeWeeklyClaim(raw){
 if(!validWeeklyAccount(raw?.accountId)||!validWeeklyPeriod(raw?.periodToken)||!validWeeklyNonce(raw?.nonce))return null;
 const rewards=weeklyTowerRewardItems(raw.rank);
 if(!rewards.length||!Array.isArray(raw.rewards)||raw.rewards.length!==rewards.length||raw.rewards.some((item,i)=>item?.type!==rewards[i].type||item.count!==rewards[i].count))return null;
 return {accountId:raw.accountId,periodToken:raw.periodToken,nonce:raw.nonce,rank:raw.rank,rewards};
}
export const weeklyClaimKey=claim=>JSON.stringify([claim.accountId,claim.periodToken]);
export function sameWeeklyClaim(a,b){const x=normalizeWeeklyClaim(a),y=normalizeWeeklyClaim(b);return !!x&&!!y&&JSON.stringify(x)===JSON.stringify(y);}

export function normalizeTowerWeekly(raw){
 const state={version:1,pending:null,receipts:[],blocked:false};if(raw==null)return state;
 state.blocked=raw.version!==1||raw.blocked===true||raw.receipts!==undefined&&!Array.isArray(raw.receipts);
 const receipts=Array.isArray(raw.receipts)?raw.receipts:[],keys=new Map();
 for(const entry of receipts){const claim=normalizeWeeklyClaim(entry);if(!claim){state.blocked=true;continue;}const key=weeklyClaimKey(claim),old=keys.get(key);if(old&&!sameWeeklyClaim(old,claim))state.blocked=true;if(!old){if(keys.size>=MAX_WEEKLY_CLAIMS)state.blocked=true;else keys.set(key,claim);}}
 state.receipts=[...keys.values()];
 if(raw.pending!=null){const pending=normalizeWeeklyClaim(raw.pending);if(!pending)state.blocked=true;else if(!keys.has(weeklyClaimKey(pending)))state.pending=pending;}
 return state;
}

// An old open page cannot erase a saved pending claim or a delivered receipt.
// The final local transaction contains the receipt, which suppresses the old pending.
export function mergeTowerWeekly(current,saved){
 const a=normalizeTowerWeekly(current),b=normalizeTowerWeekly(saved),receipts=[...b.receipts,...a.receipts];
 const state=normalizeTowerWeekly({version:1,receipts,pending:b.pending||a.pending,blocked:a.blocked||b.blocked});
 return state;
}

// A copied/exported pending record is not proof of an interrupted local delivery.
// The official import path preserves this device's pending/receipts, not imported pending.
export function mergeTowerWeeklyForImport(incoming,previous){
 const next=normalizeTowerWeekly(incoming),old=normalizeTowerWeekly(previous);
 return mergeTowerWeekly({...next,pending:null},old);
}
