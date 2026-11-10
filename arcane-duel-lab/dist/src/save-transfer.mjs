import {normalizeSolo} from './campaign-profile.mjs';
import {mergeTowerWeeklyForImport} from './tower-weekly-state.mjs';
export const SAVE_KEYS=['arcane-solo-growth-v1','arcane-campaign-progress-v1','arcane-duel-profile-v1','arcane-audio-settings-v1'];
export const SAVE_FORMAT='arcane-duel-save';
const limit=4*1024*1024;
const canonical=value=>JSON.stringify(value);
async function digest(text){const bytes=new TextEncoder().encode(text);return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
function values(storage){return Object.fromEntries(SAVE_KEYS.map(k=>[k,storage.getItem(k)]));}
function validateEntries(entries){
 if(!entries||typeof entries!=='object'||Array.isArray(entries)||Object.keys(entries).some(k=>!SAVE_KEYS.includes(k)))throw Error('存档内容不正确');
 const p=entries[SAVE_KEYS[0]];if(typeof p!=='string'||p.length>limit)throw Error('缺少完整角色存档');
 const raw=JSON.parse(p);if(raw?.version!==1||!Array.isArray(raw.owned)||!raw.heroes||!Array.isArray(raw.bag))throw Error('不支持此存档版本');
 // Reject damaged structures before normalization; never silently replace corruption with a fresh save.
 for(const k of ['owned','cleared','firstTickets','pets','bag'])if(raw[k]!==undefined&&!Array.isArray(raw[k]))throw Error('存档列表损坏：'+k);
 for(const k of SAVE_KEYS)if(entries[k]!==null&&entries[k]!==undefined){if(typeof entries[k]!=='string')throw Error('存档字段损坏');JSON.parse(entries[k]);}
 return {...entries,[SAVE_KEYS[0]]:JSON.stringify(normalizeSolo(raw))};
}
export async function exportSave(storage){const entries=values(storage);if(!entries[SAVE_KEYS[0]])entries[SAVE_KEYS[0]]=JSON.stringify(normalizeSolo(null));validateEntries(entries);const payload={format:SAVE_FORMAT,version:1,build:'android1-crossplay-v3',createdAt:new Date().toISOString(),entries};return JSON.stringify({...payload,checksum:await digest(canonical(payload))},null,2);}
export async function inspectSave(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>limit)throw Error('存档文件过大或无效');
 let envelope;try{envelope=JSON.parse(text);}catch{throw Error('存档文件无法读取');}
 const {checksum,...payload}=envelope;
 if(payload.format!==SAVE_FORMAT||payload.version!==1)throw Error('不支持此存档格式');
 if(checksum!==await digest(canonical(payload)))throw Error('存档校验失败，请重新导出');
 return {entries:validateEntries(payload.entries),createdAt:payload.createdAt};
}
export async function importSave(storage,text,{backup=()=>{}}={}){
 const checked=await inspectSave(text),old=values(storage);
 await backup(JSON.stringify({format:'arcane-duel-automatic-backup',version:1,createdAt:new Date().toISOString(),entries:old}));
 const imported=JSON.parse(checked.entries[SAVE_KEYS[0]]);let previous;try{previous=JSON.parse(old[SAVE_KEYS[0]]||'null');}catch{}
 imported.towerWeekly=mergeTowerWeeklyForImport(imported.towerWeekly,previous?.towerWeekly);checked.entries[SAVE_KEYS[0]]=JSON.stringify(imported);
 try{storage.setItem('arcane-save-before-import',JSON.stringify(old));for(const k of SAVE_KEYS){const v=checked.entries[k];if(v==null)storage.removeItem(k);else storage.setItem(k,v);}for(const k of SAVE_KEYS)if(storage.getItem(k)!==(checked.entries[k]??null))throw Error('存档写入校验失败');}
 catch(error){for(const k of SAVE_KEYS)try{old[k]==null?storage.removeItem(k):storage.setItem(k,old[k]);}catch{}throw Error('导入失败，已尝试恢复原存档：'+error.message);}
 return checked;
}
export async function downloadSave(storage){const text=await exportSave(storage),filename='秘境决斗-存档-'+new Date().toISOString().slice(0,10)+'.arcane.json';if(globalThis.arcaneMobile){await globalThis.arcaneMobile.bridge.exportSave({text,filename});return;}const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function pickSave(){if(globalThis.arcaneMobile){const result=await globalThis.arcaneMobile.bridge.importSave();return result.text;}return new Promise(resolve=>{const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>resolve(input.files[0]?await input.files[0].text():null);input.oncancel=()=>resolve(null);input.click();});}
