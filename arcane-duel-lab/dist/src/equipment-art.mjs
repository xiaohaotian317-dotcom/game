import META from '../assets/equipment-sets/atlas-meta-v2.json' with {type:'json'};
export function equipmentArt(item){if(item?.collection!==2)return null;const f=META.units[`q${item.quality}-${'ABC'[item.setTier||0]}-${item.role}-${item.slot}`];return f?{...f,file:'../equipment-sets/'+f.file}:null;}
