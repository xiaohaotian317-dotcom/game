// New release triggers remain off until the owner chooses their reward/frequency.
// These local ledgers prevent accidental replay; they are not server verification.
export const OPERATION_RECORD_LIMIT=4096;
export const RELEASE_AD_POLICY=Object.freeze({confirmed:true,result:Object.freeze({enabled:false,minIntervalMs:null,dailyLimit:null}),revive:Object.freeze({enabled:false}),share:Object.freeze({enabled:true,reward:Object.freeze({coins:100,tickets:0,items:Object.freeze([])}),url:null,urlPublished:false})});
export const validOperationId=value=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const dayPattern=/^\d{4}-\d{2}-\d{2}$/;
const validDay=value=>typeof value==='string'&&dayPattern.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
export function operationsDay(now=new Date()){
 const d=now instanceof Date?now:new Date(now);if(!Number.isFinite(d.getTime()))throw Error('日期无效');
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function operationTime(now=new Date()){const n=now instanceof Date?now.getTime():new Date(now).getTime();if(!integer(n))throw Error('时间无效');return n;}
export function freshOperations(){return {version:1,blocked:false,receipts:[],revives:[],shareDays:[],interstitial:{day:'',attemptIds:[],attempts:0,shown:0,lastAttemptAt:0,lastShownAt:0}};}
export function normalizeOperations(raw){
 const out=freshOperations();if(raw===undefined||raw===null)return out;
 if(typeof raw!=='object'||Array.isArray(raw)||raw.version!==1){out.blocked=true;return out;}
 out.blocked=raw.blocked===true;
 const list=(value,valid)=>{if(value===undefined)return [];if(!Array.isArray(value)){out.blocked=true;return [];}if(value.length>OPERATION_RECORD_LIMIT||value.some(v=>!valid(v)))out.blocked=true;return [...new Set(value.filter(valid))].slice(0,OPERATION_RECORD_LIMIT);};
 out.receipts=list(raw.receipts,validOperationId);out.shareDays=list(raw.shareDays,validDay);
 const claims=raw.revives??[];if(!Array.isArray(claims)||claims.length>OPERATION_RECORD_LIMIT)out.blocked=true;
 const seen=new Set();for(const claim of Array.isArray(claims)?claims:[]){
  if(!validOperationId(claim?.attemptId)||!validOperationId(claim?.receipt)||!out.receipts.includes(claim.receipt)){out.blocked=true;continue;}
  if(seen.has(claim.attemptId)){out.blocked=true;continue;}seen.add(claim.attemptId);if(out.revives.length<OPERATION_RECORD_LIMIT)out.revives.push({attemptId:claim.attemptId,receipt:claim.receipt});
 }
 const source=raw.interstitial??{};if(typeof source!=='object'||Array.isArray(source)){out.blocked=true;return out;}
 out.interstitial.attemptIds=list(source.attemptIds,validOperationId);
 if(source.day!==undefined&&source.day!==''&&!validDay(source.day))out.blocked=true;
 out.interstitial.day=validDay(source.day)?source.day:'';
 for(const key of ['attempts','shown','lastAttemptAt','lastShownAt']){if(source[key]!==undefined&&!integer(source[key]))out.blocked=true;out.interstitial[key]=integer(source[key])?source[key]:0;}
 if(out.interstitial.shown>out.interstitial.attempts||out.interstitial.attempts>0&&!out.interstitial.day)out.blocked=true;
 return out;
}
export function mergeOperationsForImport(imported,local){
 const a=normalizeOperations(imported),b=normalizeOperations(local),day=a.interstitial.day>b.interstitial.day?a.interstitial.day:b.interstitial.day;
 const union=(x,y)=>[...new Set([...x,...y])];const receipts=union(a.receipts,b.receipts),shareDays=union(a.shareDays,b.shareDays),attemptIds=union(a.interstitial.attemptIds,b.interstitial.attemptIds),claims=new Map();let conflict=false;
 for(const c of [...a.revives,...b.revives]){const old=claims.get(c.attemptId);if(old&&old.receipt!==c.receipt)conflict=true;claims.set(c.attemptId,c);}
 const matching=[a.interstitial,b.interstitial].filter(v=>v.day===day);
 return normalizeOperations({version:1,blocked:a.blocked||b.blocked||conflict,receipts,revives:[...claims.values()],shareDays,interstitial:{day,attemptIds,attempts:Math.max(0,...matching.map(v=>v.attempts)),shown:Math.max(0,...matching.map(v=>v.shown)),lastAttemptAt:Math.max(a.interstitial.lastAttemptAt,b.interstitial.lastAttemptAt),lastShownAt:Math.max(a.interstitial.lastShownAt,b.interstitial.lastShownAt)}});
}
export function operationReceiptUsed(profile,receipt){return normalizeOperations(profile?.operations).receipts.includes(receipt)||profile?.shop?.receipts?.includes(receipt)||profile?.daily?.adReceipts?.includes(receipt);}
export function assertOperationReceipt(profile,result,placement){
 if(result?.completed!==true||result.placement!==placement||!validOperationId(result.receipt))throw Error('广告尚未完成或奖励类型不匹配');
 const state=normalizeOperations(profile?.operations);if(state.blocked)throw Error('奖励记录暂时无法核对');
 if(operationReceiptUsed(profile,result.receipt))throw Error('这次广告奖励已经使用');
 if(state.receipts.length>=OPERATION_RECORD_LIMIT)throw Error('广告领取记录已满');return result.receipt;
}
export function releaseFeatureEnabled(policy,feature){return policy?.confirmed===true&&policy?.[feature]?.enabled===true;}
function resultContextValid(context){return context?.settlementSaved===true&&context.leaving===true&&!context.duel&&['story','pet','twin','endless'].includes(context.mode)&&validOperationId(context.attemptId);}
export function resultInterstitialChoice(profile,context,{policy=RELEASE_AD_POLICY,now=new Date()}={}){
 if(!releaseFeatureEnabled(policy,'result')||!resultContextValid(context))return null;
 const config=policy.result;if(!integer(config.minIntervalMs)||!integer(config.dailyLimit,100)||config.dailyLimit<1)return null;
 const state=normalizeOperations(profile?.operations),i=state.interstitial,at=operationTime(now),day=operationsDay(now);
 if(state.blocked||i.attemptIds.length>=OPERATION_RECORD_LIMIT||i.attemptIds.includes(context.attemptId))return null;
 const attempts=i.day===day?i.attempts:0;if(attempts>=config.dailyLimit)return null;
 if((i.lastAttemptAt>0||i.lastShownAt>0)&&at-Math.max(i.lastAttemptAt,i.lastShownAt)<config.minIntervalMs)return null;
 return {attemptId:context.attemptId,day,at,mode:context.mode};
}
export function reserveResultInterstitialDraft(profile,context,options={}){
 const choice=resultInterstitialChoice(profile,context,options);if(!choice)return null;
 const next=structuredClone(profile),state=normalizeOperations(next.operations),i=state.interstitial;
 if(i.day!==choice.day){i.day=choice.day;i.attempts=0;i.shown=0;}i.attemptIds.push(choice.attemptId);i.attempts++;i.lastAttemptAt=choice.at;next.operations=state;
 return {profile:next,choice};
}
export function commitResultInterstitialReservation({getProfile,onSave,context,policy=RELEASE_AD_POLICY,now=new Date()}={}){
 if(typeof getProfile!=='function'||typeof onSave!=='function')return null;
 const result=reserveResultInterstitialDraft(getProfile(),context,{policy,now});if(!result)return null;
 // Saving the reservation precedes the SDK request. A failed ad is not retried
 // for the same attempt, and callers always continue their normal navigation.
 if(onSave(result.profile)!==true)return null;return result.choice;
}
export function resultInterstitialShownDraft(profile,choice,result,{now=new Date()}={}){
 const state=normalizeOperations(profile?.operations);if(state.blocked||!state.interstitial.attemptIds.includes(choice?.attemptId)||result?.shown!==true)return null;
 const at=operationTime(now);if(choice.day!==state.interstitial.day||state.interstitial.lastAttemptAt!==choice.at)return null;
 // The result is recorded at most once per reserved attempt.
 if(state.interstitial.lastShownAt>=choice.at)return null;
 const next=structuredClone(profile);state.interstitial.shown++;state.interstitial.lastShownAt=Math.max(choice.at,at);next.operations=state;return next;
}
