export const SUMMON_GUARANTEE=20;
export const SUMMON_PROBABILITY_TIERS=Object.freeze([
 Object.freeze({first:1,last:10,chance:.01}),
 Object.freeze({first:11,last:15,chance:.05}),
 Object.freeze({first:16,last:19,chance:.10}),
 Object.freeze({first:20,last:SUMMON_GUARANTEE,chance:1})
]);
// Draw numbers are per target pool, with the next draw numbered pity + 1.
export function summonProbabilityForDraw(draw){
 if(!Number.isInteger(draw)||draw<1||draw>SUMMON_GUARANTEE)throw new RangeError('无效的召唤次数');
 return SUMMON_PROBABILITY_TIERS.find(tier=>draw>=tier.first&&draw<=tier.last).chance;
}
export function summonProbabilityRules(){
 return SUMMON_PROBABILITY_TIERS.map(({first,last,chance})=>`第${first===last?first:first+'～'+last}抽${Math.round(chance*100)}%${last===SUMMON_GUARANTEE?'，必得当前目标英雄':''}`).join('；')+'。';
}
