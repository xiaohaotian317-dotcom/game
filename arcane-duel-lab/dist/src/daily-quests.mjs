// Offline daily objectives. All rewards use the same solo profile as the game.
export const DAILY_REWARDS=[100,100,300];
export const DAILY_AD_RECEIPT_LIMIT=4096;
export const validDailyAdReceipt=value=>typeof value==='string'&&value.length>0&&value.length<=256&&value.trim()===value&&!/[\u0000-\u001f\u007f]/.test(value);
export const DAILY_TASKS=[
 {id:'hunt',metric:'minions',goal:35,name:'肃清妖兽',description:'击败35只普通小怪',icon:'hunt'},
 {id:'boss',metric:'bosses',goal:2,name:'首领讨伐',description:'击败2位守关首领',icon:'boss'},
 {id:'skills',metric:'skills',goal:12,name:'秘术研习',description:'成功释放12次英雄技能',icon:'skills'},
 {id:'jumps',metric:'jumps',goal:15,name:'轻身修行',description:'完成15次跳跃',icon:'jumps'},
 {id:'dashes',metric:'dashes',goal:10,name:'疾行试炼',description:'使用10次冲刺',icon:'dashes'},
 {id:'pickups',metric:'pickups',goal:4,name:'寻宝之旅',description:'拾取4件关卡战利品',icon:'pickups'},
 {id:'attacks',metric:'attacks',goal:25,name:'锋芒初试',description:'成功使用25次普攻',icon:'attacks'},
 {id:'clear',metric:'clears',goal:2,name:'秘境巡行',description:'完成2次关卡结算',icon:'clear'},
 {id:'shop-coins',metric:'shopCoins',goal:1,name:'商旅馈赠',description:'在商店成功领取1次金币补给',icon:'treasure',adRelated:true},
 {id:'shop-stone',metric:'shopStone',goal:1,name:'灵石补给',description:'在商店成功领取1次基础灵石',icon:'stone',adRelated:true},
 {id:'shop-exp',metric:'shopExperience',goal:1,name:'修行馈赠',description:'在商店成功领取1次修行灵药',icon:'experience',adRelated:true},
 {id:'shop-ticket',metric:'shopTicket',goal:1,name:'召唤馈赠',description:'在商店成功领取1张抽奖券',icon:'ticket',adRelated:true}
];
const byId=Object.fromEntries(DAILY_TASKS.map(t=>[t.id,t]));
const LEGACY_GOALS={hunt:20,boss:1,skills:5,jumps:10,dashes:5,pickups:3,attacks:15,clear:1};
export function dailyDate(now=new Date()){const d=now instanceof Date?now:new Date(now);if(!Number.isFinite(d.getTime()))throw Error('无效日期');return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function selection(day){let state=2166136261;for(const ch of day)state=Math.imul(state^ch.charCodeAt(0),16777619)>>>0;const list=DAILY_TASKS.map(t=>t.id);for(let i=list.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[list[i],list[j]]=[list[j],list[i]];}const selected=list.slice(0,5);let shops=selected.filter(id=>byId[id].adRelated).length;for(let i=selected.length-1;shops<2&&i>=0;i--)if(!byId[selected[i]].adRelated){selected[i]=list.find(id=>byId[id].adRelated&&!selected.includes(id));shops++;}for(let i=selected.length-1;shops>3&&i>=0;i--)if(byId[selected[i]].adRelated){selected[i]=list.find(id=>!byId[id].adRelated&&!selected.includes(id));shops--;}return selected;}
export function normalizeDaily(raw,now=new Date()){
 const day=dailyDate(now),valid=raw?.day===day;
 const ids=valid&&Array.isArray(raw.taskIds)?[...new Set(raw.taskIds.filter(id=>byId[id]))]:[];
 const preserve=ids.length===5,taskIds=preserve?ids:selection(day),progress={},taskGoals={};
 // A valid existing day's thresholds are a snapshot, so raising defaults never
 // invalidates a finished legacy task or rerolls its task list mid-day.
 for(const id of taskIds){const n=raw?.taskGoals?.[id];taskGoals[id]=valid&&preserve&&Number.isSafeInteger(n)&&n>0&&n<=100000?n:valid&&preserve&&LEGACY_GOALS[id]&&raw?.taskGoals===undefined?LEGACY_GOALS[id]:byId[id].goal;}
 for(const task of DAILY_TASKS){const n=raw?.progress?.[task.metric];progress[task.metric]=valid&&Number.isSafeInteger(n)&&n>=0?Math.min(n,100000):0;}
 const claimed=valid&&Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter(id=>taskIds.includes(id)&&progress[byId[id].metric]>=taskGoals[id]))].slice(0,3):[];
 const receipts=Array.isArray(raw?.adReceipts)?raw.adReceipts:[],adReceipts=[...new Set(receipts.filter(validDailyAdReceipt))].slice(0,DAILY_AD_RECEIPT_LIMIT);
 let adBlocked=raw?.adBlocked===true||raw?.adReceipts!==undefined&&!Array.isArray(raw.adReceipts)||receipts.some(r=>!validDailyAdReceipt(r))||receipts.length>DAILY_AD_RECEIPT_LIMIT;
 const adBonuses=[],seen=new Set();if(valid&&raw?.adBonuses!==undefined&&!Array.isArray(raw.adBonuses))adBlocked=true;
 if(valid&&Array.isArray(raw?.adBonuses))for(const bonus of raw.adBonuses){const index=claimed.indexOf(bonus?.taskId);if(index<0||seen.has(bonus.taskId)||bonus.coins!==DAILY_REWARDS[index]||!validDailyAdReceipt(bonus.receipt)||!adReceipts.includes(bonus.receipt)){adBlocked=true;continue;}seen.add(bonus.taskId);adBonuses.push({taskId:bonus.taskId,coins:bonus.coins,receipt:bonus.receipt});}
 return {day,taskIds,taskGoals,progress,claimed,adBonuses,adReceipts,adBlocked};
}
export function dailyState(profile,now=new Date()){const next=normalizeDaily(profile.daily,now);profile.daily=next;return next;}
export function advanceDaily(profile,metric,amount=1,now=new Date()){
 if(!profile||!DAILY_TASKS.some(t=>t.metric===metric)||!Number.isSafeInteger(amount)||amount<=0)return false;
 const s=dailyState(profile,now);s.progress[metric]=Math.min(100000,s.progress[metric]+amount);return true;
}
export function dailyView(profile,now=new Date()){
 const state=dailyState(profile,now),count=state.claimed.length;
 const baseTotal=DAILY_REWARDS.slice(0,count).reduce((sum,n)=>sum+n,0),bonusTotal=state.adBonuses.reduce((sum,b)=>sum+b.coins,0);
 return {...state,count,baseTotal,bonusTotal,total:baseTotal+bonusTotal,tasks:state.taskIds.map(id=>{const t=byId[id],goal=state.taskGoals[id];return {...t,goal,description:t.description.replace(/\d+/,String(goal)),current:Math.min(goal,state.progress[t.metric]||0),complete:state.progress[t.metric]>=goal,claimed:state.claimed.includes(id)};})};
}
export function claimDaily(profile,id,now=new Date()){
 const state=dailyState(profile,now),task=byId[id];
 if(!task||!state.taskIds.includes(id))throw Error('今天没有这项任务');
 if(state.claimed.includes(id))throw Error('这项任务已领取');
 if(state.claimed.length>=3)throw Error('今日基础500金币已全部领取');
 if(state.progress[task.metric]<state.taskGoals[id])throw Error('任务尚未完成');
 if(!Number.isSafeInteger(profile.coins)||profile.coins<0)throw Error('金币数据无效');
 const reward=DAILY_REWARDS[state.claimed.length];state.claimed.push(id);profile.coins+=reward;
 return {reward,total:DAILY_REWARDS.slice(0,state.claimed.length).reduce((sum,n)=>sum+n,0),tier:state.claimed.length};
}
