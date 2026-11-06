export const AUDIO_KEY='arcane-audio-settings-v1';
export const AUDIO_DEFAULTS=Object.freeze({enabled:true,volume:.8,effectsEnabled:true,effectsVolume:.8,musicEnabled:true,musicVolume:.35});
const level=(value,fallback)=>typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):fallback;
export function normalizeAudio(value,legacy=true){const v=value&&typeof value==='object'?value:{};return {enabled:typeof v.enabled==='boolean'?v.enabled:legacy!==false,volume:level(v.volume,.8),effectsEnabled:v.effectsEnabled!==false,effectsVolume:level(v.effectsVolume,.8),musicEnabled:v.musicEnabled!==false,musicVolume:level(v.musicVolume,.35)};}
export function loadAudio(storage){let value,legacy;try{value=JSON.parse(storage?.getItem(AUDIO_KEY)||'null');}catch{}try{legacy=JSON.parse(storage?.getItem('arcane-duel-profile-v1')||'null');}catch{}return normalizeAudio(value,legacy?.sound);}
export function audioGains(p){return {master:p.enabled?p.volume:0,effects:p.effectsEnabled?p.effectsVolume*.7:0,music:p.musicEnabled?p.musicVolume:0};}
export class AudioPreferences{
 constructor(storage){this.storage=storage;this.value=loadAudio(storage);this.listeners=new Set();}
 subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
 notify(){for(const fn of this.listeners)fn(this.value);}
 update(patch){const next=normalizeAudio({...this.value,...patch});let saved=true;try{this.storage?.setItem(AUDIO_KEY,JSON.stringify(next));if(!this.storage)throw Error();}catch{saved=false;}this.value=next;this.notify();return saved;}
 reload(){this.value=loadAudio(this.storage);this.notify();}
}
let shared;
export function audioPreferences(){if(!shared){let storage;try{storage=globalThis.localStorage;}catch{}shared=new AudioPreferences(storage);if(typeof window!=='undefined')window.addEventListener('storage',e=>{if(e.key===AUDIO_KEY)shared.reload();});}return shared;}
