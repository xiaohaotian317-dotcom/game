// TapTap callback meanings: https://developer.taptap.cn/docs/sdk/anti-addiction/development-guide/android-native/
// These are presentation/session gates, never a substitute for the native SDK result.
const labels={unchecked:'尚未进行实名认证',checking:'正在进行实名认证',allowed:'认证通过',exited:'已退出认证',accountChanged:'账号已变化，请重新认证',switchAccount:'请重新选择账号',periodRestricted:'当前时段暂不可游玩',durationLimit:'当前可玩时长已结束',ageRestricted:'当前账号未达到本游戏可玩年龄',serviceUnavailable:'认证服务暂不可用，请稍后重试',cancelled:'已取消认证，可重新开始',unknown:'认证尚未完成，请稍后重试'};
const codes={500:'allowed',1000:'exited',1001:'switchAccount',1030:'periodRestricted',1050:'durationLimit',1100:'ageRestricted',1200:'serviceUnavailable',9002:'cancelled'};
export function complianceState(raw={}){
 const code=Number.isInteger(raw.complianceCode)?raw.complianceCode:null,revision=Number.isSafeInteger(raw.complianceRevision)&&raw.complianceRevision>=0?raw.complianceRevision:null;
 const allowed=raw.available===true&&raw.initialized===true&&raw.complianceAllowed===true&&code===500;
 const phase=['accountChanged','exited','cancelled'].includes(raw.reason)?raw.reason:allowed?'allowed':raw.compliancePending===true?'checking':code===500?'unknown':codes[code]||(raw.reason?'serviceUnavailable':'unchecked');
 return Object.freeze({allowed:allowed&&phase==='allowed',phase,code,revision,label:labels[phase]||labels.unknown});
}
export class TapSafety{
 constructor(provider=null){this.provider=provider;this.state=complianceState();this.listeners=new Set();this.subscription=null;this.subscriptionTask=null;this.disposed=false;}
 snapshot(){return {...this.state};}
 onChange(listener){if(typeof listener!=='function')throw TypeError('需要状态回调');this.listeners.add(listener);listener(this.snapshot());return ()=>this.listeners.delete(listener);}
 consume(raw,{force=false}={}){if(this.disposed)return this.snapshot();const next=complianceState(raw);if(!force&&next.revision!==null&&this.state.revision!==null&&next.revision<this.state.revision)return this.snapshot();this.state=next;for(const listener of this.listeners){try{listener(this.snapshot());}catch{}}return this.snapshot();}
 async observe(){if(this.disposed)throw Error('认证页面已关闭');if(typeof this.provider?.subscribe!=='function')throw Error('认证状态监听未就绪，请重试');if(!this.subscriptionTask)this.subscriptionTask=Promise.resolve(this.provider?.subscribe?.(raw=>this.consume(raw))).then(handle=>{if(this.disposed){handle?.remove?.();return;}this.subscription=handle;}).catch(()=>{this.subscriptionTask=null;throw Error('认证状态监听未就绪，请重试');});await this.subscriptionTask;}
 async status(){if(!this.provider?.status)return {available:false,configured:false,complianceAllowed:false};const raw=await this.provider.status();this.consume(raw);return raw;}
 async startCompliance({privacyAccepted=false,identityMode='local'}={}){
  if(privacyAccepted!==true)throw Error('请先阅读并同意隐私与SDK说明');if(!this.provider?.startCompliance)return this.consume({reason:'unavailable'},{force:true});
  await this.observe();this.consume({compliancePending:true,complianceRevision:this.state.revision},{force:true});
  try{return this.consume(await this.provider.startCompliance({privacyAccepted:true,identityMode}));}catch(error){this.consume({reason:'sdkFailed'},{force:true});throw error;}
 }
 async exitCompliance(){const result=await this.provider?.exitCompliance?.();return this.consume({...result,complianceAllowed:false,complianceCode:null,compliancePending:false,reason:'exited'},{force:true});}
 async openUpdate({privacyAccepted=false}={}){if(privacyAccepted!==true)throw Error('请先阅读并同意隐私与SDK说明');return this.provider?.openUpdate?.({privacyAccepted:true})||{available:false,reason:'unavailable'};}
 async checkForceUpdate({privacyAccepted=false}={}){if(privacyAccepted!==true)throw Error('请先阅读并同意隐私与SDK说明');return this.provider?.checkForceUpdate?.({privacyAccepted:true})||{available:false,reason:'unavailable'};}
 async dispose(){this.state=complianceState({reason:'exited'});this.disposed=true;this.listeners.clear();await this.subscription?.remove?.();this.subscription=null;}
}
