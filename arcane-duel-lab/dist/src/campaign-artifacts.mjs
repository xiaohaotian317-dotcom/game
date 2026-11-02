export const ARTIFACTS={mirror:{name:'收妖镜',item:'mirror',maxLevel:10,description:'摄取野生灵宠。降低目标生命后，在范围内按V捕捉。'},sword:{name:'御天剑',item:'skySword',maxLevel:10,description:'装备提升基础攻击；按住Q在鼠标落点持续降下剑雨。'}};
export function artifactLevel(p,id){return p?.artifacts?.[id]?.level||0;}
export function artifactUpgradeCost(p,id){const definition=ARTIFACTS[id],level=artifactLevel(p,id);return definition&&level>0&&level<definition.maxLevel?150+(level-1)*100:null;}
export function upgradeArtifact(p,id){const cost=artifactUpgradeCost(p,id);if(cost===null)throw Error('法宝尚未获得或已经满级');if(p.coins<cost)throw Error('金币不足');p.coins-=cost;p.artifacts[id].level++;return `${ARTIFACTS[id].name}升级至 Lv.${p.artifacts[id].level}`;}
export function grantArtifact(p,id){if(!ARTIFACTS[id])throw Error('未知法宝');p.artifacts??={};p.artifacts[id]??={level:1};return p.artifacts[id];}
export function normalizeArtifacts(raw){const out={};for(const id of Object.keys(ARTIFACTS)){const level=raw?.[id]?.level;if(Number.isInteger(level)&&level>=1)out[id]={level:Math.min(level,ARTIFACTS[id].maxLevel)};}return out;}
export function mirrorRules(p){const n=Math.max(0,artifactLevel(p,'mirror')-1);return {range:420+n*10,cooldown:6-n*.15,channel:1.15,chanceBonus:n*.01};}

export function equippedArtifact(p){return p?.artifacts?.[p.equippedArtifact]?p.equippedArtifact:p?.mirrorEquipped&&p?.artifacts?.mirror?'mirror':null;}
export function equipArtifact(p,id){if(id!==null&&!artifactLevel(p,id))throw Error('尚未获得此法宝');p.equippedArtifact=id;p.mirrorEquipped=id==='mirror';return id?'已装备'+ARTIFACTS[id].name:'已卸下法宝';}
export function artifactBonuses(p){const id=equippedArtifact(p),level=artifactLevel(p,id);return {health:id==='mirror'?20+(level-1)*5:0,attack:id==='sword'?3+(level-1):0};}
export function swordRules(p){const n=Math.max(0,artifactLevel(p,'sword')-1);return {damage:16+n*3,radius:140,reach:600,fall:.28,interval:.24,duration:3.6,cooldown:8,startMana:8,manaPerSecond:6};}
