// Relative to campaign1. Range is independent of the smaller body artwork.
export const BOSS_TUNING=Object.freeze({scale:.72,previousScale:.8,health:1.1,movement:.85*1.03,frequency:1.2,range:1.2,fallSpeed:1.2});
export const ENEMY_DAMAGE=Object.freeze({minion:1.10*1.20,boss:1.07*1.10});
export const enemyDamageFactor=e=>(e?.damageFactor??1)*(e?.enemyKind?.startsWith('B')?ENEMY_DAMAGE.boss:ENEMY_DAMAGE.minion);
export const bossReachScale=d=>d.boss?BOSS_TUNING.previousScale*BOSS_TUNING.range:1;
