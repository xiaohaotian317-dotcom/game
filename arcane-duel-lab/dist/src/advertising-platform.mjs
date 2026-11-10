// Advertising stays behind this boundary. No SDK initializes and no reward is
// granted until a real provider has been configured and returns its completion.
export const AD_PLACEMENTS=Object.freeze({coins:'reward-coins',ticket:'reward-ticket',item:'reward-item',revive:'reward-revive',result:'interstitial-result'});
export class AdvertisingPlatform{
 constructor(provider=null){this.provider=provider;this.busy=false;this.completed=new Set();}
 async status(){return this.provider?.status?this.provider.status():{configured:false,rewarded:false,interstitial:false};}
 async showRewarded(placement,{privacyAccepted=false}={}){
  if(!Object.values(AD_PLACEMENTS).slice(0,4).includes(placement))throw Error('广告位不可用');
  if(!privacyAccepted)throw Error('请先确认广告隐私说明');
  if(this.busy)throw Error('广告正在处理中');
  if(!this.provider?.showRewarded)return {available:false,completed:false};
  this.busy=true;try{const result=await this.provider.showRewarded({placement});const receipt=result?.receipt;
   if(result?.completed!==true||typeof receipt!=='string'||!receipt||this.completed.has(receipt)){const failure={available:result?.available!==false,completed:false};if(typeof result?.reason==='string'&&/^[A-Za-z]{1,64}$/.test(result.reason))failure.reason=result.reason;if(Number.isInteger(result?.errorCode))failure.errorCode=result.errorCode;if(['init','load','show','video','verify','timeout','lifecycle'].includes(result?.errorPhase))failure.errorPhase=result.errorPhase;return failure;}
   this.completed.add(receipt);if(this.completed.size>128)this.completed.delete(this.completed.values().next().value);
   return {available:true,completed:true,receipt,placement};
  }finally{this.busy=false;}
 }
 async showResultInterstitial({privacyAccepted=false,duel=false}={}){
  if(duel||!privacyAccepted||this.busy||!this.provider?.showInterstitial)return {shown:false};
  this.busy=true;try{return await this.provider.showInterstitial({placement:AD_PLACEMENTS.result});}finally{this.busy=false;}
 }
}
