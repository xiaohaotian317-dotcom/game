export const ENDLESS_COOLDOWN=48*60*60*1000;
const valid=n=>Number.isSafeInteger(n)&&n>=0?n:0;
export function normalizeChallenges(raw){return {endlessEnteredAt:valid(raw?.endlessEnteredAt),endlessBest:Math.min(100000,valid(raw?.endlessBest)),endlessRuns:valid(raw?.endlessRuns)};}
export function endlessRemaining(profile,now=Date.now()){const state=normalizeChallenges(profile.challenges);return state.endlessEnteredAt?Math.max(0,state.endlessEnteredAt+ENDLESS_COOLDOWN-Math.max(0,now)):0;}
export function enterEndless(profile,now=Date.now()){
 if(!Number.isSafeInteger(now)||now<=0)throw Error('无法确认挑战时间');
 if(endlessRemaining(profile,now))throw Error('轮回裂隙尚未恢复，请等待48小时冷却结束');
 profile.challenges={...normalizeChallenges(profile.challenges),endlessEnteredAt:now,endlessRuns:normalizeChallenges(profile.challenges).endlessRuns+1};return profile.challenges;
}
export function endlessDifficulty(cycle){
 const round=Math.max(1,Math.floor(cycle)||1),level=[2,5,10,15,22,30,40,55,70,90][round-1]??90+(round-10)*20,scale=1+(level-2)*.15+Math.max(0,round-5)**1.6*.1;
 return {round,level,minionHp:Math.round(32*scale*(1+round*.14)),bossHp:Math.round(400*scale*(1+round*.16)),damageFactor:.55+level*.12,bossDamageFactor:.8+level*.17,killCoins:Math.round(12+level*4+round*6),killXp:[52,97,164,231,400,1200,3000,5600,8200,12000][round-1]??Math.round(12000*(1.25**Math.min(40,round-10))),bossCoins:Math.round(140+level*35+round*80),bossXp:[510,910,1490,2070,6000,18000,42000,80000,130000,200000][round-1]??Math.round(200000*(1.25**Math.min(40,round-10))),perSide:Math.min(10,6+Math.floor(round/3)),hazardDamage:Math.round(4+level*.5)};
}
export function endlessRoster(cycle,random=Math.random){
 const melee=['M06','M01','M04','M05','M10','M11','M12','M13','M14','M15','M16','M20'],ranged=['M07','M08','M09','M17','M18','M19'],bosses=Array.from({length:20},(_,i)=>'B'+String(i+1).padStart(2,'0'));
 const pick=list=>list[Math.min(list.length-1,Math.max(0,Math.floor((Number(random())||0)*list.length)))];return {...endlessDifficulty(cycle),melee:pick(melee),ranged:pick(ranged),boss:pick(bosses)};
}
