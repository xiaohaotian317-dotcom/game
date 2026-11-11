import {weeklyTowerRewardItems} from './tower-weekly-state.mjs';
// Local tower records are personal progress, never an authoritative online rank.
export const TOWER_RULES=Object.freeze({carryProgression:true,maxFloor:10000,bossEvery:1});
const heroes=['fire','nature','frost','lightning','shadow','star'];
const int=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0?Math.min(n,max):0;
export function towerWeek(now=Date.now()){
 const t=Number.isFinite(now)?now:Date.now(),d=new Date(t+8*3600000),day=(d.getUTCDay()+6)%7;
 const start=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()-day)-8*3600000;
 return {id:new Date(start+8*3600000).toISOString().slice(0,10),start,end:start+7*86400000};
}
const weekId=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)?v:null;
const runId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(v)?v:null;
export function normalizeTower(raw){
 const weekly={};for(const [id,value]of Object.entries(raw?.weekly||{}).slice(-26))if(weekId(id))weekly[id]={best:int(value?.best,TOWER_RULES.maxFloor),runId:runId(value?.runId),finishedAt:int(value?.finishedAt,1e14)};
 let active=null;const a=raw?.active;
 if(runId(a?.id)&&weekId(a?.week)&&Array.isArray(a.team)){
  const team=[...new Set(a.team.filter(h=>heroes.includes(h)))].slice(0,2),completed=int(a.completed,TOWER_RULES.maxFloor);
  if(team.length)active={id:a.id,week:a.week,team,completed,floor:Math.min(TOWER_RULES.maxFloor,completed+1),periodToken:typeof a.periodToken==='string'&&a.periodToken.length<=200?a.periodToken:null,state:['active','intermission','ended','defeat'].includes(a.state)?a.state:'active',startedAt:int(a.startedAt,1e14),updatedAt:int(a.updatedAt,1e14),vitals:Object.fromEntries(team.map(h=>[h,{hp:Math.max(0,Number.isFinite(a.vitals?.[h]?.hp)?a.vitals[h].hp:1e9),mp:Math.max(0,Number.isFinite(a.vitals?.[h]?.mp)?a.vitals[h].mp:1e9)}]))};
 }
 return {version:1,allTimeBest:Math.max(int(raw?.allTimeBest,TOWER_RULES.maxFloor),...Object.values(weekly).map(v=>v.best),0),weekly,active};
}
export function mergeTowerRecords(current,saved){const a=normalizeTower(current),b=normalizeTower(saved);for(const [id,r]of Object.entries(b.weekly))if(!a.weekly[id]||r.best>a.weekly[id].best)a.weekly[id]=r;a.allTimeBest=Math.max(a.allTimeBest,b.allTimeBest);return normalizeTower(a);}
export function startTowerRun(profile,team,{now=Date.now(),periodToken=null,id=globalThis.crypto?.randomUUID?.()||`tower-${now}-${Math.random().toString(36).slice(2,12)}`}={}){
 if(!Array.isArray(team)||!team.length||team.length>2||new Set(team).size!==team.length||team.some(h=>!heroes.includes(h)||!profile.owned.includes(h)))throw Error('请选择一至两位已拥有英雄');
 if(!runId(id))throw Error('挑战编号无效');
 const tower=normalizeTower(profile.tower);tower.active={id,week:towerWeek(now).id,team:[...team],completed:0,floor:1,state:'active',periodToken,startedAt:now,updatedAt:now,vitals:{}};profile.tower=normalizeTower(tower);return profile.tower.active;
}
export function currentTowerRun(profile,id){const run=normalizeTower(profile.tower).active;return run&&run.id===id?run:null;}
export function recordTowerFloor(profile,id,floor,{now=Date.now(),vitals={}}={}){
 const t=normalizeTower(profile.tower),a=t.active;if(!a||a.id!==id||a.state!=='active'||floor!==a.completed+1||floor>TOWER_RULES.maxFloor)return false;
 // A run belongs to its entry week. A week rollover cannot move an old score into a new season.
 a.completed=floor;a.floor=Math.min(TOWER_RULES.maxFloor,floor+1);a.state='intermission';a.updatedAt=now;a.vitals=vitals;
 const old=t.weekly[a.week];if(!old||floor>old.best)t.weekly[a.week]={best:floor,runId:id,finishedAt:now};t.allTimeBest=Math.max(t.allTimeBest,floor);profile.tower=normalizeTower(t);return true;
}
export function continueTowerRun(profile,id,{now=Date.now()}={}){const t=normalizeTower(profile.tower),a=t.active;if(!a||a.id!==id||a.state!=='intermission'||a.completed>=TOWER_RULES.maxFloor)throw Error('当前挑战不可继续');if(a.week!==towerWeek(now).id)throw Error('本周已结束，请开启新一周挑战');a.state='active';a.updatedAt=now;profile.tower=t;return a;}
export function endTowerRun(profile,id,{defeat=false,now=Date.now()}={}){const t=normalizeTower(profile.tower),a=t.active;if(!a||a.id!==id)return false;a.state=defeat?'defeat':'ended';a.updatedAt=now;profile.tower=t;return true;}
export function weeklyTowerRewards(rank){return weeklyTowerRewardItems(rank);}
export function towerPersonalSummary(profile,now=Date.now()){const tower=normalizeTower(profile.tower),week=towerWeek(now);return {week,...tower,weekBest:tower.weekly[week.id]?.best||0};}
