const labels={notConfigured:'TapTap爬塔榜尚未配置',loginRequired:'请主动登录TapTap后查看云榜',periodRequired:'此局未关联云榜周期，本机纪录已保留',periodChanged:'云榜周期已变更，本次不跨周期上传',periodNotAvailable:'此历史周期已不可查询',periodNotEnded:'该周期仍在进行中',cloudUnavailable:'TapTap云存档暂不可用',revisionConflict:'云端领奖记录已变化，请重新读取',accountChanged:'TapTap账号已变化，请重新读取',weeklyRewardsNotEnabled:'周奖励尚未开通'};
const unavailable=reason=>({available:false,connected:false,submitted:false,claimed:false,reason,label:labels[reason]||'TapTap服务暂不可用'});
export function createTowerProvider(plugin){
 let ledgerAccount='';
 const call=async(method,args)=>{if(!plugin||typeof plugin[method]!=='function')return unavailable('notConfigured');try{const result=await plugin[method](args);return result&&typeof result==='object'?{...result,label:result.label||labels[result.reason]}:unavailable('invalidResponse');}catch(error){return {...unavailable(error?.code||'sdkFailed'),errorCode:Number.isInteger(error?.data?.errorCode)?error.data.errorCode:undefined};}};
 return Object.freeze({
  async status(){const result=await call('status');return {...result,weeklyRewards:false,weeklyClaimAtomic:false,rewardAuthority:'unavailable'};},
  async login({privacyAccepted=false}={}){if(privacyAccepted!==true)return unavailable('privacyRequired');const result=await call('login',{privacyAccepted:true});if(result.available===false)return result;return call('status');},
  async getLeaderboard({limit=50,periodToken}={}){if(!Number.isInteger(limit)||limit<1||limit>50)return unavailable('invalidLimit');if(periodToken!==undefined&&(typeof periodToken!=='string'||periodToken.length>256))return unavailable('invalidPeriod');return call('leaderboard',{limit,...(periodToken!==undefined?{periodToken}:{})});},
  async submitRun({runId,floor,team,periodToken,proof}={}){if(proof?.ended!==true||proof.completedFloor!==floor)return unavailable('runNotEnded');if(!Number.isSafeInteger(floor)||floor<1||floor>1000000)return unavailable('invalidFloor');if(typeof periodToken!=='string'||periodToken.length>256)return unavailable('periodRequired');return call('submitRun',{runId,floor,team,periodToken,proof:{ended:true,completedFloor:floor}});},
  async getHistoricalRank({periodToken}={}){if(typeof periodToken!=='string'||!periodToken||periodToken.length>256)return unavailable('invalidPeriod');return call('getHistoricalRank',{periodToken});},
  async loadWeeklyLedger(){const result=await call('loadWeeklyLedger');ledgerAccount=result.available!==false&&typeof result.accountId==='string'?result.accountId:'';return result;},
  // Tap cloud archive revisions are not a distributed compare-and-swap. Keep
  // ranking available, but never issue a prize by racing two local inventories.
  async writeWeeklyLedger(){return {...unavailable('atomicClaimUnavailable'),label:'周榜奖励暂未开放，当前云存档不能保证跨设备只领取一次。'};},
  async claimWeekly(){return unavailable('weeklyRewardsNotEnabled');}
 });
}
