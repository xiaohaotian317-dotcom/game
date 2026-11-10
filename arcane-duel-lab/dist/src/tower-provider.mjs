import {validWeeklyPeriod} from './tower-weekly-state.mjs';
// Rankings and period tokens originate in TapTap. Local tower records never
// authorize a weekly prize or supply a missing server period.
export function towerProvider(){const p=globalThis.arcaneTowerProvider;return p&&typeof p.status==='function'&&typeof p.getLeaderboard==='function'?p:null;}
export async function towerOnlineStatus(){const p=towerProvider();if(!p)return {connected:false,label:'在线周榜待连接'};try{const status=await p.status();return {...status,connected:status.connected===true};}catch{return {connected:false,label:'在线周榜暂不可用'};}}
export function towerEndedPeriods(result){
 if(!result?.connected||!validWeeklyPeriod(result.currentPeriodToken))return [];
 const seen=new Set();return (Array.isArray(result.availablePeriods)?result.availablePeriods:[]).filter(p=>validWeeklyPeriod(p?.token)&&p.token!==result.currentPeriodToken&&p.isCurrent===false&&!seen.has(p.token)&&seen.add(p.token)).map(p=>({token:p.token,label:typeof p.label==='string'&&p.label.trim()?p.label.slice(0,160):'已结算周期'}));
}
export async function readTowerLeaderboard(){
 const p=towerProvider();if(!p)return {connected:false,entries:[]};
 const status=await p.status();if(!status.available&&!status.connected)return {connected:false,entries:[],availablePeriods:[],status};
 const result=await p.getLeaderboard({limit:50});
 if(result?.available===false)return {connected:false,entries:[],availablePeriods:[],status,reason:result.reason};
 const period=result?.period,currentPeriodToken=validWeeklyPeriod(result?.currentPeriodToken)?result.currentPeriodToken:validWeeklyPeriod(period?.token)&&period.isCurrent===true?period.token:null;
 return {connected:result?.available===true||result?.connected===true,status,period,currentPeriodToken,availablePeriods:result?.availablePeriods,accountId:result?.accountId,myEntry:result?.myEntry,entries:Array.isArray(result?.entries)?result.entries.filter(e=>Number.isInteger(e.rank)&&e.rank>=1&&e.rank<=50&&Number.isSafeInteger(e.floor)&&e.floor>=0&&typeof (e.name||e.displayName)==='string').slice(0,50).map(e=>({...e,displayName:e.name||e.displayName})):[]};
}
export async function submitTowerRun(run){const p=towerProvider();if(!p||typeof p.submitRun!=='function')return {submitted:false,reason:'在线周榜待连接，本机纪录已保存'};const status=await p.status();if(!status.available&&!status.connected)return {submitted:false,reason:'在线周榜未连接，本机纪录已保存'};if(run.completed<1||!['ended','defeat'].includes(run.state))return {submitted:false,reason:'挑战尚未结束'};if(typeof run.periodToken!=='string')return {submitted:false,reason:'periodRequired'};return p.submitRun({periodToken:run.periodToken,runId:run.id,floor:run.completed,team:[...run.team],proof:{ended:true,completedFloor:run.completed}});}
