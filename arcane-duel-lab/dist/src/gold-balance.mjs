// T49: a modest reduction to future combat income; saved wealth and fixed gifts keep their value.
export const COMBAT_GOLD_RATE=.85;
export function earnedGold(amount){return Math.max(0,Math.round((Number(amount)||0)*COMBAT_GOLD_RATE));}
