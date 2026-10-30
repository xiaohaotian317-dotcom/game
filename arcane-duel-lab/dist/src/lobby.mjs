import {HEROES} from './simulation.mjs?v=20261030-duel11';
import {skillArtStyle} from './skill-icons.mjs?v=20261030-duel11';
import {HERO_ORDER,loadProfile,saveProfile,summonHeroes} from './player-profile.mjs?v=20261030-duel11';
import {splashStyle} from './lobby-art.mjs?v=20261030-duel11';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
let storage;try{storage=window.localStorage;}catch{storage=null;}
let profile=loadProfile(storage),preview='nature',stage='moon',busy=false,toastTimer;
const roles={fire:'烈焰爆发 · 陨火降临',nature:'植物造物 · 召唤协同'};
const verses={fire:'让余烬，照亮最后的长夜。',nature:'万物有灵，生生不息。',frost:'听见了吗，风雪正在低语。',lightning:'雷鸣未落，拳锋已至。',shadow:'黑夜之中，每一步都有回声。',star:'循着星轨，抵达未知的彼岸。'};
const descriptions={fire:{attack:'发射焰矢，碰墙停止，命中附加持续灼烧。',q:'在鼠标下方第一块台面引爆火焰印记。',e:'跃起留焰；2.5 秒内再按 E 下砸，衔接落烬。',r:'陨石穿过上层平台，在指定台面约 1 秒内砸落。'},nature:{attack:'发射荆棘种子，碰墙停止。',q:'缚根锁住敌人，限制其移动。',e:'召唤主动寻敌的木灵鹿；3.5 秒内再按 E 指挥角跃冲撞。',r:'从鼠标下方台面生长古树，提供庇护与枝台。'}};
function art(el,hero){el.style.cssText=splashStyle(hero);el.setAttribute('aria-label',HEROES[hero].name+' · '+HEROES[hero].given+'立绘');}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,3500);}
function persist(){if(!saveProfile(storage,profile))toast('当前浏览器无法保存进度，本次会话仍可继续体验。');}
function decorate(){for(const el of $$('.frame')){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('class','ornate-frame');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.innerHTML='<use href="#ornate-frame"/>';el.append(svg);}}
function renderHeader(){
  $$('[data-balance]').forEach(el=>el.textContent=profile.coins.toLocaleString('en-US'));
  $('#owned-count').textContent=profile.owned.length+' / 6';art($('#profile-art'),profile.selected);art($('#hall-art'),profile.selected);
  const h=HEROES[profile.selected];$('#hall-hero-label').innerHTML=h.name+' · '+h.given+' <span>›</span>';$('#practice-link').href=practiceURL('moon');
  $('#sound-toggle').setAttribute('aria-pressed',String(profile.sound));$('#sound-toggle').setAttribute('aria-label',profile.sound?'关闭声音':'开启声音');$('#sound-setting').checked=profile.sound;
  $$('[data-summon]').forEach(b=>b.disabled=busy||profile.coins<(b.dataset.summon==='10'?900:100));
}
function renderHeroes(){
  $('#hero-list').innerHTML=HERO_ORDER.map(id=>{const h=HEROES[id];return '<button class="hero-thumb" data-hero="'+id+'" aria-label="预览'+h.name+'" aria-pressed="'+(preview===id)+'" style="--hero-color:'+h.color+'"><span class="hero-art" style="'+splashStyle(id)+'"></span><strong>'+h.name+'</strong><small>'+ (profile.owned.includes(id)?'已拥有':'未唤醒')+'</small></button>';}).join('');
  $$('[data-hero]').forEach(b=>b.addEventListener('click',()=>{preview=b.dataset.hero;renderDetail();$$('[data-hero]').forEach(a=>a.setAttribute('aria-pressed',String(a.dataset.hero===preview)));}));
}
function renderDetail(){
  const h=HEROES[preview],owned=profile.owned.includes(preview);art($('#summon-art'),preview);art($('#detail-art'),preview);
  $('#detail-name').textContent=h.name+' · '+h.given;$('#detail-role').textContent=h.role||roles[preview];$('#hero-verse').textContent=verses[preview];
  $('#detail-passive-name').textContent=h.passive;$('#detail-passive-copy').textContent=h.passiveText;
  $('#detail-skills').innerHTML=['attack','q','e','r'].map(key=>{const label=key==='attack'?'普攻':key==='q'?'F':key.toUpperCase(),desc=(h.descriptions||descriptions[preview])[key];return '<button class="detail-skill" aria-label="'+label+' '+h.skills[key].name+'：'+desc+'" title="'+desc+'"><span class="skill-icon" style="'+skillArtStyle(preview,key)+'"></span><small><b>'+label+'</b>'+h.skills[key].name+'</small></button>';}).join('');
  $$('.detail-skill').forEach(b=>b.addEventListener('click',()=>toast(b.getAttribute('title'))));
  $('#ownership-status').textContent=owned?'✦ 已拥有':'◇ 尚未唤醒';$('#equip-hero').disabled=!owned||profile.selected===preview;$('#equip-hero').textContent=profile.selected===preview?'当前展示英雄':owned?'设为展示英雄':'等待召唤';
}
function setView(view,push=true){
  if(!['hall','summon','codex'].includes(view))view='hall';const hall=view==='hall';$('#shell').dataset.view=view;$('#hall-view').hidden=!hall;$('#summon-view').hidden=hall;$('#page-heading').hidden=hall;$('#page-heading').textContent=view==='codex'?'英雄图鉴':'英雄召唤';$('.summon-controls').hidden=view==='codex';
  $('.brand').innerHTML=hall?'<span class="brand-sigil">✧</span><span>秘境决斗<small>ARCANE DUEL</small></span>':'<span class="brand-sigil">‹</span> 返回大厅';
  document.title=(hall?'主大厅':view==='codex'?'英雄图鉴':'英雄召唤')+' · 秘境决斗';
  if(push){const url=new URL(location.href);if(hall)url.searchParams.delete('view');else url.searchParams.set('view',view);history.pushState({view},'',url);window.scrollTo({top:0,behavior:'instant'});}
}
function practiceURL(scene){return 'index.html?'+new URLSearchParams({play:'1',hero:profile.selected,scene,build:'ui10'});}
function open(id){$(id).showModal();}
function setSound(value){profile.sound=value;persist();renderHeader();}
let audio;
function chime(){if(!profile.sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();[523.25,659.25,783.99].forEach((f,i)=>{const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.09;o.type='sine';o.frequency.value=f;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.035,t+.02);g.gain.exponentialRampToValueAtTime(.001,t+.6);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.65);});}catch{}}
function draw(count){
  if(busy)return;let draw;try{draw=summonHeroes(profile,count);}catch(e){toast(e.message);return;}
  busy=true;profile=draw.profile;persist();renderHeader();$('#summon-art').classList.add('summoning');chime();
  setTimeout(()=>{
    preview=(draw.results.find(r=>r.isNew)||draw.results[0]).hero;renderHeroes();renderDetail();$('#summon-art').classList.remove('summoning');
    $('#summon-results').classList.toggle('single',count===1);
    $('#summon-results').innerHTML=draw.results.map((r,i)=>'<figure class="result-hero '+(r.isNew?'is-new':'')+'" style="--delay:'+i*.045+'s"><div class="result-art"><div class="hero-art" style="'+splashStyle(r.hero)+'"></div></div><figcaption><span class="result-badge">'+(r.isNew?'NEW HERO':'STARLIGHT')+'</span><strong>'+HEROES[r.hero].name+'</strong><small>'+HEROES[r.hero].given+' · '+(r.isNew?'新英雄已解锁':'重复返还 '+r.refund+' 金币')+'</small></figcaption></figure>').join('');
    const n=draw.results.filter(r=>r.isNew).length;$('#result-title').textContent=n?'星辉回应 · 新的同行者':'星辉再次与你相逢';$('#result-summary').textContent='本次消耗 '+draw.cost+' 金币 · 新英雄 '+n+' 位'+(draw.refund?' · 重复返还 '+draw.refund+' 金币':'');open('#result-dialog');
  },550);
}
decorate();renderHeader();renderHeroes();renderDetail();setView(new URLSearchParams(location.search).get('view')||'hall',false);
$$('button[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
window.addEventListener('popstate',()=>setView(new URLSearchParams(location.search).get('view')||'hall',false));
$('#profile-button').addEventListener('click',()=>setView('codex'));$('#hall-hero-label').addEventListener('click',()=>setView('codex'));
$('#equip-hero').addEventListener('click',()=>{if(!profile.owned.includes(preview))return;profile.selected=preview;persist();renderHeader();renderDetail();toast('已将'+HEROES[preview].name+'设为展示英雄。');});
$$('[data-summon]').forEach(b=>b.addEventListener('click',()=>draw(Number(b.dataset.summon))));
$('#result-confirm').addEventListener('click',()=>$('#result-dialog').close());$('#result-dialog').addEventListener('close',()=>{busy=false;renderHeader();});
$('#settings-open').addEventListener('click',()=>open('#settings-dialog'));$('#odds-open').addEventListener('click',()=>open('#odds-dialog'));$('#coin-help').addEventListener('click',()=>open('#odds-dialog'));
$('#sound-toggle').addEventListener('click',()=>setSound(!profile.sound));$('#sound-setting').addEventListener('change',e=>setSound(e.target.checked));
$('#duel-open').addEventListener('click',()=>location.href='duel.html');$('#stages-open').addEventListener('click',()=>open('#stages-dialog'));
$$('[data-room-tab]').forEach(b=>b.addEventListener('click',()=>{$$('[data-room-tab]').forEach(a=>a.setAttribute('aria-selected',String(a===b)));$('#create-room-panel').hidden=b.dataset.roomTab!=='create';$('#join-room-panel').hidden=b.dataset.roomTab!=='join';}));
$('#room-code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,''));
$('#duel-practice').addEventListener('click',()=>location.href=practiceURL($('#duel-scene').value));
$$('[data-stage]').forEach(b=>b.addEventListener('click',()=>{stage=b.dataset.stage;$$('[data-stage]').forEach(a=>a.setAttribute('aria-pressed',String(a===b)));}));
$('#stage-enter').addEventListener('click',()=>location.href=practiceURL(stage));
window.addEventListener('storage',e=>{if(e.key==='arcane-duel-profile-v1'){profile=loadProfile(storage);renderHeader();renderHeroes();renderDetail();}});
