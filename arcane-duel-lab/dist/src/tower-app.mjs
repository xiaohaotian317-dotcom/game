import {loadSolo,saveSolo} from './campaign-profile.mjs';
import {towerPersonalSummary,startTowerRun,continueTowerRun} from './tower-state.mjs';
import {towerFloor} from './tower-data.mjs';
import {readTowerLeaderboard,towerProvider,towerEndedPeriods} from './tower-provider.mjs';
import {claimTowerWeeklyReward} from './tower-weekly-rewards.mjs';
import {weeklyTowerRewardItems,validWeeklyAccount,sameWeeklyClaim} from './tower-weekly-state.mjs';
import {itemInfo} from './campaign-growth-data.mjs';
import {sheetStyle} from './campaign-system-ui.mjs';
import {CampaignTeamSelection} from './campaign-team-ui.mjs';
import {Sound} from './audio.mjs';
import './platform.mjs';
const $=s=>document.querySelector(s);let storage;try{storage=localStorage;}catch{}
const profile=loadSolo(storage),sound=new Sound({scene:'journey'});
let boardSerial=0,rewardSerial=0,currentPeriodToken=null,endedPeriods=[],claimBusy=false,rewardReady=null,weeklyRewardsAvailable=false;
const weeklyUnavailable='周榜排名可查看，周奖领取暂未开放。';
function navigate(run){const q=new URLSearchParams({tower:run.id});if(new URLSearchParams(location.search).get('touch')==='1')q.set('touch','1');location.href='campaign.html?'+q;}
function save(){if(!saveSolo(storage,profile))throw Error('本机存档无法写入，挑战尚未开始');}
function render(){const p=towerPersonalSummary(profile);$('#tower-week-best').innerHTML=p.weekBest+'<small>层</small>';$('#tower-all-best').innerHTML=p.allTimeBest+'<small>层</small>';const run=p.active,resume=run&&run.week===p.week.id&&['active','intermission'].includes(run.state)&&run.completed>0;$('#tower-resume').hidden=!resume;$('#tower-resume').textContent=resume?`继续第 ${run.floor} 层 · 已通过 ${run.completed} 层`:'';}
const selection=new CampaignTeamSelection({element:$('#team-screen'),getProfile:()=>profile,onBack:()=>{$('#tower-hall').hidden=false;},onPrepare:()=>{location.href='campaign.html?panel=character';},onConfirm:(_s,_mode,team)=>{try{const run=startTowerRun(profile,team,{periodToken:currentPeriodToken});profile.lineup=team;profile.selected=team[0];save();navigate(run);}catch(e){selection.close();$('#tower-hall').hidden=false;$('#tower-message').textContent=e.message;}}});
$('#tower-start').onclick=()=>{sound.init();$('#tower-hall').hidden=true;selection.open(towerFloor(1));};
$('#tower-resume').onclick=()=>{try{const a=profile.tower.active;if(a.state==='intermission')continueTowerRun(profile,a.id);save();navigate(profile.tower.active);}catch(e){$('#tower-message').textContent=e.message;}};
function rewardIcons(root,rewards,{compact=false}={}){
 root.replaceChildren();
 for(const reward of rewards){
  const info=itemInfo(reward),card=document.createElement('div');card.className='tower-reward-item';
  const icon=document.createElement('i');icon.setAttribute('aria-hidden','true');icon.style.cssText=sheetStyle('items',info.icon);
  const count=document.createElement('b');count.textContent='×'+reward.count;icon.append(count);card.append(icon);
  if(!compact){const label=document.createElement('span');label.textContent=info.name;card.append(label);}
  card.title=info.name+' ×'+reward.count;root.append(card);
 }
}
for(const root of document.querySelectorAll('[data-prize-rank]'))rewardIcons(root,weeklyTowerRewardItems(Number(root.dataset.prizeRank)),{compact:true});
function rewardState({message,button='等待云榜核对',rank='—',rewards=[],ready=null}={}){
 rewardReady=ready;$('#tower-reward-status').textContent=message||'';$('#tower-claim').textContent=button;$('#tower-claim').disabled=claimBusy||!ready;
 $('#tower-reward-rank').textContent=rank;rewardIcons($('#tower-reward-items'),rewards);
 if(!rewards.length){const note=document.createElement('p');note.className='tower-result-note';note.textContent='结算名次前50名可获周奖';$('#tower-reward-items').append(note);}
}
function updatePeriods(result){
 const select=$('#tower-reward-period'),old=select.value;endedPeriods=towerEndedPeriods(result);select.replaceChildren();
 weeklyRewardsAvailable=result.status?.weeklyRewards===true&&result.status?.weeklyClaimAtomic===true;
 if(!weeklyRewardsAvailable){const option=document.createElement('option');option.value='';option.textContent='周奖领取暂未开放';select.append(option);select.disabled=true;rewardState({message:weeklyUnavailable,button:'暂未开放'});return;}
 if(!endedPeriods.length){const option=document.createElement('option');option.value='';option.textContent=result.connected?'暂无已结算周期':'连接云榜后查看';select.append(option);select.disabled=true;rewardState({message:result.connected?'本周仍在进行中。首个周期结算后，这里会显示可领取的周奖。':'登录并连接 TapTap 后，可核对已结算名次与领取记录。',button:result.connected?'等待本周结算':'请先连接云榜'});return;}
 for(const period of endedPeriods){const option=document.createElement('option');option.value=period.token;option.textContent=period.label;select.append(option);}
 select.disabled=claimBusy;if(endedPeriods.some(p=>p.token===old))select.value=old;
 rewardState({message:'请选择已结算周期，核对本人名次。',button:'选择结算周期'});
 if($('#tower-rules').open)previewReward();
}
async function previewReward(){
 const serial=++rewardSerial,token=$('#tower-reward-period').value,provider=towerProvider();
 if(claimBusy)return;
 if(!weeklyRewardsAvailable){rewardState({message:weeklyUnavailable,button:'暂未开放'});return;}
 if(!provider||!token||!endedPeriods.some(p=>p.token===token)||token===currentPeriodToken){rewardState({message:endedPeriods.length?'请选择已结算周期。':'暂无可领取的已结算周期。',button:'等待周期结算'});return;}
 rewardState({message:'正在核对 TapTap 本人名次与领取记录…',button:'核对中…'});
 try{
  const result=await provider.getHistoricalRank({periodToken:token});if(serial!==rewardSerial)return;
  if(result?.reason==='rankUnverified')throw Error('TapTap 暂未返回可核对的结算名次，本次没有发放奖励。');
  if(result?.available!==true||result.ended!==true||result.periodToken!==token||!validWeeklyAccount(result.accountId))throw Error('已结算名次暂时无法核对，请稍后重试。');
  const rewards=weeklyTowerRewardItems(result.rank),rank=Number.isSafeInteger(result.rank)&&result.rank>=1?'第 '+result.rank+' 名':'未上榜';
  if(!rewards.length){rewardState({message:result.rank?'本期未进入前50名，下次继续攀登。':'本期没有你的已结算登塔纪录。',button:'本期无可领奖励',rank});return;}
  const ledger=await provider.loadWeeklyLedger();if(serial!==rewardSerial)return;
  if(ledger?.available!==true||ledger.accountId!==result.accountId||ledger.ledger?.version!==1||!Array.isArray(ledger.ledger.claims))throw Error('云端领取记录暂时无法核对，请稍后重试。');
  const fresh=loadSolo(storage),local=fresh.towerWeekly.receipts.find(c=>c.accountId===result.accountId&&c.periodToken===token),remote=ledger.ledger.claims.find(c=>c.periodToken===token),pending=fresh.towerWeekly.pending;
  const recovering=remote&&sameWeeklyClaim(pending,{accountId:result.accountId,...remote});
  if(local||remote&&!recovering){rewardState({message:'这个周期的周奖已领取，同一账号不会重复发放。',button:'本期已领取',rank,rewards});return;}
  rewardState({message:recovering?'已找到上次未完成的领取，可继续保存奖励。':'名次与领取记录已核对，奖励将存入本机背包。',button:recovering?'继续领取':'领取本期周奖',rank,rewards,ready:{periodToken:token}});
 }catch(error){if(serial===rewardSerial)rewardState({message:error.message||'在线周奖暂不可用，请稍后重试。',button:'暂时无法领取'});}
}
$('#tower-reward-period').onchange=previewReward;
$('#tower-rules-open').onclick=()=>{$('#tower-rules').showModal();if(endedPeriods.length)previewReward();};
$('#tower-rules-close').onclick=()=>$('#tower-rules').close();
$('#tower-claim').onclick=async()=>{
 if(claimBusy||!rewardReady||!weeklyRewardsAvailable)return;const token=rewardReady.periodToken;
 if(token===currentPeriodToken||!endedPeriods.some(p=>p.token===token))return;
 claimBusy=true;$('#tower-claim').disabled=true;$('#tower-reward-period').disabled=true;$('#tower-reward-refresh').disabled=true;$('#tower-claim').textContent='正在保存周奖…';$('#tower-reward-status').textContent='正在核对云端领取记录并保存，请稍候。';
 try{
  const result=await claimTowerWeeklyReward({storage,provider:towerProvider(),periodToken:token});Object.assign(profile,result.profile);render();
  rewardState({message:result.status==='granted'?'周奖已存入背包，可在角色背包中查看。':'这个周期已领取，同一账号不会重复发放。',button:'本期已领取',rank:'第 '+result.claim.rank+' 名',rewards:result.claim.rewards});
 }catch(error){rewardState({message:error.message||'领取尚未完成，请稍后重试。',button:'重新核对后领取'});}
 finally{claimBusy=false;$('#tower-reward-period').disabled=!weeklyRewardsAvailable||!endedPeriods.length;$('#tower-reward-refresh').disabled=false;$('#tower-refresh').disabled=false;}
};
function emptyBoard(message){const root=$('#tower-board');root.replaceChildren();const note=document.createElement('p');note.className='tower-result-note tower-empty-note';note.textContent=message;root.append(note);}
async function board(){
 if(claimBusy)return;const serial=++boardSerial;$('#tower-refresh').disabled=true;$('#tower-reward-refresh').disabled=true;++rewardSerial;
 try{
  const result=await readTowerLeaderboard();if(serial!==boardSerial)return;
  currentPeriodToken=result.connected?result.currentPeriodToken:null;
  $('#tower-online-status').textContent=result.connected?'TapTap 当前周期云榜':result.status?.reason==='loginRequired'?'登录 TapTap 查看周榜':'周榜尚未连接';
  $('#tower-login').hidden=!towerProvider()||result.status?.loggedIn===true;
  $('#tower-week-date').textContent=result.connected&&result.period?.label?result.period.label+' · 云榜当前周期':'连接后显示云榜当前周期';
  if(!result.connected)emptyBoard('周榜未连接，本机挑战与纪录照常保存。');
  else{const root=$('#tower-board');root.replaceChildren();if(!result.entries.length)emptyBoard('本周暂无经服务确认的纪录');for(const row of result.entries){const el=document.createElement('div');el.className='tower-rank-row';if(row.isMe)el.classList.add('is-me');for(const [tag,text]of [['b',row.rank],['span',row.displayName],['strong',row.floor+'层']]){const n=document.createElement(tag);n.textContent=text;el.append(n);}root.append(el);}}
  updatePeriods(result);
 }catch{if(serial===boardSerial){currentPeriodToken=null;emptyBoard('周榜暂不可用，本机挑战不受影响。');$('#tower-online-status').textContent='周榜暂不可用 · 本机挑战不受影响';updatePeriods({connected:false});}}
 finally{if(serial===boardSerial){$('#tower-refresh').disabled=false;$('#tower-reward-refresh').disabled=false;}}
}
$('#tower-refresh').onclick=board;
$('#tower-reward-refresh').onclick=board;
$('#tower-login').onclick=()=>{$('#tower-privacy').checked=false;$('#tower-login-message').textContent='';$('#tower-login-confirm').disabled=true;$('#tower-login-dialog').showModal();};
$('#tower-login-close').onclick=()=>$('#tower-login-dialog').close();
$('#tower-privacy').onchange=()=>$('#tower-login-confirm').disabled=!$('#tower-privacy').checked;
$('#tower-login-confirm').onclick=async()=>{if(!$('#tower-privacy').checked)return;$('#tower-login-confirm').disabled=true;try{const provider=towerProvider();if(!provider?.login)throw Error('此设备暂未开放 TapTap 登录');const result=await provider.login({privacyAccepted:true});if(result?.loggedIn===false||result?.available===false)throw Error('登录未完成，可以稍后再试');$('#tower-login-dialog').close();await board();}catch(e){$('#tower-login-message').textContent=e.message||'登录未完成，请稍后再试';}finally{$('#tower-login-confirm').disabled=!$('#tower-privacy').checked;}};
window.addEventListener('arcane:navigate-back',e=>{if(!$('#team-screen').hidden){e.preventDefault();selection.close();$('#tower-hall').hidden=false;}});
render();board();
