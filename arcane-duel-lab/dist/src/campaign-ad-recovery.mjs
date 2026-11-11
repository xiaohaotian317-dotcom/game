import {RELEASE_AD_POLICY,validOperationId,normalizeOperations,releaseFeatureEnabled,assertOperationReceipt,OPERATION_RECORD_LIMIT} from './release-ad-policy.mjs';

const attempts=new WeakMap();let serial=0;
const phases=new Set(['travel','wave','boss','pet','portal']);
export const CAMPAIGN_AD_REVIVE_RULES=Object.freeze({hpRatio:.5,mpRatio:.5,invulnerability:1.25,maxPerAttempt:1});
function eligibleWorld(w){const c=w?.campaign;return !!c&&!w.duel&&!w.duelActor&&!c.tower&&!c.endless&&!c.training&&c.mode==='story'&&(!c.stage?.mode||c.stage.mode==='story')&&!c.cleared;}
export function campaignAdAttempt(w,id){
 if(!w||typeof w!=='object'||!w.campaign)throw Error('当前不是单机关卡');
 let record=attempts.get(w);if(!record){const attemptId=id??`campaign-${globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+(++serial)+'-'+Math.random().toString(36).slice(2)}`;if(!validOperationId(attemptId))throw Error('关卡尝试标识无效');record={attemptId,snapshot:null,revived:false,busy:false};attempts.set(w,record);}else if(id!==undefined&&id!==record.attemptId)throw Error('不能替换正在进行的关卡标识');
 return record.attemptId;
}
/** Call immediately before state='defeat' / queue=[] in the real simulation. */
export function captureCampaignDefeat(w){
 if(!eligibleWorld(w)||!phases.has(w.campaign.state)||!(w.player?.hp<=0))return null;
 if(w.campaign.team?.some(m=>m.player!==w.player&&m.player.hp>0))return null;
 campaignAdAttempt(w);const record=attempts.get(w);if(record.revived||record.busy)return null;
 if(record.snapshot)return {attemptId:record.attemptId};
 const c=w.campaign;record.snapshot={campaign:c,player:w.player,hero:w.hero,slot:c.activeSlot,stageId:c.stage?.id,encounter:c.encounter,phase:c.state,token:globalThis.crypto?.randomUUID?.()||'snapshot-'+(++serial)+'-'+Math.random().toString(36).slice(2),queue:structuredClone(c.queue||[])};
 return {attemptId:record.attemptId};
}
function activeSnapshot(w,profile,choice){
 const record=attempts.get(w),s=record?.snapshot,c=w?.campaign,state=normalizeOperations(profile?.operations);
 if(!eligibleWorld(w)||c.state!=='defeat'||w.player.hp>0||!record||!s||record.revived||state.blocked||state.revives.some(v=>v.attemptId===record.attemptId))return null;
 if(s.campaign!==c||s.player!==w.player||s.hero!==w.hero||s.slot!==c.activeSlot||s.stageId!==c.stage?.id||s.encounter!==c.encounter)return null;
 if(choice&&(choice.attemptId!==record.attemptId||choice.snapshotId!==s.token||choice.hero!==s.hero||choice.stageId!==s.stageId||choice.slot!==s.slot))return null;
 if(!Number.isFinite(w.time)||!Number.isFinite(w.player.maxHp)||w.player.maxHp<1||!Number.isFinite(w.player.maxMp)||w.player.maxMp<0)return null;
 return {record,snapshot:s,state};
}
export function campaignReviveChoice(w,profile,{policy=RELEASE_AD_POLICY}={}){
 if(!releaseFeatureEnabled(policy,'revive'))return null;const active=activeSnapshot(w,profile);if(!active||active.record.busy||active.state.revives.length>=OPERATION_RECORD_LIMIT)return null;
 const {record,snapshot:s}=active;return {attemptId:record.attemptId,snapshotId:s.token,hero:s.hero,slot:s.slot,stageId:s.stageId};
}
export function campaignReviveDraft(profile,w,choice,adResult,{policy=RELEASE_AD_POLICY}={}){
 if(!releaseFeatureEnabled(policy,'revive'))throw Error('广告复活尚未开放');
 const active=activeSnapshot(w,profile,choice);if(!active||!choice)throw Error('本次复活已失效或已经使用');
 if(active.state.revives.length>=OPERATION_RECORD_LIMIT)throw Error('复活记录已满');
 const receipt=assertOperationReceipt(profile,adResult,'reward-revive'),next=structuredClone(profile),state=normalizeOperations(next.operations);
 state.receipts.push(receipt);state.revives.push({attemptId:choice.attemptId,receipt});next.operations=state;
 return {profile:next,choice:{...choice},receipt};
}
function applyRecovery(w,record){
 const c=w.campaign,p=w.player,s=record.snapshot,r=CAMPAIGN_AD_REVIVE_RULES;
 c.state=s.phase;c.defeated=false;c.queue=structuredClone(s.queue);
 p.hp=Math.max(1,Math.ceil(p.maxHp*r.hpRatio));p.mp=Math.ceil(p.maxMp*r.mpRatio);p.dead=0;p.deadUntil=0;p.hurt=0;p.vx=0;p.vy=0;
 p.cast=null;p.buffer=null;p.recast=null;p.burst=null;p.dash=0;p.queuedDash=false;p.stomp=false;p.jumpBuffer=0;
 p.enemyControl=null;p.enemyStatus={};p.enemySnareUntil=0;p.rootUntil=0;p.burnUntil=0;p.nextBurn=0;p.slowUntil=0;p.stoneStacks=0;p.frostStacks=0;
 p.invuln=Math.max(p.invuln||0,r.invulnerability);p.blinkUntil=Math.max(p.blinkUntil||0,w.time+r.invulnerability);
 record.revived=true;record.snapshot=null;
 return {attemptId:record.attemptId,hp:p.hp,mp:p.mp,invulnerability:r.invulnerability};
}
/** onSave must synchronously return true and update the caller's live profile. */
export function commitCampaignAdRevive({world,getWorld=()=>world,getProfile,onSave,choice,adResult,policy=RELEASE_AD_POLICY}={}){
 if(typeof getProfile!=='function'||typeof onSave!=='function'||getWorld()!==world)throw Error('当前关卡已结束，无法复活');
 const current=getProfile(),active=activeSnapshot(world,current,choice);if(!active||active.record.busy)throw Error('本次复活已失效或正在处理');
 const draft=campaignReviveDraft(current,world,choice,adResult,{policy}),record=active.record;record.busy=true;
 try{
  if(onSave(draft.profile)!==true)throw Error('复活未能保存，本次未恢复战斗');
  // An abandoned attempt must never be resurrected by an old SDK callback.
  const s=record.snapshot;if(getWorld()!==world||world.campaign!==s?.campaign||world.player!==s?.player||world.campaign.state!=='defeat')throw Error('关卡已变化，本次未恢复战斗');
  return applyRecovery(world,record);
 }finally{record.busy=false;}
}
