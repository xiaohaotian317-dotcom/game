// First SDK use needs explicit privacy consent; resume verifies native saved
// consent and obtains a fresh official result, without accepting a JS identity.
// No identities, names, raw SDK messages, or arbitrary callback payloads cross this adapter.
const reasonLabels={unavailable:'此设备暂不支持TapTap服务',notConfigured:'TapTap游戏服务尚未配置',privacyRequired:'请先阅读并同意隐私与SDK说明',tapClientMissing:'请先从TapTap官方渠道安装TapTap客户端，再回来更新',background:'请回到游戏页面后重试',busy:'正在处理，请稍候',timeout:'服务暂未响应，请稍后重试',sdkFailed:'TapTap服务暂不可用，请稍后重试',loginRequired:'请先主动登录TapTap账号',accountChanged:'账号已变化，请重新认证',invalidIdentityMode:'认证方式不可用',closed:'当前页面已关闭'};
const nativeKeys=['required','available','configured','initialized','initializing','privacyAccepted','tapClientInstalled','complianceAllowed','compliancePending','requested'];
export function sanitizeTapSafetyResult(value){
 const raw=value&&typeof value==='object'?value:{},out={};
 for(const key of nativeKeys)if(typeof raw[key]==='boolean')out[key]=raw[key];
 if(Number.isInteger(raw.complianceCode))out.complianceCode=raw.complianceCode;
 if(Number.isSafeInteger(raw.complianceRevision)&&raw.complianceRevision>=0)out.complianceRevision=raw.complianceRevision;
 if(['local','tap'].includes(raw.identityMode))out.identityMode=raw.identityMode;
 if(typeof raw.reason==='string'&&/^[A-Za-z][A-Za-z0-9]{0,47}$/.test(raw.reason))out.reason=raw.reason;
 if(out.reason)out.label=reasonLabels[out.reason]||'认证尚未完成，请按页面提示重试';
 return out;
}
const off=()=>({available:false,configured:false,complianceAllowed:false,reason:'unavailable',label:reasonLabels.unavailable});
function privacy(accepted){if(accepted!==true)throw Object.assign(new Error(reasonLabels.privacyRequired),{code:'privacyRequired'});}
export function createTapSafetyProvider(plugin,tap=null){
 const call=async(method,args)=>{if(typeof plugin?.[method]!=='function')return off();try{return sanitizeTapSafetyResult(await plugin[method](args));}catch(error){const reason=Object.hasOwn(reasonLabels,error?.code)?error.code:'sdkFailed';return {available:false,complianceAllowed:false,reason,label:reasonLabels[reason]};}};
 return Object.freeze({
  status:()=>call('status'),
  resumeCompliance:()=>call('resumeCompliance'),
  async initialize({privacyAccepted=false}={}){privacy(privacyAccepted);return call('initialize',{privacyAccepted:true});},
  async checkForceUpdate({privacyAccepted=false}={}){privacy(privacyAccepted);return call('checkForceUpdate',{privacyAccepted:true});},
  async openUpdate({privacyAccepted=false}={}){privacy(privacyAccepted);return call('openUpdate',{privacyAccepted:true});},
  async startCompliance({privacyAccepted=false,identityMode='local'}={}){
   privacy(privacyAccepted);if(!['local','tap'].includes(identityMode))throw Object.assign(new Error(reasonLabels.invalidIdentityMode),{code:'invalidIdentityMode'});
   if(identityMode==='tap'){
    if(typeof tap?.login!=='function')return {available:false,complianceAllowed:false,reason:'loginRequired',label:reasonLabels.loginRequired};
    try{await tap.login({privacyAccepted:true});}catch{return {available:false,complianceAllowed:false,reason:'loginRequired',label:reasonLabels.loginRequired};}
   }
   return call('startCompliance',{privacyAccepted:true,identityMode});
  },
  exitCompliance:()=>call('exitCompliance'),
  async subscribe(listener){if(typeof plugin?.addListener!=='function'||typeof listener!=='function')throw Error('认证状态监听未就绪');const handle=await plugin.addListener('compliance',value=>listener(sanitizeTapSafetyResult(value)));return {remove:async()=>{await handle?.remove?.();}};}
 });
}
