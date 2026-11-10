import {AdvertisingPlatform,AD_PLACEMENTS} from './advertising-platform.mjs';
import {SHOP_OFFERS,shopToday} from './shop-state.mjs';
import {commitShopReward} from './shop-rewards.mjs';
import {loadSolo} from './campaign-profile.mjs';
import {itemInfo} from './campaign-growth-data.mjs';
import {sheetStyle} from './campaign-system-ui.mjs';
import {installOnboarding} from './onboarding-guide.mjs';
import './platform.mjs';
const ads=new AdvertisingPlatform(globalThis.arcaneMobile?.ads||globalThis.arcaneAds||null),root=document.getElementById('shop-rewards'),status=document.getElementById('shop-status');let available=false,busy=false,testMode=false;
function render(){const profile=loadSolo(localStorage),today=shopToday(profile);document.getElementById('shop-coins').textContent=profile.coins;root.innerHTML=SHOP_OFFERS.map(o=>`<article class="shop-offer"><i class="shop-item" aria-hidden="true" style="${sheetStyle('items',itemInfo({type:o.icon}).icon)}"></i><h3>${o.name}</h3><p>${o.copy}</p><small>今日 ${today.counts[o.id]||0} / ${o.limit}</small><button data-offer="${o.id}" ${busy||(today.counts[o.id]||0)>=o.limit?'disabled':''}>${(today.counts[o.id]||0)>=o.limit?'今日已领完':available?'观看广告 · 领取':'广告补给 · 暂未开放'}</button></article>`).join('');}
root.addEventListener('click',async e=>{const b=e.target.closest('[data-offer]');if(!b||busy)return;if(!available){status.textContent='广告补给暂未开放，正常探索与通关奖励照常获得。';return;}if(!document.getElementById('shop-privacy').checked){status.textContent='请先阅读并确认隐私与广告说明。';return;}busy=true;render();try{const result=await ads.showRewarded(b.dataset.offer==='coins'?AD_PLACEMENTS.coins:AD_PLACEMENTS.item,{privacyAccepted:true});if(!result.completed){status.textContent='本次未完成广告，奖励和领取次数均未改变。';return;}commitShopReward(localStorage,b.dataset.offer,result);status.textContent='馈赠已保存：金币已到账，道具可在背包查看。';}catch(error){status.textContent=error.message;}finally{busy=false;render();}});
render();ads.status().then(s=>{available=s.configured&&s.rewarded;testMode=s.testMode===true;status.textContent=available?(testMode?'广告联调测试中：自愿观看测试广告验证奖励，尚未开放正式变现。':'选择需要的补给，自愿观看后领取。'):'广告补给暂未开放，正常探索与通关奖励照常获得。';render();}).catch(()=>{status.textContent='暂时没有可观看的广告，请稍后再来。';});
installOnboarding('shop');
