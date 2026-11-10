// Called only through AdvertisingPlatform, after its current consent/action gate.
// Status never initializes an SDK. An automatic interstitial cannot grant consent.
export function createAdsProvider(plugin){
 return {
  status:()=>plugin.status(),
  async showRewarded({placement}){
   await plugin.consent({privacyAccepted:true});
   return plugin.showRewarded({placement});
  },
  async showInterstitial({placement}){
   const state=await plugin.status();
   if(!state.privacyAccepted)return {shown:false,testMode:true,reason:'privacyRequired'};
   await plugin.consent({privacyAccepted:true});
   return plugin.showInterstitial({placement});
  }
 };
}
