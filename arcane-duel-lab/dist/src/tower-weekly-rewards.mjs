import {normalizeSolo,saveSolo,addItem} from './campaign-profile.mjs';
import {SOLO_KEY} from './campaign-growth-data.mjs';
import {MAX_WEEKLY_CLAIMS,normalizeTowerWeekly,normalizeWeeklyClaim,sameWeeklyClaim,weeklyTowerRewardItems,validWeeklyAccount,validWeeklyPeriod,validWeeklyNonce} from './tower-weekly-state.mjs';

const queues=new WeakMap();
const fail=(code,message)=>{throw Object.assign(new Error(message),{code});};
const validRevision=value=>typeof value==='string'&&value.length<=1024&&!/[\u0000-\u001f\u007f]/.test(value);
const samePeriod=(a,b)=>a.accountId===b.accountId&&a.periodToken===b.periodToken;
function profileFrom(storage){
 let raw;try{raw=JSON.parse(storage.getItem(SOLO_KEY));}catch{fail('localUnavailable','无法读取正式存档，请先恢复存档后再领取。');}
 if(raw?.version!==1||!Array.isArray(raw.owned)||!raw.heroes||!Array.isArray(raw.bag))fail('localUnavailable','请先保存当前角色档案，再领取周榜奖励。');
 let profile;try{profile=normalizeSolo(raw);}catch{fail('localInvalid','正式角色存档无法核对，本次没有发放奖励。');}profile.towerWeekly=normalizeTowerWeekly(raw.towerWeekly);
 if(profile.towerWeekly.blocked)fail('localInvalid','周榜领取记录不完整，本次没有发放奖励。');
 return profile;
}
function persist(storage,profile){
 if(!saveSolo(storage,profile))fail('localWriteFailed','奖励尚未写入角色存档，请稍后重试；已保存的待领取记录可继续恢复。');
 return profileFrom(storage);
}
function defaultNonce(){
 const value=globalThis.crypto?.randomUUID?.();if(!validWeeklyNonce(value))fail('nonceUnavailable','当前环境无法生成安全领取编号，请稍后重试。');return value;
}
function validateRank(result,periodToken){
 if(result?.available===false)fail('cloudUnavailable','在线周榜暂不可用，本次没有发放奖励。');
 if(!validWeeklyAccount(result?.accountId))fail('accountUnavailable','请登录参加本周榜单的 TapTap 账号。');
 if(result.periodToken!==periodToken)fail('periodMismatch','服务器返回的周榜周期不同，本次没有发放奖励。');
 if(result.ended!==true)fail('periodOpen','这个服务周期尚未结束，结算后才能领奖。');
 const rewards=weeklyTowerRewardItems(result.rank);if(!rewards.length)fail('ineligible','本人在这个已结算周期没有前50名奖励。');
 return {accountId:result.accountId,periodToken,rank:result.rank,rewards};
}
function readLedger(result,accountId){
 if(result?.available===false)fail('cloudUnavailable','云端领取记录暂不可用，本次没有发放奖励。');
 if(result?.accountId!==accountId)fail('accountChanged','TapTap 账号发生变化，请切回原账号后继续领取。');
 const ledger=result.ledger;
 if(!validRevision(result.revision)||ledger?.version!==1||!Array.isArray(ledger.claims)||ledger.claims.length>MAX_WEEKLY_CLAIMS)fail('ledgerInvalid','云端领取账本无法核对，本次没有发放奖励。');
 const claims=[],periods=new Set();for(const raw of ledger.claims){const claim=normalizeWeeklyClaim({...raw,accountId});if(!claim||periods.has(claim.periodToken))fail('ledgerInvalid','云端领取账本包含不完整记录，本次没有发放奖励。');periods.add(claim.periodToken);const {accountId:ignored,...entry}=claim;claims.push(entry);}
 return {accountId,revision:result.revision,ledger:{version:1,claims}};
}
async function call(provider,method,arg){
 let result;try{result=await provider[method](arg);}catch{fail('cloudUnavailable','在线领奖暂未完成，请稍后重试；本次没有新增奖励。');}
 return result;
}
function cloudClaim(envelope,periodToken){const found=envelope.ledger.claims.find(c=>c.periodToken===periodToken);return found?{accountId:envelope.accountId,...found}:null;}
function receiptFor(profile,claim){return profile.towerWeekly.receipts.find(r=>samePeriod(r,claim));}
function ensureRewardCapacity(profile,rewards){for(const reward of rewards){const stack=profile.bag.find(item=>item.type===reward.type);if((stack?.count||0)+reward.count>9999)fail('inventoryFull','奖励物品已达到存档数量上限，请先使用一些同类物品后再领取。');}}
function rememberRemoteClaim(storage,claim){
 const profile=profileFrom(storage);if(receiptFor(profile,claim))return profile;
 profile.towerWeekly.receipts.push(claim);if(profile.towerWeekly.pending&&samePeriod(profile.towerWeekly.pending,claim))profile.towerWeekly.pending=null;
 if(profile.towerWeekly.receipts.length>MAX_WEEKLY_CLAIMS)fail('ledgerFull','本机领取回执已满，本次没有发放奖励。');
 return persist(storage,profile);
}
async function claimUnlocked({storage,provider,periodToken,nonceFactory}){
 if(!validWeeklyPeriod(periodToken))fail('periodInvalid','请选择服务器已结束的周榜周期。');
 if(!provider||['getHistoricalRank','loadWeeklyLedger','writeWeeklyLedger'].some(key=>typeof provider[key]!=='function'))fail('cloudUnavailable','在线周榜领奖服务尚未连接，本次没有发放奖励。');
 if(typeof provider.status==='function'){
  const status=await call(provider,'status');
  if(status?.weeklyRewards!==true||status?.weeklyClaimAtomic!==true)fail('atomicClaimUnavailable','周榜奖励暂未开放，当前服务不能保证跨设备只领取一次。');
 }
 profileFrom(storage);
 // No local date/week, local score or caller-supplied rank can authorize an award.
 const rank=validateRank(await call(provider,'getHistoricalRank',{periodToken}),periodToken),accountId=rank.accountId;
 let envelope=readLedger(await call(provider,'loadWeeklyLedger'),accountId),profile=profileFrom(storage),existing=cloudClaim(envelope,periodToken),pending=profile.towerWeekly.pending;
 const localReceipt=receiptFor(profile,rank);if(localReceipt)return {status:'alreadyClaimed',profile,claim:localReceipt,recovered:false};
 if(existing&&(!pending||!sameWeeklyClaim(pending,existing))){profile=rememberRemoteClaim(storage,existing);return {status:'alreadyClaimed',profile,claim:existing,recovered:false};}
 if(pending&&!samePeriod(pending,rank))fail('pendingOtherPeriod','有另一笔周榜奖励等待恢复，请先使用原账号处理该周期。');
 if(pending&&(pending.rank!==rank.rank||JSON.stringify(pending.rewards)!==JSON.stringify(rank.rewards)))fail('rankChanged','服务器结算名次与待领取记录不同，本次没有发放奖励。');
 ensureRewardCapacity(profile,rank.rewards);
 const recovered=!!pending;
 if(!pending){
  if(profile.towerWeekly.receipts.length>=MAX_WEEKLY_CLAIMS||envelope.ledger.claims.length>=MAX_WEEKLY_CLAIMS)fail('ledgerFull','周榜领取记录已满，本次没有发放奖励。');
  let nonce;try{nonce=nonceFactory();}catch(error){if(error?.code)throw error;fail('nonceUnavailable','无法创建领取编号，本次没有发放奖励。');}
  if(!validWeeklyNonce(nonce))fail('nonceUnavailable','领取编号无效，本次没有发放奖励。');
  pending={...rank,nonce};profile.towerWeekly.pending=pending;profile=persist(storage,profile);
  if(!sameWeeklyClaim(profile.towerWeekly.pending,pending))fail('pendingChanged','本机待领取记录已变化，请重新打开周榜。');
 }
 if(!existing){
  if(envelope.ledger.claims.length>=MAX_WEEKLY_CLAIMS)fail('ledgerFull','云端周榜领取记录已满，本次没有发放奖励。');
  const {accountId:ignored,...entry}=pending,ledger={version:1,claims:[...envelope.ledger.claims,entry]};
  const written=await call(provider,'writeWeeklyLedger',{expectedRevision:envelope.revision,ledger});
  if(written?.written!==true||written.available===false){if(written?.reason==='revisionConflict')fail('revisionConflict','云端领取记录已更新，请重试核对；本次没有发放奖励。');fail('cloudUnavailable','云端领取记录未确认保存，本次没有发放奖励。');}
  if(written.accountId!==accountId)fail('accountChanged','TapTap 账号发生变化，本次没有发放奖励。');
  // Tap cloud archives do a normal revision check, not a distributed compare-and-swap.
  // Require a fresh read-back before delivering anything to the local inventory.
  const confirmed=readLedger(await call(provider,'loadWeeklyLedger'),accountId);
  for(const old of ledger.claims){const actual=cloudClaim(confirmed,old.periodToken);if(!sameWeeklyClaim(actual,{accountId,...old}))fail('ledgerChanged','云端领取记录尚未一致，请稍后重试；本次没有发放奖励。');}
  envelope=confirmed;existing=cloudClaim(envelope,periodToken);
 }
 if(!sameWeeklyClaim(existing,pending))fail('ledgerChanged','云端回执与本机待领取记录不同，本次没有发放奖励。');
 profile=profileFrom(storage);const delivered=receiptFor(profile,pending);if(delivered)return {status:'alreadyClaimed',profile,claim:delivered,recovered:false};
 if(!sameWeeklyClaim(profile.towerWeekly.pending,pending))fail('pendingChanged','待领取记录已替换，请重新打开周榜核对；本次没有发放奖励。');
 ensureRewardCapacity(profile,pending.rewards);
 const draft=structuredClone(profile);for(const item of pending.rewards)addItem(draft,item);draft.towerWeekly.pending=null;draft.towerWeekly.receipts.push(pending);
 // Items and receipt are in one formal Solo storage write. If this fails, the
 // persisted pending + matching cloud nonce can finish on a later online retry.
 const saved=persist(storage,draft);if(!receiptFor(saved,pending)||saved.towerWeekly.pending)fail('localWriteFailed','奖励保存尚未确认，请重新打开周榜恢复。');
 return {status:'granted',profile:saved,claim:pending,recovered};
}

/** Inject the real Tap provider and formal Solo storage. Never pass a local ranking. */
export function claimTowerWeeklyReward({storage,provider,periodToken,nonceFactory=defaultNonce,locks=globalThis.navigator?.locks}={}){
 if(!storage||typeof storage.getItem!=='function'||typeof storage.setItem!=='function')return Promise.reject(Object.assign(new Error('本机存档不可用，本次没有发放奖励。'),{code:'localUnavailable'}));
 const previous=queues.get(storage)||Promise.resolve(),task=previous.catch(()=>{}).then(()=>typeof locks?.request==='function'?locks.request('arcane-tower-weekly-claim',()=>claimUnlocked({storage,provider,periodToken,nonceFactory})):claimUnlocked({storage,provider,periodToken,nonceFactory}));
 queues.set(storage,task);const clear=()=>{if(queues.get(storage)===task)queues.delete(storage);};task.then(clear,clear);return task;
}
