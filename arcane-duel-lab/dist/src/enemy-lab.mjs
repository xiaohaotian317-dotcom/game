import {createWorld,step,STEP,HEROES,interactNearest} from './simulation.mjs?v=20261031-enemies1';
import {ENEMIES,ENEMY_IDS} from './enemy-roster.mjs';
import {spawnEnemy,placeEncounter,clearEnemies} from './enemy-simulation.mjs';
import {Renderer,loadAssets,ensureHeroAssets} from './renderer.mjs?v=20261031-enemies1';
import {loadEnemyAssets} from './enemy-painter.mjs';
import {fitDuelCamera,worldPoint,cameraView} from './camera.mjs?v=20261030-duel12';
import {skillArtStyle} from './skill-icons.mjs?v=20261030-duel12';
import {skillForCode,KEY_LABELS} from './controls.mjs?v=20261030-duel12';
import {Sound} from './audio.mjs?v=20261030-duel12';
import {LoadingScreen} from './loading-screen.mjs?v=20261030-duel12';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],params=new URLSearchParams(location.search);
const canvas=$('#enemy-arena'),sound=new Sound(),loading=new LoadingScreen(),keys=new Set(),actions=[];
let selected=ENEMIES[params.get('enemy')]?params.get('enemy'):'B02',hero=HEROES[params.get('hero')]?params.get('hero'):'fire',scene=['moon','lava','garden'].includes(params.get('scene'))?params.get('scene'):'moon';
let group=selected.startsWith('B')?'boss':'minion',world=createWorld(hero,scene),assets,renderer,busy=false,paused=false,pointer=false,aimUV={u:.62,v:.66},last=performance.now(),accumulator=0,uiClock=0,loadId=0,noticeTimer;
const slots=['attack','q','e','dash','r'];
function notice(text){clearTimeout(noticeTimer);$('#notice').textContent=text;noticeTimer=setTimeout(()=>$('#notice').textContent='',4200);}
function panel(open){if(!open&&!renderer){notice('先选择敌人，再点击“与当前敌人交手”。');return;}$('#roster-panel').hidden=!open;keys.clear();actions.length=0;pointer=false;accumulator=0;last=performance.now();if(!open)canvas.focus({preventScroll:true});}
function pause(value){paused=value;$('#paused').hidden=!value;$('#pause').textContent=value?'继续 P':'暂停 P';keys.clear();actions.length=0;pointer=false;accumulator=0;last=performance.now();}
function list(){
 $('#enemy-list').innerHTML=ENEMY_IDS.filter(id=>ENEMIES[id].boss===(group==='boss')).map(id=>`<button data-enemy="${id}" aria-pressed="${id===selected}"><small>${id}</small>${ENEMIES[id].name}</button>`).join('');
 $$('[data-enemy]').forEach(b=>b.addEventListener('click',()=>{selected=b.dataset.enemy;list();detail();}));
 $$('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.group===group)));
}
function detail(){const d=ENEMIES[selected];$('#enemy-type').textContent=d.boss?'守关首领 · 近战 / 远程 / 连招':d.ranged?'远程小怪':selected==='M10'?'混合精英':'近战小怪';$('#enemy-name').textContent=d.name;$('#enemy-life').textContent=d.hp+' 生命';$('#enemy-passive-name').textContent=d.passive||'生物本能';$('#enemy-passive-copy').textContent=d.passiveText||d.trait||(d.ranged?'保持距离并寻找射击时机。':'主动追击玩家，受击会出现短暂硬直。');$('#enemy-moves').innerHTML=d.patterns.map(p=>`<li><b>${p.name}</b>${p.steps.map(s=>s.name).join(' → ')}</li>`).join('');}
function hotbar(){
 const d=HEROES[hero];$('#hero-name').textContent=d.name+' · '+d.given;renderer.portrait($('#portrait'),hero);
 $('#hotbar').innerHTML=slots.map(key=>`<button class="enemy-skill" data-skill="${key}" aria-label="${KEY_LABELS[key]} ${d.skills[key]?.name||'冲刺'}"><span class="skill-art" style="${skillArtStyle(hero,key)}"></span><kbd>${KEY_LABELS[key]}</kbd><span class="cool" hidden></span><small>${d.skills[key]?.name||'冲刺'}</small></button>`).join('');
 $$('[data-skill]').forEach(b=>b.addEventListener('click',()=>{if(busy||paused||!$('#roster-panel').hidden)return;sound.init();actions.push(b.dataset.skill);canvas.focus();}));
}
async function prepareEnemies(){const ids=[selected];if(selected==='B02')ids.push('S01');if(selected==='B11')ids.push('M06');await loadEnemyAssets(ids,assets,(n,total)=>loading.progress(n,total));}
async function engage({add=false}={}){
 if(busy)return;busy=true;const id=++loadId,token=loading.start(scene,'正在载入敌人动作');$('#panel-notice').textContent='正在准备动作与场景…';$('#start-enemy').disabled=true;$('#add-enemy').disabled=true;
 try{
  if(!assets)assets=await loadAssets((n,t)=>loading.progress(n,t,token));
  await ensureHeroAssets(hero,assets);await prepareEnemies();if(id!==loadId)return;
  if(!renderer)renderer=new Renderer(canvas,assets);
  if(!add||world.hero!==hero||world.sceneId!==scene){
   world=createWorld(hero,scene);Object.assign(world.player,{x:850,y:world.floor,prevX:850,prevY:world.floor,grounded:true,platformId:'ground'});world.spawn={x:850,y:world.floor};
   world.enemyArt=assets.enemyArt;placeEncounter(world,[selected],{x:1280,y:world.floor});
  }else if(!spawnEnemy(world,selected,{x:Math.min(world.width-100,world.player.x+390),y:world.player.y})){notice('场上最多18个敌人，请先清理或清空。');}
  hotbar();world.camera.x=Math.max(0,world.player.x-500);fitDuelCamera(world,canvas.clientWidth,canvas.clientHeight);pause(false);panel(false);last=performance.now();accumulator=0;
  const url=new URL(location.href);url.searchParams.set('hero',hero);url.searchParams.set('scene',scene);url.searchParams.set('enemy',selected);history.replaceState(null,'',url);
  loading.finish(token);notice('观察出招预兆，用跳跃、冲刺与技能寻找反击空隙。');$('#panel-notice').textContent='';
 }catch(error){console.error(error);$('#panel-notice').textContent=error.message;loading.fail(error.message,()=>engage({add}),token);}
 finally{busy=false;$('#start-enemy').disabled=false;$('#add-enemy').disabled=false;}
}
function hud(){
 const p=world.player;$('#life-fill').style.width=Math.max(0,p.hp/p.maxHp*100)+'%';$('#life-text').textContent=Math.ceil(p.hp)+' / '+p.maxHp;
 const boss=world.targets.find(e=>e.enemyKind?.startsWith('B')&&e.hp>0);$('#boss-hud').hidden=!boss;
 if(boss){$('#boss-name').textContent=ENEMIES[boss.enemyKind].name;$('#boss-phase').textContent=boss.ai.phase===2?'第二阶段':'第一阶段';$('#boss-life').textContent=Math.ceil(boss.hp)+' / '+boss.maxHp;$('#boss-fill').style.width=boss.hp/boss.maxHp*100+'%';}
 const statuses=[];for(const [kind,s]of Object.entries(p.enemyStatus||{}))if(s.until>world.time)statuses.push(`<span>${kind==='poison'?'中毒':'灼烧'} ${(s.until-world.time).toFixed(1)}s</span>`);
 if(p.enemyControl?.until>world.time)statuses.push(`<span class="control">${p.enemyControl.kind==='freeze'?'冰冻':'石化'} ${(p.enemyControl.until-world.time).toFixed(1)}s</span>`);
 if(p.stoneStacks&&p.stoneStackUntil>world.time)statuses.push(`<span>石化积累 ${p.stoneStacks}/3</span>`);
 if(p.frostStacks&&p.frostStackUntil>world.time)statuses.push(`<span>寒意 ${p.frostStacks}/3</span>`);
 $('#status-effects').innerHTML=statuses.join('');
 $$('[data-skill]').forEach(b=>{const key=b.dataset.skill,rc=p.recast?.key===key?p.recast:null,left=rc?rc.until-world.time:key==='dash'?p.dashCooldown:p.cooldowns[key],cool=b.querySelector('.cool');cool.hidden=left<=.01;cool.textContent=Math.max(0,left).toFixed(1);b.classList.toggle('recast',!!rc);b.querySelector('.skill-art').setAttribute('style',skillArtStyle(hero,key,!!rc));b.querySelector('small').textContent=rc?.name||HEROES[hero].skills[key]?.name||'冲刺';});
}
function consume(){for(const e of world.events)sound.event(e);world.events=[];}
function tick(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(renderer){
  const running=!busy&&!paused&&$('#roster-panel').hidden;
  fitDuelCamera(world,canvas.clientWidth,canvas.clientHeight);
  if(running){
   accumulator+=dt;let first=true;while(accumulator>=STEP){
    const queued=first?actions.splice(0):[],action=queued.find(a=>!['jump','dash'].includes(a));
    const input={move:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),jump:queued.includes('jump'),dash:queued.includes('dash'),cast:action,attack:pointer,drop:keys.has('KeyS'),down:keys.has('KeyS'),aim:worldPoint(world,aimUV.u,aimUV.v)};
    step(world,STEP,input);consume();accumulator-=STEP;first=false;
   }
  }else accumulator=0;
  renderer.draw(world,running?accumulator/STEP:1,running?dt:0);uiClock+=dt;if(uiClock>.06){uiClock=0;hud();}
 }
 requestAnimationFrame(tick);
}
function point(e){const rect=canvas.getBoundingClientRect();aimUV={u:(e.clientX-rect.left)/rect.width,v:(e.clientY-rect.top)/rect.height};}
canvas.addEventListener('pointermove',point);canvas.addEventListener('pointerdown',e=>{if(e.button!==0||busy||paused)return;e.preventDefault();point(e);pointer=true;canvas.setPointerCapture(e.pointerId);sound.init();canvas.focus();});window.addEventListener('pointerup',()=>pointer=false);canvas.addEventListener('pointercancel',()=>pointer=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
window.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
 if(e.code==='Escape'){if(!$('#roster-panel').hidden)panel(false);else pause(!paused);return;}
 if(e.code==='KeyP'){pause(!paused);return;}if(e.code==='KeyN'&&!busy){engage();return;}
 if(!$('#roster-panel').hidden||paused||busy)return;
 if(['KeyA','KeyD','KeyW','KeyS','ArrowLeft','ArrowRight','ArrowUp','Space','ShiftLeft','ShiftRight','KeyF','KeyE','KeyR','KeyG'].includes(e.code))e.preventDefault();
 keys.add(e.code);if(e.repeat)return;
 if(['Space','KeyW','ArrowUp'].includes(e.code))actions.push('jump');if(e.code.startsWith('Shift'))actions.push('dash');const skill=skillForCode(e.code);if(skill)actions.push(skill);
 if(e.code==='KeyG'){sound.init();interactNearest(world);}
});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pointer=false;if(renderer&&$('#roster-panel').hidden)pause(true);});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&renderer&&$('#roster-panel').hidden)pause(true);});
$('#hero-select').innerHTML=Object.entries(HEROES).map(([id,d])=>`<option value="${id}">${d.name}</option>`).join('');$('#hero-select').value=hero;$('#scene-select').value=scene;
$('#hero-select').addEventListener('change',e=>hero=e.target.value);$('#scene-select').addEventListener('change',e=>scene=e.target.value);
$$('[data-group]').forEach(b=>b.addEventListener('click',()=>{group=b.dataset.group;list();}));
$('#open-roster').addEventListener('click',()=>panel(true));$('#close-roster').addEventListener('click',()=>panel(false));
$('#start-enemy').addEventListener('click',()=>{sound.init();engage();});$('#add-enemy').addEventListener('click',()=>{sound.init();engage({add:true});});
$('#clear-enemies').addEventListener('click',()=>{clearEnemies(world);notice('敌人和残留攻击已清空。');panel(false);});$('#pause').addEventListener('click',()=>pause(!paused));$('#resume').addEventListener('click',()=>pause(false));$('#reset').addEventListener('click',()=>engage());
$('#sound').addEventListener('click',()=>{sound.enabled=!sound.enabled;$('#sound').textContent='声音 '+(sound.enabled?'开':'关');if(sound.enabled)sound.init();});
$('#fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('可使用 F11 或最大化窗口。');}});
list();detail();requestAnimationFrame(tick);
// Select first; do not place a boss behind a loading/error overlay.
if(params.get('play')==='1')engage();
