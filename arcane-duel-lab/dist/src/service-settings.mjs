import {TapSafety} from './tap-safety.mjs';
let instance,gate,gateStatus,required=false,enforced=false,installed=false,policyDialog,rememberedConsent=false;
export const safetyAllowsPlay=()=>!enforced||instance?.snapshot().allowed===true;
export function currentSafety(){return instance??=new TapSafety(globalThis.arcaneTapSafetyProvider||null);}
function style(){if(document.querySelector('[data-service-style]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href=new URL('../service-settings.css',import.meta.url).href;link.dataset.serviceStyle='';document.head.append(link);}
export function openPrivacyPolicy(){
 style();if(!policyDialog){policyDialog=document.createElement('dialog');policyDialog.className='service-policy-view';policyDialog.innerHTML='<header><strong>隐私政策与SDK清单</strong><button type="button" aria-label="关闭隐私政策">×</button></header><iframe title="秘境决斗隐私政策" src="mobile-privacy.html"></iframe>';policyDialog.querySelector('iframe').src=new URL('../mobile-privacy.html',import.meta.url).href;document.body.append(policyDialog);policyDialog.querySelector('button').onclick=()=>policyDialog.close();}
 if(!policyDialog.open)policyDialog.showModal();
}
function safetyGate(){
 if(gate)return gate;style();gate=document.createElement('dialog');gate.className='platform-safety-gate';gate.setAttribute('aria-labelledby','safety-gate-title');
 gate.innerHTML='<small>THE GUARDIAN OF THE REALM</small><h2 id="safety-gate-title">实名认证与游玩限制</h2><p data-safety-message role="status"></p><p>认证由TapTap官方服务处理，本游戏不会向客服传递你的完整实名资料。</p><label><input type="checkbox" data-safety-consent> 我已阅读并同意本游戏及TapSDK隐私说明</label><button type="button" data-safety-policy>阅读隐私政策</button><div class="service-actions"><button type="button" data-safety-start>开始官方认证</button><button type="button" data-safety-quit>退出游戏</button></div>';
 document.body.append(gate);gateStatus=gate.querySelector('[data-safety-message]');gate.querySelector('input').checked=rememberedConsent;gate.querySelector('[data-safety-policy]').onclick=openPrivacyPolicy;
 gate.addEventListener('cancel',e=>e.preventDefault());
 gate.querySelector('[data-safety-start]').onclick=async()=>{if(!gate.querySelector('input').checked){gateStatus.textContent='请先阅读并勾选隐私说明。';return;}const b=gate.querySelector('[data-safety-start]');b.disabled=true;try{await currentSafety().startCompliance({privacyAccepted:true});}catch(e){gateStatus.textContent=e.message;}finally{b.disabled=false;}};
 gate.querySelector('[data-safety-quit]').onclick=()=>globalThis.arcaneMobile?.bridge?.quit?.();return gate;
}
function renderSafety(state){
 if(!enforced)return;if(state.allowed){if(gate?.open)gate.close();return;}
 globalThis.dispatchEvent(new Event('arcane:input-reset'));globalThis.dispatchEvent(new Event('arcane:safety-restricted'));
 const d=safetyGate();gateStatus.textContent=state.label||'请完成官方认证后继续。';if(!d.open)d.showModal();
}
export async function installPlatformSafety(){
 if(installed||!globalThis.arcaneMobile||!globalThis.arcaneTapSafetyProvider)return;installed=true;enforced=true;let resolving=true;const service=currentSafety();
 service.onChange(state=>{if(!resolving)renderSafety(state);});
 try{await service.observe();const status=await service.status();rememberedConsent=status.privacyAccepted===true;required=status.required===true;enforced=required||Number(status.complianceRevision)>0;if(enforced&&rememberedConsent)await service.resumeCompliance();resolving=false;if(!enforced&&gate?.open)gate.close();renderSafety(service.snapshot());}
 catch{resolving=false;enforced=true;renderSafety({allowed:false,label:'认证状态暂未读取成功，请重试官方认证或退出游戏。'});}
 globalThis.addEventListener('arcane:foreground',()=>{service.status().then(async s=>{required=s.required===true;enforced||=required||Number(s.complianceRevision)>0;if(enforced&&s.privacyAccepted===true&&s.reason==='unchecked')await service.resumeCompliance();renderSafety(service.snapshot());}).catch(()=>{});});
}
export function serviceSettingsMarkup(){return `<h3>旅程与账号</h3><div class="service-settings-grid"><button type="button" data-service-policy><b>隐私政策</b><small>信息处理与第三方SDK</small></button><button type="button" data-service-compliance><b>实名认证</b><small>TapTap官方认证流程</small></button><button type="button" data-service-update><b>前往TapTap更新</b><small>使用已安装的TapTap客户端</small></button></div><label class="service-consent"><input type="checkbox" data-service-consent> 使用认证或更新前，我已阅读并同意本游戏及TapSDK隐私说明</label><div class="service-privacy-footer"><span>客服：13891746392@163.com</span><button type="button" data-service-withdraw>撤回服务授权</button></div>`;}
export function bindServiceSettings(settings){
 style();const el=settings.el,pane=el.querySelector('[data-pane="service"]'),bridge=globalThis.arcaneMobile?.bridge;
 const consent=()=>pane.querySelector('[data-service-consent]').checked,notify=m=>settings.status(m);
 pane.querySelector('[data-service-policy]').onclick=openPrivacyPolicy;
 for(const name of ['compliance','update'])pane.querySelector('[data-service-'+name+']').onclick=async e=>{
  if(!consent()){notify('请先阅读并勾选隐私说明。');return;}if(!globalThis.arcaneTapSafetyProvider){notify('此功能在安卓客户端使用，单机存档不受影响。');return;}
  const b=e.currentTarget;b.disabled=true;try{const s=currentSafety();if(name==='compliance'){enforced=true;const result=await s.startCompliance({privacyAccepted:true});renderSafety(result);notify(result.label);}else{const result=await s.openUpdate({privacyAccepted:true});notify(result.requested?'已请求TapTap检查更新；当前商店未公开时可能暂无可更新版本。':result.label||'请安装TapTap客户端后重试。');}}catch(error){notify(error.message);}finally{b.disabled=false;}
 };
 pane.querySelector('[data-service-withdraw]').onclick=()=>{
  if(!bridge?.withdrawServiceConsent){notify('此功能在安卓客户端使用；单机档案可通过系统应用设置管理。');return;}
  const confirmation=document.createElement('dialog');confirmation.className='service-withdraw-dialog';confirmation.innerHTML='<h2>撤回服务授权并退出</h2><p>将停止TapTap与广告服务并退出游戏。单机存档保留；再次使用在线或广告功能时需要重新同意。</p><div class="service-actions"><button type="button" data-cancel>保留授权</button><button type="button" data-confirm>确认撤回并退出</button></div><p role="status"></p>';document.body.append(confirmation);confirmation.addEventListener('close',()=>confirmation.remove());confirmation.querySelector('[data-cancel]').onclick=()=>confirmation.close();confirmation.querySelector('[data-confirm]').onclick=async e=>{e.currentTarget.disabled=true;try{globalThis.dispatchEvent(new Event('arcane:background'));await currentSafety().exitCompliance().catch(()=>{});await bridge.withdrawServiceConsent({confirmed:true});}catch(error){globalThis.dispatchEvent(new Event('arcane:foreground'));confirmation.querySelector('[role="status"]').textContent=error.message;e.currentTarget.disabled=false;}};confirmation.showModal();
 };
}
