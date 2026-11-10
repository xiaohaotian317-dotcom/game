import {applyControlOpacity} from './mobile-preferences.mjs';
export const MOBILE_BUILD='android1-crossplay-v3';
export const mobile=()=>globalThis.arcaneMobile||null;
export const nativeBridge=()=>mobile()?.bridge||globalThis.arcaneDesktop||null;
export const touchEnabled=()=>!!mobile()||(typeof location!=='undefined'&&new URLSearchParams(location.search).get('touch')==='1');
export async function roomRequest(path,body,token){
 const bridge=mobile()?.bridge;
 if(!bridge)return null;
 return bridge.request({path:'/api/duel/'+path,method:'POST',body:JSON.stringify(body),token:token||''});
}
export function onPlatformBackground(fn){globalThis.addEventListener?.('arcane-background',fn);}
export function installMobileShell(){
 if(!touchEnabled()||typeof document==='undefined'||document.documentElement.dataset.mobileShell)return;
 document.documentElement.dataset.mobileShell='true';
 document.documentElement.dataset.mobile='true';
 applyControlOpacity();
 import('./mobile-panel-layout.mjs').then(m=>m.installMobilePanelLayout());
 const viewport=document.querySelector('meta[name="viewport"]');if(viewport)viewport.content='width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
 if(!document.querySelector('[data-mobile-style]'))for(const href of ['mobile-layout.css','mobile-controls.css','mobile-controls-art.css']){const link=document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.mobileStyle='';document.head.append(link);}
 document.addEventListener('click',e=>{const a=e.target.closest?.('a[href]');if(a&&/^(?:\.\/)?duel(?:\.html)?(?:[?#]|$)/.test(a.getAttribute('href'))&&!location.pathname.includes('mobile-network')){e.preventDefault();location.href='mobile-network.html';}},true);
 globalThis.addEventListener('arcane-back',()=>{
  const pageBack=new Event('arcane:navigate-back',{cancelable:true});if(!globalThis.dispatchEvent(pageBack))return;
  const dialogs=[...document.querySelectorAll('dialog[open]')];if(dialogs.length){const d=dialogs.at(-1),event=new Event('cancel',{cancelable:true});if(d.dispatchEvent(event))d.close();return;}
  const paused=document.querySelector('#pause-dialog[open]');if(paused)return;
  const pause=document.querySelector('#pause,#pause-button');if(pause&&!pause.hidden&&pause.getClientRects().length){pause.click();return;}
  if(!/\/(index\.html)?$/.test(location.pathname))location.href='lobby.html';else document.querySelector('[data-exit-app]')?.click();
 });
 document.addEventListener('pointerup',e=>{if(e.pointerType==='touch'){const el=e.target.closest?.('[title]');if(el&&el.title&&!el.matches('button,a,input,select')){let tip=document.querySelector('.mobile-item-tip');if(!tip){tip=document.createElement('div');tip.className='mobile-item-tip';tip.role='status';document.body.append(tip);}tip.textContent=el.title;tip.hidden=false;clearTimeout(tip.timer);tip.timer=setTimeout(()=>tip.hidden=true,3500);}}});
}
if(typeof document!=='undefined')installMobileShell();
