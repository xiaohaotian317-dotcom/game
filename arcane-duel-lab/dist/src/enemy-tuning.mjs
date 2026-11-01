// Relative to campaign1. Range is independent of the smaller body artwork.
export const BOSS_TUNING=Object.freeze({scale:.72,previousScale:.8,health:1.1,movement:.85,frequency:1.2,range:1.2,fallSpeed:1.2});
export const bossReachScale=d=>d.boss?BOSS_TUNING.previousScale*BOSS_TUNING.range:1;
