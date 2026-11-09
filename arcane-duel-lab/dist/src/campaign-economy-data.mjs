// Five current drop qualities; green remains compatible with legacy equipment.
export const EQUIPMENT_DROPS={1:[0,0],2:[0,1],3:[0,2],4:[2,0],5:[2,1],6:[2,2],7:[3,0],9:[3,1],11:[3,2],12:[4,0],13:[4,1],15:[4,2],16:[5,0],18:[5,1],20:[5,2],22:[5,2]};
export const EQUIPMENT_SET_NAMES={0:['旅灯','寒铁','暮铜'],2:['霜晶','潮纹','铭雷'],3:['枯月','镜渊','星棘'],4:['烬曜','断时','苍辰'],5:['日冕','恒曦','蚀日']};
export const STAGE_GOLD=[8,10,12,14,17,20,24,28,33,39,46,54,64,76,90,108,130,158,195,240];
export const ARTIFACT_DROP_STAGES={4:'mirror',9:'skySword',13:'wardRelic',16:'springRelic'};
export const PET_XP_DROP_STAGES={5:'Small',9:'Medium',14:'Large',17:'Large'};
export function newEquipmentName(item){const names=EQUIPMENT_SET_NAMES[item.quality];if(item.collection!==2||!names)return null;return names[Math.max(0,Math.min(2,item.setTier||0))]+(item.slot==='weapon'?(item.role==='melee'?'拳套':'法杖'):(item.role==='melee'?'战甲':'法袍'));}
export function stageEquipment(id,role){const entry=EQUIPMENT_DROPS[id];if(!entry)return [];const [quality,setTier]=entry;return ['weapon','armor'].map(slot=>({type:'equipment',role,slot,quality,setTier,collection:2,stage:id,count:1}));}
