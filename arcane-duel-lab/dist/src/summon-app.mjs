import {installOnboarding} from './onboarding-guide.mjs';
import {Sound} from './audio.mjs';
new Sound();
import {HEROES} from './simulation.mjs?v=20261030-duel12';
import {loadSolo,saveSolo,summonSolo} from './campaign-profile.mjs';
import {SOLO_KEY,SOLO_SKILLS,itemInfo} from './campaign-growth-data.mjs';
import {skillArtStyle} from './skill-icons.mjs?v=20261030-duel12';
import {POOL_ORDER,POOLS,initialPool,poolURL,poolStatus,portraitPlacement} from './summon-pools.mjs';
import {SummonPortrait} from './summon-motion.mjs';
import drops from '../assets/world-drops/drop-meta-v1.json' with {type:'json'};
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;try{storage=localStorage;}catch{storage=null;}
let profile=loadSolo(storage),hero=initialPool(new URLSearchParams(location.search).get('hero'),profile),busy=false,toastTimer,sceneSerial=0;
const portrait=new SummonPortrait($('#hero-canvas'));
function face(id){const [x,y]=POOLS[id].face,r=id==='star'?44:id==='shadow'?50:58;return `<svg viewBox="${x-r} ${y-r} ${r*2} ${r*2}" aria-hidden="true"><image href="assets/lobby/hero-splashes-v1.png" width="1536" height="1024"/></svg>`;}
function icon(item){const f=drops.items[item.type],s=f&&drops.sheets[f.sheet];if(!f||!s)return '';return `<svg viewBox="${f.rect.join(' ')}" aria-hidden="true"><image href="assets/world-drops/${s.file}" width="${s.size[0]}" height="${s.size[1]}"/></svg>`;}
$('#wallet-icon').innerHTML=icon({type:'ticket'});
function toast(message){clearTimeout(toastTimer);$('#summon-toast').textContent=message;$('#summon-toast').hidden=false;toastTimer=setTimeout(()=>$('#summon-toast').hidden=true,3800);}
function renderState(){
 const state=poolStatus(profile,hero);
 $('#ticket-total').textContent=profile.tickets;
 $('#status-label').textContent=state.owned?'契约已缔结':'专属保底';
 $('#pity-text').textContent=state.owned?'已拥有':state.pity+' / 20';
 $('#pity-fill').style.width=(state.owned?100:state.pity/20*100)+'%';
 $('#pity-track').setAttribute('aria-valuenow',state.owned?20:state.pity);
 $('#pity-caption').textContent=state.owned?'这位英雄已加入你的旅途，可自由查看专属卡池。':`再召唤 ${state.remaining} 次内必得${HEROES[hero].name}，此进度仅属于当前卡池。`;
 $('#draw-one').disabled=busy||!state.canSingle;$('#draw-ten').disabled=busy||!state.canTen;
 $('#pool-notice').textContent=state.owned?'已拥有该英雄 · 可切换其他独立卡池':profile.tickets<1?'召唤券不足 · 可从首领战利品中获得':'每位英雄独立保底，切换卡池不清零';
 $('#pool-selectors').innerHTML=POOL_ORDER.map(id=>{const s=poolStatus(profile,id);return `<button class="pool-tab" data-pool="${id}" aria-label="${HEROES[id].name}独立卡池" aria-pressed="${id===hero}" ${busy?'disabled':''}><span class="pool-tab-face">${face(id)}</span><span><strong>${POOLS[id].title}</strong><small>${HEROES[id].name} · ${s.owned?'已拥有':s.pity+' / 20'}</small></span><b aria-hidden="true">›</b></button>`;}).join('');
}
function alignScene(el,id){
 if(innerWidth<=850){el.style.transform='';return;}
 const floors={fire:.868,nature:.832,frost:.894,lightning:.801,shadow:.834,star:.813},r=$('#hero-canvas').getBoundingClientRect(),p=portraitPlacement(id,r.width,r.height),foot=r.y+p.y+p.h-4*p.scale;
 const zoom=Math.max(innerWidth/el.naturalWidth,innerHeight/el.naturalHeight),plane=floors[id]*el.naturalHeight*zoom+(innerHeight-el.naturalHeight*zoom)/2;
 el.style.transform=`translateY(${Math.round(foot-plane)}px)`;
}
async function showScene(id){
 const serial=++sceneSerial,im=new Image();im.src=`assets/summon/${id}-sanctum-v1.png`;
 try{await im.decode();if(serial!==sceneSerial)return;const el=im;el.alt='';el.className='pool-scene-image';el.dataset.pool=id;$('#pool-scenery').append(el);alignScene(el,id);el.classList.add('visible');for(const other of [...$('#pool-scenery').children])if(other!==el)other.remove();}catch{if(serial===sceneSerial)toast('卡池场景暂未载入，重新打开页面可重试。');}
}
function selectPool(id,push=true){
 if(busy||!POOLS[id])return;
 profile=loadSolo(storage);hero=id;const d=POOLS[id],h=HEROES[id];
 document.body.dataset.hero=id;document.body.style.setProperty('--element',d.color);document.body.style.setProperty('--element-dark',d.dark);
 document.title=d.title+' · '+h.name+'专属召唤';
 $('#pool-title').textContent=d.title;$('#pool-english').textContent=d.en;$('#hero-name').textContent=h.name+' · '+h.given;$('#hero-role').textContent=d.role;$('#pool-copy').textContent=d.copy;$('#pool-verse').textContent=d.verse;
 $('#passive-name').textContent=h.passive;$('#passive-copy').textContent=h.passiveText;
 $('#pool-skills').innerHTML=['attack','q','e','r'].map((key,i)=>`<button title="${esc(h.descriptions?.[key]||(key==='attack'?(d.role.startsWith('近战')?'向前方近身攻击，不能穿透实体墙体。':'发射职业弹体，命中敌人，遇实体墙体停止。'):SOLO_SKILLS[id].find(s=>s.column===0&&s.key===key)?.description)||h.skills[key].name)}" aria-label="${['普攻','F','E','R'][i]} ${esc(h.skills[key].name)}"><i style="${skillArtStyle(id,key)}"></i><small>${['普攻','F','E','R'][i]} · ${h.skills[key].name}</small></button>`).join('');
 portrait.setHero(id);showScene(id);renderState();
 if(push)history.pushState({hero:id},'',poolURL(id));else history.replaceState({hero:id},'',poolURL(id));
}
function renderDraw(results,target,beforeTickets){
 const acquired=results.some(r=>r.hero),h=HEROES[target];
 $('#draw-result-eyebrow').textContent=acquired?'A COVENANT AWAKENS':'GIFTS OF THE SANCTUM';
 $('#draw-result-title').textContent=acquired?h.name+'回应了召唤':'秘境的馈赠';
 $('#draw-rewards').innerHTML=results.map(r=>r.hero?`<article class="awakened-hero"><span>${face(r.hero)}</span><h3>${h.name} · ${h.given}</h3><p>已加入英雄名册</p></article>`:`<article class="draw-item" title="${esc(itemInfo(r).description)}">${icon(r)}<strong>${itemInfo(r).name}</strong><small>× 1</small></article>`).join('');
 $('#draw-result-copy').textContent=`本次消耗 ${beforeTickets-profile.tickets} 张召唤券 · `+(acquired?'已停止后续召唤，未使用的券已保留':`当前卡池进度 ${profile.pity[target]||0} / 20`);
 $('#draw-result').showModal();$('#draw-result [data-close-dialog]').focus({preventScroll:true});
}
function draw(count){
 if(busy)return;const target=hero,p=loadSolo(storage),before=p.tickets;let results;
 try{if(!storage)throw Error('当前设备无法保存召唤结果，请允许本地存储后重试。');results=summonSolo(p,target,count);if(!saveSolo(storage,p))throw Error('召唤结果未能保存，本次没有扣除已保存的召唤券。');}catch(e){toast(e.message);return;}
 profile=p;renderState();renderDraw(results,target,before);
}
$('#pool-selectors').addEventListener('click',e=>{const b=e.target.closest('[data-pool]');if(b)selectPool(b.dataset.pool);});
document.querySelectorAll('[data-draw]').forEach(b=>b.addEventListener('click',()=>draw(Number(b.dataset.draw))));
$('#odds-open').onclick=()=>$('#rules-dialog').showModal();
document.querySelectorAll('[data-close-dialog]').forEach(b=>b.onclick=()=>b.closest('dialog').close());
window.addEventListener('popstate',()=>{if(busy){history.replaceState({hero},'',poolURL(hero));return;}selectPool(initialPool(new URLSearchParams(location.search).get('hero'),profile),false);});
window.addEventListener('storage',e=>{if(e.key===SOLO_KEY&&!busy){profile=loadSolo(storage);renderState();}});
window.addEventListener('resize',()=>{portrait.request();for(const el of $('#pool-scenery').children)alignScene(el,el.dataset.pool);});document.addEventListener('visibilitychange',()=>{if(!document.hidden)portrait.request();});
portrait.ready.then(()=>$('#art-loading').hidden=true).catch(e=>{ $('#art-loading').textContent=e.message+'，请重新打开页面。'; });
selectPool(hero,false);

installOnboarding('summon');
