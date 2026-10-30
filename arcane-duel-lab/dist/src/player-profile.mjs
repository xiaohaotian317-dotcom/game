export const HERO_ORDER=Object.freeze(['fire','nature','frost','lightning','shadow','star']);
export const PROFILE_KEY='arcane-duel-profile-v1';
export const SUMMON_RULES=Object.freeze({single:100,ten:900,duplicate:20});
export function freshProfile(){return {version:1,coins:2400,owned:['fire','nature'],selected:'fire',sound:true,totalSummons:0};}
export function normalizeProfile(value){
  if(!value||value.version!==1)return freshProfile();
  const owned=[...new Set(['fire','nature',...(Array.isArray(value.owned)?value.owned.filter(h=>HERO_ORDER.includes(h)):[])])];
  return {version:1,coins:Number.isSafeInteger(value.coins)&&value.coins>=0?Math.min(value.coins,1e7):2400,owned,selected:owned.includes(value.selected)?value.selected:'fire',sound:value.sound!==false,totalSummons:Number.isSafeInteger(value.totalSummons)&&value.totalSummons>=0?value.totalSummons:0};
}
export function loadProfile(storage){try{return normalizeProfile(JSON.parse(storage.getItem(PROFILE_KEY)));}catch{return freshProfile();}}
export function saveProfile(storage,profile){try{storage.setItem(PROFILE_KEY,JSON.stringify(profile));return true;}catch{return false;}}
export function summonHeroes(profile,count,random=Math.random){
  if(count!==1&&count!==10)throw new Error('请选择单次或十次召唤');
  const cost=count===10?SUMMON_RULES.ten:SUMMON_RULES.single,p=normalizeProfile(profile);
  if(p.coins<cost)throw new Error('体验金币不足');
  p.coins-=cost;const results=[];
  for(let i=0;i<count;i++){const roll=random();if(!Number.isFinite(roll)||roll<0||roll>=1)throw new Error('召唤结果无效');const hero=HERO_ORDER[Math.floor(roll*HERO_ORDER.length)],isNew=!p.owned.includes(hero);if(isNew)p.owned.push(hero);else p.coins+=SUMMON_RULES.duplicate;results.push({hero,isNew,refund:isNew?0:SUMMON_RULES.duplicate});}
  p.totalSummons+=count;return {profile:p,results,cost,refund:results.reduce((n,r)=>n+r.refund,0)};
}
