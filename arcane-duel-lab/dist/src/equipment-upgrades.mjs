export const EQUIPMENT_BASE_COSTS=Object.freeze([60,100,150,400,700,1000]);
export function equipmentUpgradeCost(item){
 if(item?.type!=='equipment'||!['weapon','armor'].includes(item.slot))return null;
 const quality=Number.isInteger(item.quality)?Math.max(0,Math.min(5,item.quality)):0,level=Number.isInteger(item.level)?Math.max(0,item.level):0;
 if(level>=10)return null;
 return Math.ceil(EQUIPMENT_BASE_COSTS[quality]*(1+.35*level+.08*level*level)/10)*10;
}
