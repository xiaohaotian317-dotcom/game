export const GUIDE_STEPS=['start','summon','tickets','return-pool','shop','shop-intro','return-shop','explore','map','detail','team','battle','reward','menu','menus','done'];
export function freshOnboarding(){return {version:1,step:'start',menuIndex:0,tutorialRewardClaimed:false};}
export function normalizeOnboarding(raw,{legacy=false}={}){
 const value=freshOnboarding();if(!raw)return {...value,step:legacy?'done':'start'};
 value.step=GUIDE_STEPS.includes(raw.step)?raw.step:'start';value.menuIndex=Math.max(0,Math.min(6,Math.floor(Number(raw.menuIndex)||0)));value.tutorialRewardClaimed=raw.tutorialRewardClaimed===true;return value;
}
// The caller commits this complete draft before showing or recording the reward.
export function tutorialRewardDraft(profile){
 const next=structuredClone(profile);next.onboarding=normalizeOnboarding(next.onboarding);
 if(next.onboarding.tutorialRewardClaimed)return {profile:next,coins:0};
 next.coins+=500;next.onboarding.tutorialRewardClaimed=true;
 if(next.onboarding.step!=='done')next.onboarding.step='reward';
 return {profile:next,coins:500};
}
