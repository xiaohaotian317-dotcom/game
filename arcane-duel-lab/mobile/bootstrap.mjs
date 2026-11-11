import {Capacitor,registerPlugin} from '@capacitor/core';
import {App} from '@capacitor/app';
import {createAdsProvider} from './ads-provider.mjs';
import {createTowerProvider} from './tower-provider.mjs';
import {createTapSafetyProvider} from './tap-safety-provider.mjs';
if(Capacitor.isNativePlatform()){
 const bridge=registerPlugin('ArcaneBridge'),tap=registerPlugin('TapBattle'),adsPlugin=registerPlugin('ArcaneAds');
 window.arcaneMobile={bridge,tap,ads:createAdsProvider(adsPlugin),platform:'android',build:'android1-crossplay'};
 globalThis.arcaneTowerProvider=createTowerProvider(registerPlugin('TapLeaderboard'));
 globalThis.arcaneTapSafetyProvider=createTapSafetyProvider(registerPlugin('TapSafety'),tap);
 const insets=()=>bridge.insets().then(v=>{for(const key of ['top','right','bottom','left'])document.documentElement.style.setProperty('--native-safe-'+key,(Number(v[key])||0)+'px');}).catch(()=>{});
 insets();window.addEventListener('resize',insets);window.addEventListener('arcane:foreground',insets);
 window.addEventListener('unhandledrejection',e=>console.error('mobile',e.reason));
 await App.addListener('appStateChange',({isActive})=>{window.dispatchEvent(new Event(isActive?'arcane-foreground':'arcane-background'));window.dispatchEvent(new Event(isActive?'arcane:foreground':'arcane:background'));});
 await App.addListener('backButton',()=>window.dispatchEvent(new Event('arcane-back')));
}
await import('../dist/src/platform.mjs');
