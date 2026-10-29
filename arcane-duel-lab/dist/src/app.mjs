import {EXTRA_HEROES,roleMeter} from './hero-roster.mjs?v=20261029-roster6';
import {createWorld,step,STEP,HEROES,actionState,repair,triggerMechanism,interactNearest,clamp} from './simulation.mjs?v=20261029-roster6';
import {SCENES} from './scenes.mjs?v=20261029-roster6';
import {sceneStatus} from './scene-mechanics.mjs?v=20261029-roster6';
import {loadAssets,ensureHeroAssets,Renderer} from './renderer.mjs?v=20261029-roster6';
import {Sound} from './audio.mjs?v=20261029-roster6';
import {worldPoint,cameraView} from './camera.mjs?v=20261029-roster6';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const sound=new Sound(),canvas=$('#arena'),keys=new Set(),actions=[],heroOrder=['fire','nature','frost','lightning','shadow','star'],completed=Object.fromEntries(heroOrder.map(h=>[h,new Set()]));
const initialParams=new URLSearchParams(location.search);
let selectedScene=SCENES[initialParams.get('scene')]?initialParams.get('scene'):'moon';
let world=createWorld(HEROES[initialParams.get('hero')]?initialParams.get('hero'):SCENES[selectedScene].defaultHero,selectedScene),renderer,mode='title',paused=false,pointerDown=false,pointerUV=null,aim={x:1120,y:500},last=performance.now(),accumulator=0,uiClock=0;
const descriptions={
  fire:{attack:'向瞄准方向发射焰矢，碰墙停止。按住鼠标可连续攻击，命中附加灼烧。',q:'在鼠标下方第一个可站立台面引爆，可穿过上层平台，也可炸断木桥。',e:'向前喷火反冲起跳。1.5 秒内再按 E 施放「落烬」，向下砸落并留下燃烧区。',r:'在鼠标下方第一个台面标记落点，约 1 秒后陨石命中；可穿过上层平台。'},
  nature:{attack:'向瞄准方向弹出荆棘种子，碰墙停止，命中迸发枝叶。',q:'沿脚下台面催生根须，可穿过障碍束缚敌人，适合接木灵鹿角跃冲撞。',e:'播种召唤木灵鹿。2 秒内再按 E 指定角跃冲撞方向，命中触发共生恢复。',r:'在鼠标下方第一个可站立台面长出古树，形成两处枝台。树根附近周期恢复生命。'}
};
for(const [h,data] of Object.entries(EXTRA_HEROES))descriptions[h]=data.descriptions;
const slotKeys=['attack','q','e','dash','r'],keyLabels={attack:'LMB',q:'Q',e:'E',r:'R',dash:'SHIFT'};
function positionTitleButton(){
  const r=$('#title-screen').getBoundingClientRect();if(!r.width||!r.height)return;
  const width=Math.min(r.width,r.height*1672/941),height=width*941/1672,b=$('#start-button');
  b.style.left=((r.width-width)/2+width*.323)+'px';b.style.top=((r.height-height)/2+height*.762)+'px';
  b.style.width=(width*.355)+'px';b.style.height=(height*.13)+'px';
}
window.addEventListener('resize',positionTitleButton);
function buildHero(){
  const h=HEROES[world.hero];document.documentElement.style.setProperty('--hero',h.color);
  $('#hero-name').innerHTML=h.name+' <em>'+h.given+'</em>';$('#hero-role').textContent=h.role||(world.hero==='fire'?'爆发施法 · 灼烧压制':'植物造物 · 召唤协同');
  $('#passive-name').textContent=h.passive;$('#passive-desc').textContent=h.passiveText;
  if(renderer)renderer.portrait($('#hero-hud-portrait'),world.hero);
  $('#combo-title').textContent=h.comboTitle||(world.hero==='fire'?'跃起，落烬。':'萌芽，与森灵同行。');
  $('#combo-help').textContent=h.comboHelp||(world.hero==='fire'?'E 焰跃起跳，1.5 秒内再按 E 下砸。':'E 召唤木灵鹿，2 秒内再按 E 指挥角跃冲撞。');
  $$('.hero-button').forEach(b=>{b.classList.toggle('active',b.dataset.hero===world.hero);b.setAttribute('aria-pressed',String(b.dataset.hero===world.hero));});
  $('#hotbar').innerHTML=slotKeys.map(key=>{
    const s=h.skills[key]||{name:'冲刺',icon:'dash',cd:1.1};
    const desc=key==='dash'?'短距离冲刺，期间可躲避伤害；可以在空中调整位置。':descriptions[world.hero][key];
    return '<button class="skill" data-skill="'+key+'" aria-label="'+keyLabels[key]+' '+s.name+'"><span class="skill-face"><svg><use href="#i-'+s.icon+'"/></svg><span class="skill-key">'+keyLabels[key]+'</span><span class="cooldown" hidden></span></span><span class="skill-name">'+s.name+'</span><span class="skill-tooltip"><b>'+keyLabels[key]+' · '+s.name+'</b>'+desc+'</span></button>';
  }).join('');
  $$('.skill').forEach(b=>b.addEventListener('click',()=>{sound.init();actions.push(b.dataset.skill);canvas.focus({preventScroll:true});}));
  updateUI();
}
function buildScene(){
  const s=SCENES[selectedScene];$('#game').dataset.scene=selectedScene;
  document.title=s.name+' · 秘境决斗';
  $('.arena-shell').style.aspectRatio=cameraView(world).width+' / '+world.height;
  $('#camera-button').textContent=world.camera?.overview?'镜头 全景':'镜头 跟随';
  $('#scene-name').textContent=s.name+' · '+s.subtitle;$('#scene-english').textContent=s.english;
  $$('.scene-picker button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.scene===selectedScene)));
  $('#mechanism-cards').innerHTML=s.cards.map((card,i)=>'<article class="mechanism-card"><span>'+(i+1)+'</span><div><h3>'+card.name+'</h3><p>'+card.copy+'</p></div><div class="mechanism-action"><output data-mechanism-status="'+card.id+'"></output><button data-mechanism="'+card.id+'">'+card.action+'</button></div></article>').join('');
  $$('[data-mechanism]').forEach(b=>b.addEventListener('click',()=>{triggerMechanism(world,b.dataset.mechanism);consumeEvents();updateUI();canvas.focus({preventScroll:true});}));
  $('#repair-button').textContent=selectedScene==='moon'?'修复断桥':'重置机关';
  world.debugGeometry=initialParams.get('geometry')==='1';
}
function updateUI(){
  const p=world.player,h=HEROES[world.hero];
  const meter=roleMeter(world);$('#role-meter').hidden=!meter;$('#role-meter').textContent=meter;
  $('#action-state').textContent=actionState(world);$('#damage').textContent=Math.round(world.stats.damage);
  $('#combo').innerHTML=world.stats.combo+'<span> HIT</span>';
  $('#hp-text').textContent=p.hp+' / '+p.maxHp;$('#hp-fill').style.width=(p.hp/p.maxHp*100)+'%';
  const target=world.targets[0];$('#target-hp-text').textContent=Math.max(0,Math.round(target.hp))+' / '+target.maxHp;$('#target-hp-fill').style.width=Math.max(0,target.hp/target.maxHp*100)+'%';
  const seconds=Math.floor(world.time);$('#scene-clock').textContent=String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
  $$('[data-mechanism-status]').forEach(e=>e.textContent=sceneStatus(world,e.dataset.mechanismStatus));
  $('#passive-flash').style.opacity=Math.min(.16,p.passiveGlow*.2);
  $$('.skill').forEach(b=>{
    const key=b.dataset.skill,rc=p.recast?.key===key?p.recast:null,s=h.skills[key]||{name:'冲刺',icon:'dash',cd:1.1};
    const remaining=rc?Math.max(0,rc.until-world.time):key==='dash'?p.dashCooldown:p.cooldowns[key];
    const max=rc?rc.window:s.cd,overlay=b.querySelector('.cooldown');
    b.classList.toggle('recast',!!rc);
    const name=rc?rc.name:s.name,icon=rc?rc.icon:s.icon;
    if(b.querySelector('use').getAttribute('href')!=='#i-'+icon)b.querySelector('use').setAttribute('href','#i-'+icon);
    b.querySelector('.skill-name').textContent=name;
    overlay.hidden=remaining<=.02;overlay.style.setProperty('--angle',(clamp(remaining/max,0,1)*360)+'deg');
    overlay.textContent=remaining>=1?remaining.toFixed(1):remaining>.02?remaining.toFixed(1):'';
    b.setAttribute('aria-label',keyLabels[key]+' '+name+(remaining>.02?'，'+(rc?'二段剩余':'冷却')+remaining.toFixed(1)+'秒':'，可施放'));
  });
  const rc=p.recast;$('#recast-banner').hidden=!rc;
  const summon=$('#summon-status');summon.hidden=!world.fox;if(world.fox)summon.textContent='木灵鹿  '+Math.ceil(world.fox.hp)+' / '+world.fox.maxHp+' HP · '+Math.max(0,world.fox.until-world.time).toFixed(1)+'s';
  if(rc){$('#recast-banner kbd').textContent=rc.key.toUpperCase();$('#recast-name').textContent=rc.name+'可施放';$('#recast-clock').textContent=Math.max(0,rc.until-world.time).toFixed(1)+'s';}
  const goals=completed[world.hero];$$('#goals li').forEach(li=>li.classList.toggle('done',goals.has(li.dataset.goal)));$('#goals-count').textContent=goals.size+' / 5';
}
let selectionId=0;
async function choose(hero){
  const id=++selectionId;keys.clear();actions.length=0;pointerDown=false;
  if(renderer&&!renderer.assets[hero]){notice('正在加载'+HEROES[hero].name+'…');try{await ensureHeroAssets(hero,renderer.assets);}catch(e){notice(e.message+'，可再次选择重试。');console.error(e);return;}if(id!==selectionId)return;}
  if(renderer)renderer.poses[hero]=Object.fromEntries(Object.entries(renderer.poses[hero]));
  world=createWorld(hero,selectedScene);aim={...world.aim};pointerUV=null;keys.clear();actions.length=0;pointerDown=false;accumulator=0;
  $('#moving-button').setAttribute('aria-pressed','false');$('#counter-button').setAttribute('aria-pressed','false');$('#slow-button').setAttribute('aria-pressed','false');
  $('#freeze-button').setAttribute('aria-pressed','false');$('#frame-badge').hidden=true;
  buildScene();buildHero();if(mode==='game')canvas.focus({preventScroll:true});
  notice(HEROES[hero].comboHelp||(hero==='fire'?'试试 E 起跳，再按 E 下砸。':'试试 E 召唤木灵鹿，再按 E 指挥角跃冲撞。'));
  if(renderer)renderer.portrait(document.querySelector('[data-hero='+hero+'] canvas'),hero);
  const url=new URL(location.href);url.searchParams.set('hero',hero);url.searchParams.set('scene',selectedScene);history.replaceState(null,'',url);
}
function notice(t){$('#notice').textContent=t;}
function start(){
  if(!renderer)return;
  mode='game';$('#title-screen').hidden=true;$('#game').hidden=false;paused=false;accumulator=0;last=performance.now();sound.init();canvas.focus({preventScroll:true});renderer.resize();buildHero();
}
function setPause(value){
  paused=value;keys.clear();actions.length=0;pointerDown=false;accumulator=0;$('#pause-overlay').hidden=!paused;$('#pause-button').innerHTML=paused?'继续 <kbd>P</kbd>':'暂停 <kbd>P</kbd>';last=performance.now();
  if(!paused){sound.init();canvas.focus({preventScroll:true});}
}
function freezeFrame(){world.freezeFrame=!world.freezeFrame;keys.clear();pointerDown=false;actions.length=0;accumulator=0;$('#freeze-button').setAttribute('aria-pressed',String(!!world.freezeFrame));$('#frame-badge').hidden=!world.freezeFrame;canvas.focus({preventScroll:true});}
function point(event){const r=canvas.getBoundingClientRect();pointerUV={u:(event.clientX-r.left)/r.width,v:(event.clientY-r.top)/r.height};aim=worldPoint(world,pointerUV.u,pointerUV.v);}
canvas.addEventListener('pointermove',point);canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();point(e);pointerDown=true;canvas.setPointerCapture(e.pointerId);sound.init();canvas.focus({preventScroll:true});});
window.addEventListener('pointerup',()=>pointerDown=false);canvas.addEventListener('pointercancel',()=>pointerDown=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
  if(mode==='title'){if(e.code==='Enter'&&!$('#start-button').disabled)start();return;}
  if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight','KeyQ','KeyE','KeyR','KeyJ'].includes(e.code))e.preventDefault();
  if(e.repeat)return;
  if(e.code==='KeyP'||e.code==='Escape'){setPause(!paused);return;}
  if(e.code==='KeyV'){freezeFrame();return;}
  if(/^Digit[1-6]$/.test(e.code)){choose(heroOrder[Number(e.code.slice(-1))-1]);return;}
  if(paused)return;
  keys.add(e.code);
  if(['Space','KeyW','ArrowUp'].includes(e.code))actions.push('jump');
  if(['ShiftLeft','ShiftRight'].includes(e.code))actions.push('dash');
  if(e.code==='KeyQ')actions.push('q');if(e.code==='KeyE')actions.push('e');if(e.code==='KeyR')actions.push('r');
  if(e.code==='KeyF'){if(!interactNearest(world))notice('靠近机关按 F，或瞄准机关射击。');consumeEvents();}
  if(e.code==='KeyN')choose(world.hero);
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{keys.clear();pointerDown=false;if(mode==='game'&&!paused)setPause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='game'&&!paused)setPause(true);});
$('#start-button').addEventListener('click',start);
$('#back-button').addEventListener('click',()=>{mode='title';$('#title-screen').hidden=false;$('#game').hidden=true;keys.clear();pointerDown=false;positionTitleButton();});
$('#pause-button').addEventListener('click',()=>setPause(!paused));$('#resume-button').addEventListener('click',()=>setPause(false));
$('#freeze-button').addEventListener('click',freezeFrame);
$$('.hero-button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.hero)));
$$('.scene-picker button').forEach(b=>b.addEventListener('click',()=>{selectedScene=b.dataset.scene;choose(world.hero);const url=new URL(location.href);url.searchParams.set('scene',selectedScene);url.searchParams.set('play','1');history.replaceState(null,'',url);notice('已进入'+SCENES[selectedScene].name+'。射击机关或靠近后按 F。');}));
$('#reset-button').addEventListener('click',()=>choose(world.hero));
$('#repair-button').addEventListener('click',()=>{if(selectedScene==='moon')repair(world);else choose(world.hero);notice('地图机关已复原。');canvas.focus({preventScroll:true});});
for(const [id,field] of [['moving','moving'],['counter','counterattack'],['slow','slow']]){
  $('#'+id+'-button').addEventListener('click',e=>{world[field]=!world[field];e.currentTarget.setAttribute('aria-pressed',String(world[field]));canvas.focus({preventScroll:true});});
}
$('#sound-button').addEventListener('click',()=>{sound.enabled=!sound.enabled;$('#sound-button').textContent='声音 '+(sound.enabled?'开':'关');$('#sound-button').setAttribute('aria-pressed',String(sound.enabled));if(sound.enabled)sound.init();});
$('#camera-button').addEventListener('click',()=>{world.camera.overview=!world.camera.overview;world.camera.x=0;$('.arena-shell').style.aspectRatio=cameraView(world).width+' / '+world.height;$('#camera-button').textContent=world.camera.overview?'镜头 全景':'镜头 跟随';canvas.focus({preventScroll:true});});
$('#fullscreen-button').addEventListener('click',async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen();}catch{notice('当前浏览器暂不支持全屏，可放大窗口体验。');}});
function consumeEvents(){
  const goals=completed[world.hero];
  for(const e of world.events){
    sound.event(e);
    if(e.type==='jump'&&e.double)goals.add('jump');
    if(e.type==='cast'&&e.key==='q')goals.add('skill');
    if(e.type==='cast'&&e.variant)goals.add('recast');
    if(e.type==='hit')goals.add('hit');
    if(e.type==='bridge'||e.type==='spring')goals.add('terrain');
    if(e.type==='bridge')notice('木桥已破坏！可以下落绕路或用「修复木桥」重新练习。');
    if(e.type==='summon')notice('木灵鹿已出现，2 秒内再按 E 指定角跃冲撞方向。');
    if(e.type==='leap')notice('焰跃已释放，1.5 秒内再次按 E 接落烬。');
    if(e.type==='hurt')notice('受到反击。试试用 Shift 冲刺穿过来袭投射物。');
    if(e.type==='lift')notice('升降月台已启动，站在台面上可以一起升降。');
    if(e.type==='mirror')notice('月镜已转向，投射物会按镜面方向折射。');
    if(e.type==='valve')notice('导流阀已切换，观察地火预警后选择安全通道。');
    if(e.type==='hammer')notice('摆锤受到推力，注意它的回摆范围。');
    if(e.type==='wind')notice('风铃已转向，空中经过风道时会受到气流推动。');
    if(e.type==='vine')notice('藤桥开始生长，趁枝藤稳定时通过。');
    if(e.type==='flowerHint')notice('弹跳花在地图中央：落在花心，短暂踩压后借力跃起。');
    if(['lift','mirror','valve','hammer','wind','vine','spring'].includes(e.type))goals.add('terrain');
  }world.events.length=0;
}
function loop(now){
  const realDt=clamp((now-last)/1000,0,.05);last=now;
  if(mode==='game'&&renderer){
    if(!paused&&!world.freezeFrame){
      accumulator+=realDt*(world.slow?.5:1);
      while(accumulator>=STEP){
        if(pointerUV)aim=worldPoint(world,pointerUV.u,pointerUV.v);
        const action=actions.shift(),move=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
        step(world,STEP,{move,aim,jump:action==='jump',drop:keys.has('KeyS')||keys.has('ArrowDown'),down:keys.has('KeyS')||keys.has('ArrowDown'),
          dash:action==='dash',cast:['q','e','r'].includes(action)?action:null,attack:pointerDown||keys.has('KeyJ')||action==='attack'});
        accumulator-=STEP;
      }consumeEvents();
    }
    renderer.draw(world,paused?1:accumulator/STEP,realDt);
    uiClock+=realDt;if(uiClock>.05){updateUI();uiClock=0;}
  }
  requestAnimationFrame(loop);
}
window.duelLab={snapshot:()=>({hero:world.hero,time:world.time,paused,mode,state:actionState(world),player:{x:world.player.x,y:world.player.y,vx:world.player.vx,vy:world.player.vy,hp:world.player.hp,grounded:world.player.grounded,jumps:world.player.jumps,recast:world.player.recast},targets:world.targets.map(t=>({x:t.x,y:t.y,hp:t.hp,burnUntil:t.burnUntil})),stats:{...world.stats},fox:world.fox?{x:world.fox.x,y:world.fox.y}:null,bridge:world.platforms.find(p=>p.id==='bridge').active})};
async function init(){
  try{
    const assets=await loadAssets((done,total)=>$('#loading').textContent='正在加载角色与秘境 '+done+' / '+total);
    await ensureHeroAssets(world.hero,assets);
    renderer=new Renderer(canvas,assets);$$('.hero-button').forEach(b=>{if(assets[b.dataset.hero])renderer.portrait(b.querySelector('canvas'),b.dataset.hero);});
    buildScene();buildHero();positionTitleButton();$('#loading').textContent='准备就绪 · 点击开始游戏';$('#start-button').disabled=false;
    const params=new URLSearchParams(location.search);if(params.get('play')==='1')start();
    for(const h of heroOrder)ensureHeroAssets(h,assets).then(()=>renderer.portrait(document.querySelector('[data-hero='+h+'] canvas'),h)).catch(()=>{});
  }catch(error){$('#loading').textContent=error.message+' · 请刷新重试';console.error(error);}
  requestAnimationFrame(loop);
}init();
