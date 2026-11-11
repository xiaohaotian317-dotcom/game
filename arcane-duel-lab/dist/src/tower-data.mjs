import {CAMPAIGN_STAGES} from './campaign-data.mjs';
import {TOWER_RULES} from './tower-state.mjs';
// Tower strength is independent of story/endless tuning and story completion.
export function towerFloor(number=1){
 const floor=Math.max(1,Math.min(TOWER_RULES.maxFloor,Math.floor(Number(number)||1))),n=floor-1;
 const base=CAMPAIGN_STAGES[(Math.floor((floor-1)/5)+floor-1)%CAMPAIGN_STAGES.length];
 // Convex, finite growth: later floors add more threat without multiplying
 // animation speed, hit areas or enemy count until the arena becomes unreadable.
 const growth=1+.24*n+.032*n*n+.0007*n*n*n;
 return {...base,id:base.id,artStageId:base.id,mode:'tower',requires:[],towerFloor:floor,name:`无尽之塔 · 第${floor}层`,building:'守层首领',tip:'清理一波妖兽，再击败守层首领；生命与法力保留至下一层。',boss:base.boss,bosses:undefined,melee:base.melee,ranged:base.ranged,minionHp:Math.round(48*growth),bossHp:Math.round(480*growth),damageFactor:.82+.085*n+.003*n*n+.000018*n*n*n,bossDamageFactor:1.15+.12*n+.0042*n*n+.000026*n*n*n,attackBudget:Math.min(6,2+Math.floor(n/12)),towerCount:Math.min(12,6+Math.floor(n/10)),environmentHazards:false,killCoins:0,killXp:0,bossCoins:0,bossXp:0,hazardDamage:0};
}
