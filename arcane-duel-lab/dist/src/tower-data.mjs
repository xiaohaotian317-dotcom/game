import {CAMPAIGN_STAGES} from './campaign-data.mjs';
import {TOWER_RULES} from './tower-state.mjs';
// Tower strength is independent of story/endless tuning and story completion.
export function towerFloor(number=1){
 const floor=Math.max(1,Math.min(TOWER_RULES.maxFloor,Math.floor(Number(number)||1))),boss=floor%TOWER_RULES.bossEvery===0;
 const base=CAMPAIGN_STAGES[(Math.floor((floor-1)/5)+floor-1)%CAMPAIGN_STAGES.length];
 const growth=Math.pow(1.125,Math.min(80,floor-1))*Math.pow(1+Math.max(0,floor-81)*.12,2)*(1+Math.floor((floor-1)/10)*.12);
 return {...base,id:base.id,artStageId:base.id,mode:'tower',requires:[],towerFloor:floor,name:`无尽之塔 · 第${floor}层`,building:boss?'守层首领':'试炼妖兽',tip:boss?'击败守层首领，继续攀登。':'清理本层妖兽，保留生命与法力继续攀登。',boss:boss?base.boss:null,bosses:undefined,melee:base.melee,ranged:base.ranged,minionHp:Math.round(32*growth),bossHp:Math.round(280*growth),damageFactor:.65*Math.pow(1.065,Math.min(80,floor-1))*(1+Math.max(0,floor-81)*.06),bossDamageFactor:.95*Math.pow(1.065,Math.min(80,floor-1))*(1+Math.max(0,floor-81)*.06),attackBudget:Math.min(6,2+Math.floor((floor-1)/10)),towerCount:Math.min(8,4+Math.floor((floor-1)/10)),environmentHazards:false,killCoins:0,killXp:0,bossCoins:0,bossXp:0,hazardDamage:0};
}
