import {BASE_STATS,QUALITY,SOLO_BALANCE} from './campaign-growth-data.mjs';

const ROLL_KEYS=['attack','health','armor','crit','lifesteal'];
const RANK_POWER=[0,.15,.35,.65];
const LIFESTEAL=[0,.002,.005,.012,.022,.035];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const integer=(value,max)=>{
 const n=typeof value==='number'||typeof value==='string'?Number(value):0;
 return Number.isFinite(n)?clamp(Math.floor(n),0,max):0;
};
const format=value=>String(Number(value.toFixed(2)));

// Missing rolls keep the original fixed bonuses, including equipment in old saves.
export function normalizeEquipmentRolls(value){
 return Object.fromEntries(ROLL_KEYS.map(key=>{
  const n=value?.[key];
  return [key,Number.isFinite(n)?clamp(n,.9,1.1):1];
 }));
}

// Call once when creating a new item, then persist the returned object as item.rolls.
export function rollEquipment(random=Math.random){
 return normalizeEquipmentRolls(Object.fromEntries(ROLL_KEYS.map(key=>[key,.9+random()*.2])));
}

export function equipmentBonuses(item){
 const result={attack:0,healthRatio:0,armor:0,crit:0,lifesteal:0,attackSpeed:0,regen:0};
 if(item?.type!=='equipment'||!['weapon','armor'].includes(item.slot))return result;
 const quality=integer(item.quality,QUALITY.length-1),level=integer(item.level,10),rank=integer(item.rank,3);
 const rolls=normalizeEquipmentRolls(item.rolls),bonus=QUALITY[quality].power*(item.collection===2?1+.2*Math.max(0,Math.min(2,item.setTier||0)):1)+level*.025+RANK_POWER[rank];
 if(item.slot==='weapon'){
  result.attack=10*bonus*rolls.attack;
  result.crit=quality*.012*rolls.crit;
  result.lifesteal=LIFESTEAL[quality]*rolls.lifesteal;
  result.attackSpeed=Math.min(.15,level*.01);
 }else{
  result.healthRatio=bonus*.55*rolls.health;
  result.armor=Math.min(.25,bonus*.14*rolls.armor);
  result.regen=Math.min(1,.1+quality*.08+rank*.1);
 }
 return result;
}

export function equipmentAttributeRows(item,hero='fire'){
 const b=equipmentBonuses(item),hp=(Object.hasOwn(BASE_STATS,hero)?BASE_STATS[hero]:BASE_STATS.fire)[0];
 return [
  ['attack','攻击力',b.attack*SOLO_BALANCE.attack,''],
  ['health','生命值',hp*b.healthRatio*SOLO_BALANCE.health,''],
  ['armor','防御',b.armor*100,'%'],
  ['crit','暴击率',b.crit*100,'%'],
  ['lifesteal','吸血',b.lifesteal*100,'%'],
  ['attackSpeed','攻击速度',b.attackSpeed*100,'%'],
  ['regen','生命回复',b.regen,'/秒']
 ].filter(([, ,value])=>value>0).map(([key,label,value,unit])=>({key,label,value:`+${format(value)}${unit}`}));
}
