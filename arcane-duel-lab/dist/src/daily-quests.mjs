// Offline daily objectives. All rewards use the same solo profile as the game.
export const DAILY_REWARDS=[100,100,300];
export const DAILY_TASKS=[
 {id:'hunt',metric:'minions',goal:20,name:'肃清妖兽',description:'击败20只普通小怪',icon:'hunt'},
 {id:'boss',metric:'bosses',goal:1,name:'首领讨伐',description:'击败1位守关首领',icon:'boss'},
 {id:'skills',metric:'skills',goal:5,name:'秘术研习',description:'成功释放5次英雄技能',icon:'skills'},
 {id:'jumps',metric:'jumps',goal:10,name:'轻身修行',description:'完成10次跳跃',icon:'jumps'},
 {id:'dashes',metric:'dashes',goal:5,name:'疾行试炼',description:'使用5次冲刺',icon:'dashes'},
 {id:'pickups',metric:'pickups',goal:3,name:'寻宝之旅',description:'拾取3件关卡战利品',icon:'pickups'},
 {id:'attacks',metric:'attacks',goal:15,name:'锋芒初试',description:'成功使用15次普攻',icon:'attacks'},
 {id:'clear',metric:'clears',goal:1,name:'秘境巡行',description:'完成1次关卡结算',icon:'clear'}
];
const byId=Object.fromEntries(DAILY_TASKS.map(t=>[t.id,t]));
export function dailyDate(now=new Date()){const d=now instanceof Date?now:new Date(now);if(!Number.isFinite(d.getTime()))throw Error('无效日期');return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function selection(day){let state=2166136261;for(const ch of day)state=Math.imul(state^ch.charCodeAt(0),16777619)>>>0;const list=DAILY_TASKS.map(t=>t.id);for(let i=list.length-1;i>0;i--){state=(Math.imul(state,1664525)+1013904223)>>>0;const j=state%(i+1);[list[i],list[j]]=[list[j],list[i]];}return list.slice(0,5);}
export function normalizeDaily(raw,now=new Date()){
 const day=dailyDate(now),valid=raw?.day===day;
 const ids=valid&&Array.isArray(raw.taskIds)?[...new Set(raw.taskIds.filter(id=>byId[id]))]:[];
 const taskIds=ids.length===5?ids:selection(day),progress={};
 for(const task of DAILY_TASKS){const n=raw?.progress?.[task.metric];progress[task.metric]=valid&&Number.isSafeInteger(n)&&n>=0?Math.min(n,100000):0;}
 const claimed=valid&&Array.isArray(raw.claimed)?[...new Set(raw.claimed.filter(id=>taskIds.includes(id)&&progress[byId[id].metric]>=byId[id].goal))].slice(0,3):[];
 return {day,taskIds,progress,claimed};
}
export function dailyState(profile,now=new Date()){const next=normalizeDaily(profile.daily,now);profile.daily=next;return next;}
export function advanceDaily(profile,metric,amount=1,now=new Date()){
 if(!profile||!DAILY_TASKS.some(t=>t.metric===metric)||!Number.isSafeInteger(amount)||amount<=0)return false;
 const s=dailyState(profile,now);s.progress[metric]=Math.min(100000,s.progress[metric]+amount);return true;
}
export function dailyView(profile,now=new Date()){
 const state=dailyState(profile,now),count=state.claimed.length;
 return {...state,count,total:DAILY_REWARDS.slice(0,count).reduce((sum,n)=>sum+n,0),tasks:state.taskIds.map(id=>{const t=byId[id];return {...t,current:Math.min(t.goal,state.progress[t.metric]||0),complete:state.progress[t.metric]>=t.goal,claimed:state.claimed.includes(id)};})};
}
export function claimDaily(profile,id,now=new Date()){
 const state=dailyState(profile,now),task=byId[id];
 if(!task||!state.taskIds.includes(id))throw Error('今天没有这项任务');
 if(state.claimed.includes(id))throw Error('这项任务已领取');
 if(state.claimed.length>=3)throw Error('今日500金币已全部领取');
 if(state.progress[task.metric]<task.goal)throw Error('任务尚未完成');
 if(!Number.isSafeInteger(profile.coins)||profile.coins<0)throw Error('金币数据无效');
 const reward=DAILY_REWARDS[state.claimed.length];state.claimed.push(id);profile.coins+=reward;
 return {reward,total:DAILY_REWARDS.slice(0,state.claimed.length).reduce((sum,n)=>sum+n,0),tier:state.claimed.length};
}
