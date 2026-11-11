import {itemToken} from './campaign-system-ui.mjs';
import {runRewards} from './campaign-rewards.mjs';
import {SOLO_NAMES} from './campaign-growth-data.mjs';
import {PETS,PET_STAGE} from './campaign-pet-data.mjs';
import {petIcon} from './campaign-pet-ui.mjs';
export function renderRunResult(el,w,meta){const c=w.campaign,r=runRewards(c),captured=c.petOutcome==='captured'&&PET_STAGE[c.stage.id];el.innerHTML=`<div class="result-totals"><div><svg class="result-coin" aria-hidden="true" viewBox="12 220 1230 854" preserveAspectRatio="xMidYMid meet"><image href="assets/campaign-results/treasure-coins-v1.png" width="1254" height="1254"/></svg><span>获得金币<strong>+${r.coins}</strong></span></div><div><span>英雄经验<strong>${Object.entries(r.xp).map(([id,n])=>SOLO_NAMES[id]+' +'+n).join(' · ')||'+0'}</strong></span></div></div><section class="result-loot"><h3>本次战利品</h3><div class="result-loot-grid">${r.items.map(i=>`<article>${itemToken(i,{meta,label:true})}</article>`).join('')}${captured?`<article class="result-pet"><i style="${petIcon(captured)}"></i><strong>${PETS[captured].name}</strong><small>新收伏的灵宠</small></article>`:''}${!r.items.length&&!captured?'<p class="result-empty">本次未拾取物品</p>':''}</div></section>`;}

export function renderTowerResult(el,{completed=0,weekBest=0}={}){
 const floor=n=>Math.max(0,Math.min(10000,Math.floor(Number(n)||0)));
 el.innerHTML=`<div class="tower-battle-stats"><div><span>本次通过</span><strong data-tower-stat="completed">${floor(completed)}<small>层</small></strong></div><div><span>本机本周最高</span><strong data-tower-stat="weekly">${floor(weekBest)}<small>层</small></strong></div></div><p class="tower-result-note" role="status"></p>`;
}
