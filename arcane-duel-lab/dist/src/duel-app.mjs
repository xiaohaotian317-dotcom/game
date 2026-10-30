import {LoadingScreen} from './loading-screen.mjs?v=20261030-duel12';
import {HEROES,step,STEP} from './simulation.mjs?v=20261030-duel12';
import {createDuel,restoreDuel,safeInput} from './duel-simulation.mjs?v=20261030-duel12';
import {loadAssets,ensureHeroAssets,Renderer} from './renderer.mjs?v=20261030-duel12';
import {cameraView,worldPoint,opponentEdge} from './camera.mjs?v=20261030-duel12';
import {HERO_ORDER,loadProfile,saveProfile} from './player-profile.mjs?v=20261030-duel12';
import {splashStyle} from './lobby-art.mjs?v=20261030-duel12';
import {skillArtStyle} from './skill-icons.mjs?v=20261030-duel12';
import {DuelLink} from './duel-net.mjs?v=20261030-duel12';
import {Sound} from './audio.mjs?v=20261030-duel12';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],canvas=$('#duel-arena');
const battleLoading=new LoadingScreen();let baseDone=0,baseTotal=0;
const sceneNames={moon:'月光遗迹 · 断桥与月镜',lava:'熔岩祭坛 · 导流与摆锤',garden:'浮空花园 · 风道与藤桥'};
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let prefs;try{prefs=localStorage;}catch{}const profile=loadProfile(prefs),sound=new Sound();sound.enabled=profile.sound;
let room=null,renderer=null,assets=null,assetPromise=null,loadedKey='',loadingKey='',match=null,prediction=null,worker=null,workerKey='',lastSeq=-1,lastEvent=0,history=[],pending=[],predictionActions=[],actionId=Date.now()*1000,inputSeq=Date.now()*1000,noticeTimer,reporting=false,pausedForConnection=false;
let keys=new Set(),pointerDown=false,aim={x:1200,y:520},lastFrame=performance.now(),accumulator=0,lastInput=0,lastUI=0,latestSnapshot=null,currentView='',snapshotAt=performance.now(),smoothEnemy=null;
function notice(text){clearTimeout(noticeTimer);$('#duel-notice').hidden=!text;$('#duel-notice').textContent=text||'';if(text)noticeTimer=setTimeout(()=>$('#duel-notice').hidden=true,4500);}
function view(id){if(id==='entrance'||id==='room-view')battleLoading.finish();document.body.classList.toggle('is-battle',id==='battle');for(const s of ['entrance','room-view','selection','battle'])$('#'+s).hidden=s!==id;if(currentView!==id){currentView=id;window.scrollTo({top:0,behavior:'instant'});}}
const link=new DuelLink({onRoom:applyRoom,onInput:packet=>worker?.postMessage({kind:'input',side:1,packet}),onState:snapshot=>acceptSnapshot(snapshot),onStatus:networkStatus,onError:message=>{if(message){$('#network-state').textContent='正在恢复连接';if(room)$('#net-detail').textContent=message;}else networkStatus();}});
function networkStatus(){const ping=Math.round(link.rtt),label=link.transport==='direct'?'直连':'服务器转发';$('#network-state').textContent=room?label+' · '+(ping<1?'<1':ping)+' ms':'房间服务就绪';$('#network-state').className=link.transport==='direct'?'direct':'relay';$('#net-detail').textContent=room?label+' · RTT '+(ping<1?'<1':ping)+' ms':'';}
async function loadBattle(r){
  const key=r.slots.map(s=>s?.hero||'fire').join(':');if(loadedKey===key&&assets)return true;
  if(loadingKey===key)return false;loadingKey=key;const token=battleLoading.start(r.scene);battleLoading.progress(baseDone,baseTotal?baseTotal+2:0,token);
  try{
    assetPromise??=loadAssets((done,total)=>{baseDone=done;baseTotal=total;$('#asset-status').textContent='载入秘境 '+done+' / '+total;battleLoading.progress(done,total+2);});assets=await assetPromise;let ready=0;
    await Promise.all(r.slots.filter(Boolean).map(async slot=>{await ensureHeroAssets(slot.hero,assets);battleLoading.progress(baseTotal+(++ready),baseTotal+2,token);}));
    if(room?.slots.map(s=>s?.hero||'fire').join(':')!==key)return false;loadedKey=key;if(!renderer)renderer=new Renderer(canvas,assets);$('#asset-status').textContent='战斗素材已就绪';renderSelection();if(['countdown','active'].includes(room.phase))beginRound(room);battleLoading.finish(token);return true;
  }catch(e){assetPromise=null;notice(e.message+'，可点击重新加载。');battleLoading.fail(e.message,()=>loadBattle(room),token);return false;}finally{if(loadingKey===key)loadingKey='';}
}

function renderRoom(){
  $('#room-number').textContent=room.code;$('#room-slots').innerHTML=room.slots.map((s,side)=>s?'<article class="room-seat '+(s.ready?'ready':'')+'"><span class="seat-badge">'+(side===0?'房主':'挑战者')+(side===room.seat?' · 你':'')+'</span><div class="hero-art" style="'+splashStyle(s.hero)+'"></div><strong>'+escape(s.name)+'</strong><span>'+HEROES[s.hero].name+' · '+(s.returned?'已返回房间':s.ready?'已准备':'等待准备')+'</span></article>':'<article class="room-seat empty"><span class="room-symbol">◇</span><strong>等待好友加入</strong><span>将房间号分享给你的对手</span></article>').join('');
  const waiting=room.phase==='waiting';$('#room-ready').hidden=room.seat===0;$('#room-start').hidden=room.seat!==0;$('#room-ready').disabled=!waiting;$('#room-start').disabled=!waiting;$('#room-ready').textContent=room.slots[room.seat]?.ready?'取消准备':'准备';
  $('#room-hint').textContent=!waiting?'等待对手返回房间，随后可以再来一场。':!room.slots[1]?'等待另一位玩家加入。':room.seat===0?(room.slots[1].ready?'对手已准备，可以开始选择英雄。':'等待对手准备。'):(room.slots[1].ready?'已准备，等待房主开始。':'准备好后点击准备，等待房主开始。');
}
function renderSelection(){
  if(!room?.slots[1])return;const s=room.slots[room.seat],other=room.slots[1-room.seat],h=HEROES[s.hero];
  $('#chosen-scene').textContent='随机战场 · '+sceneNames[room.scene];
  $('#duel-heroes').innerHTML=HERO_ORDER.map(id=>'<button class="duel-hero" data-choose-hero="'+id+'" aria-label="选择'+HEROES[id].name+'" aria-pressed="'+(s.hero===id)+'"><span class="hero-art" style="'+splashStyle(id)+'"></span><strong>'+HEROES[id].name+'</strong></button>').join('');
  $$('[data-choose-hero]').forEach(b=>b.addEventListener('click',()=>action({type:'hero',hero:b.dataset.chooseHero})));
  $('#selected-name').textContent=h.name+' · '+h.given;$('#selected-role').textContent=h.role||(s.hero==='fire'?'烈焰爆发 · 陨火降临':'植物造物 · 召唤协同');$('#selected-passive').textContent='被动 · '+h.passive+'：'+h.passiveText;
  $('#selected-skills').innerHTML=['attack','q','e','r'].map(k=>'<span><i style="'+skillArtStyle(s.hero,k)+'"></i>'+(k==='attack'?'普攻':k==='q'?'F':k.toUpperCase())+' · '+h.skills[k].name+'</span>').join('');
  $('#selection-status').textContent=other.locked?'对手已确认英雄，等待你准备。':s.locked?'你已准备，等待对手确认英雄。':'选择完成后，双方都需要点击准备。';$('#hero-ready').textContent=s.locked?'取消准备':'确认英雄 · 准备';$('#hero-ready').disabled=false;
}
function applyRoom(next){
  const prior=room;room=next;networkStatus();
  if(next.phase==='closed'){link.stop({forget:true});worker?.terminate();worker=null;room=null;view('entrance');notice('房主已离开，房间已关闭。');return;}
  if(!next.slots[next.seat]){link.stop({forget:true});room=null;view('entrance');return;}
  if(next.phase==='waiting'||(next.phase==='finished'&&next.slots[next.seat].returned)){worker?.terminate();worker=null;workerKey='';match=null;prediction=null;view('room-view');renderRoom();clearControls();return;}
  if(next.phase==='selecting'){view('selection');renderSelection();loadBattle(next);clearControls();return;}
  view('battle');if(next.phase==='finished'){clearControls();worker?.postMessage({kind:'pause',value:true});showResult();return;}
  $('#match-result').hidden=true;
  if(next.epoch!==prior?.epoch||next.roundSerial!==prior?.roundSerial){lastSeq=-1;lastEvent=0;pending=[];predictionActions=[];history=[];prediction=null;latestSnapshot=null;clearControls();}
  loadBattle(next);if(assets&&loadedKey===next.slots.map(s=>s.hero).join(':'))beginRound(next);
  if(next.phase==='finished'&&prior?.phase!=='finished')sound.event({type:'break'});
}
function beginRound(r){
  const key=r.epoch+':'+r.roundSerial;if(workerKey===key)return;workerKey=key;reporting=false;
  const saved=link.resumeState?.epoch===r.epoch&&link.resumeState?.roundSerial===r.roundSerial?link.resumeState:null;
  match=saved?restoreDuel(saved):createDuel(r.slots.map(s=>s.hero),r.scene);if(saved){inputSeq=Math.max(inputSeq,saved.ack?.[r.seat]||0);actionId=Math.max(actionId,saved.actionAck?.[r.seat]||0);}link.resumeState=null;prediction=null;match.worlds[r.seat].camera={x:0,y:0,overview:false};buildHotbar();
  for(const [i,id] of [[r.seat,'portrait-us'],[1-r.seat,'portrait-them'],[1-r.seat,'opponent-edge-portrait']])renderer.portrait($('#'+id),r.slots[i].hero);
  if(r.seat===0){worker?.terminate();worker=new Worker(new URL('./duel-worker.mjs?v=20261030-duel12',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.kind==='state'){latestSnapshot=data.snapshot;acceptSnapshot(data.snapshot,true);link.setState(data.snapshot);}if(data.kind==='round')reportRound(data);};worker.onerror=e=>notice('战斗线程加载失败，请刷新恢复房间。');worker.postMessage({kind:'reset',heroes:r.slots.map(s=>s.hero),scene:r.scene,epoch:r.epoch,roundSerial:r.roundSerial,localStartAt:r.startAt-link.clockOffset,snapshot:saved});}
}
async function reportRound(data){if(reporting||room?.phase==='finished')return;reporting=true;clearControls();try{await link.action({type:'round',epoch:data.epoch,roundSerial:data.roundSerial,winner:data.winner,hp:data.hp});}catch(e){notice(e.message);setTimeout(()=>{reporting=false;if(room?.epoch===data.epoch&&room?.roundSerial===data.roundSerial)reportRound(data);},1200);}}
function acceptSnapshot(snapshot,fromWorker=false){
  if(!room||snapshot.epoch!==room.epoch||snapshot.roundSerial!==room.roundSerial||snapshot.seq<lastSeq)return;
  lastSeq=snapshot.seq;const restored=restoreDuel(snapshot);if(!restored)return;snapshotAt=performance.now();if(match?.worlds[room.seat]?.camera)restored.worlds[room.seat].camera=match.worlds[room.seat].camera;
  if(!fromWorker&&room.seat===1){
    prediction=restoreDuel(snapshot).worlds[1];prediction.targets=[];prediction.duelSecondary=true;prediction.duelHitSummon=null;
    const ack=snapshot.ack?.[1]??-1;history=history.filter(f=>f.seq>ack).slice(-40);for(const frame of history)step(prediction,STEP,frame.input);
    const current=match?.worlds[1].player;if(current){const error=Math.hypot(current.x-prediction.player.x,current.y-prediction.player.y);if(error<90){prediction.renderOffset={x:current.x-prediction.player.x,y:current.y-prediction.player.y};}}
  }
  match=restored;pending=pending.filter(a=>a.id>(snapshot.actionAck?.[room.seat]||0));
  for(const event of snapshot.events||[])if(event.id>lastEvent){lastEvent=event.id;sound.event(event);}
}
function showResult(){const won=room.winner===room.seat;$('#countdown').hidden=true;$('#connection-cover').hidden=true;$('#match-result').hidden=false;$('#match-result').classList.toggle('loss',!won);$('#result-heading').textContent=won?'胜利':'失败';$('#match-result-score').textContent=room.score[room.seat]+' : '+room.score[1-room.seat]+(room.reason==='disconnect'?' · 对手断线':room.reason==='opponentLeft'?' · 对手离开':' · 先到 3 分获胜');}
function buildHotbar(){const h=HEROES[room.slots[room.seat].hero];$('#duel-hotbar').innerHTML=['attack','q','e','dash','r'].map(k=>'<button class="duel-skill" data-duel-skill="'+k+'" aria-label="'+(k==='dash'?'冲刺':h.skills[k].name)+'"><i class="skill-art" style="'+skillArtStyle(room.slots[room.seat].hero,k)+'"></i><b hidden></b><span>'+(k==='attack'?'LMB':k==='q'?'F':k==='dash'?'SHIFT':k.toUpperCase())+'</span></button>').join('');$$('[data-duel-skill]').forEach(b=>b.addEventListener('click',()=>queue(b.dataset.duelSkill)));}
function playable(){return room&&['countdown','active'].includes(room.phase)&&Date.now()+link.clockOffset>=room.startAt&&match&&!pausedForConnection&&!reporting;}
function clearControls(){keys.clear();pointerDown=false;}
function queue(type){if(!playable())return;sound.init();canvas.focus({preventScroll:true});const action={id:++actionId,type};pending.push(action);pending=pending.slice(-24);predictionActions.push(action);const packet=packetOf();link.sendActions(packet);if(room.seat===0)worker?.postMessage({kind:'input',side:0,packet});}
function held(){return safeInput({move:(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0),attack:pointerDown||keys.has('KeyJ'),down:keys.has('KeyS')||keys.has('ArrowDown'),drop:keys.has('KeyS')||keys.has('ArrowDown'),aim});}
function packetOf(){return {epoch:room.epoch,roundSerial:room.roundSerial,seq:inputSeq,input:playable()?held():safeInput({aim}),actions:playable()?pending:[]};}
function updateBattle(){
  if(!match||!room||$('#battle').hidden)return;const side=room.seat,p=prediction?.player||match.worlds[side].player,other=match.worlds[1-side].player;
  $('#score-us').textContent=room.score[side];$('#score-them').textContent=room.score[1-side];$('#round-name').textContent='第 '+room.round+' 局';
  $('#name-us').textContent=room.slots[side].name+' · '+HEROES[room.slots[side].hero].name;$('#name-them').textContent=room.slots[1-side].name+' · '+HEROES[room.slots[1-side].hero].name;
  for(const [key,a] of [['us',p],['them',other]]){$('#health-'+key).textContent=Math.ceil(Math.max(0,a.hp))+' / '+a.maxHp+((a.shield||0)>0?' +'+Math.ceil(a.shield)+'盾':'');$('#hp-'+key).style.width=Math.max(0,a.hp/a.maxHp)*100+'%';}
  if(room.phase==='finished'){$('#opponent-indicator').hidden=true;showResult();return;}
  const remaining=Math.ceil((room.startAt-Date.now()-link.clockOffset)/1000);$('#countdown').hidden=remaining<=0;$('#countdown-number').textContent=Math.max(1,remaining);$('#countdown-caption').textContent=room.roundSerial>1?(room.lastWinner===null?'平局 · 再战一局':room.lastWinner===side?'上一局获胜':'上一局落败'):'准备迎战';
  const missing=Date.now()+link.clockOffset-(room.seen[1-side]||0),stale=side===0?performance.now()-link.lastPacketAt>2500:link.lastStateAt>0&&performance.now()-link.lastStateAt>2500;
  pausedForConnection=remaining<=0&&(stale||missing>5000);$('#connection-cover').hidden=!pausedForConnection;$('#connection-message').textContent=missing>5000?'对手暂时失去连接，恢复后可继续；30 秒后可结束本场。':'正在同步战斗状态，请稍候。';$('#claim-disconnect').hidden=missing<30000;worker?.postMessage({kind:'pause',value:pausedForConnection});
  for(const el of $$('[data-duel-skill]')){const key=el.dataset.duelSkill,cooldown=key==='dash'?p.dashCooldown:p.cooldowns[key],recast=p.recast?.key===key&&p.recast.until>match.worlds[side].time,overlay=el.querySelector('b');overlay.hidden=!(cooldown>0||recast);overlay.textContent=recast?'再按 '+(key==='q'?'F':key.toUpperCase()):cooldown>=1?cooldown.toFixed(1):'0.'+Math.ceil(cooldown*10);el.classList.toggle('recast',!!recast);const h=room.slots[side].hero;el.querySelector('i').style.cssText=skillArtStyle(h,key,recast);}
}
function frame(time){
  const dt=Math.min(.05,(time-lastFrame)/1000);lastFrame=time;
  if(room&&['countdown','active'].includes(room.phase)&&match){
    accumulator+=dt;while(accumulator>=STEP){inputSeq++;const action=predictionActions.shift(),input={...held()};if(action){if(['q','e','r'].includes(action.type))input.cast=action.type;else input[action.type]=true;}
      if(playable()&&room.seat===1&&prediction){step(prediction,STEP,input);history.push({seq:inputSeq,input});history=history.slice(-60);}accumulator-=STEP;}
    if(time-lastInput>=33){lastInput=time;const packet=packetOf();if(room.seat===0)worker?.postMessage({kind:'input',side:0,packet});else link.setInput(packet);}
  }
  if(renderer&&match&&room&&!$('#battle').hidden){const side=room.seat,own=match.worlds[side],enemy=match.worlds[1-side];let renderOwn=own;
    if(prediction&&side===1){const offset=prediction.renderOffset;if(offset){const decay=Math.exp(-18*dt);offset.x*=decay;offset.y*=decay;}const p={...prediction.player};p.x+=(offset?.x||0);p.y+=(offset?.y||0);p.prevX=p.x;p.prevY=p.y;renderOwn={...own,player:p};}
    if(side===0){const elapsed=Math.min(.05,(time-snapshotAt)/1000),p={...own.player};p.x+=p.vx*elapsed;p.y+=p.grounded?0:p.vy*elapsed;p.prevX=p.x;p.prevY=p.y;renderOwn={...own,player:p};}
    if(!smoothEnemy||Math.hypot(smoothEnemy.x-enemy.player.x,smoothEnemy.y-enemy.player.y)>220)smoothEnemy={x:enemy.player.x,y:enemy.player.y};
    const follow=1-Math.exp(-25*dt);smoothEnemy.x+=(enemy.player.x-smoothEnemy.x)*follow;smoothEnemy.y+=(enemy.player.y-smoothEnemy.y)*follow;
    const renderEnemy={...enemy,player:{...enemy.player,x:smoothEnemy.x,prevX:smoothEnemy.x,y:smoothEnemy.y,prevY:smoothEnemy.y}};
    renderer.draw(renderOwn,1,dt,{opponent:renderEnemy});
    const rect=canvas.getBoundingClientRect(),edge=opponentEdge(cameraView(renderOwn),renderEnemy.player,rect.width,rect.height),indicator=$('#opponent-indicator');indicator.hidden=!edge||room.phase==='finished';if(edge){indicator.style.left=edge.x+'px';indicator.style.top=edge.y+'px';indicator.style.setProperty('--bearing',edge.angle+'deg');indicator.setAttribute('aria-label','对手在视野外，位于'+(Math.abs(edge.angle)>90?'左':'右')+'侧');}
  }
  if(time-lastUI>100){lastUI=time;updateBattle();}requestAnimationFrame(frame);
}
async function action(body){try{return await link.action(body);}catch(e){notice(e.message);return null;}}
$('#create-form').addEventListener('submit',async e=>{e.preventDefault();$('#create-room').disabled=true;try{await link.enter('create',{code:$('#create-code').value,name:$('#player-name').value,hero:profile.selected});}catch(e){notice(e.message);}finally{$('#create-room').disabled=false;}});
$('#join-form').addEventListener('submit',async e=>{e.preventDefault();$('#join-room').disabled=true;try{await link.enter('join',{code:$('#join-code').value,name:$('#player-name').value,hero:profile.selected});}catch(e){notice(e.message);}finally{$('#join-room').disabled=false;}});
$('#room-ready').addEventListener('click',()=>action({type:'ready',ready:!room.slots[room.seat].ready}));$('#room-start').addEventListener('click',()=>action({type:'start'}));
$('#hero-ready').addEventListener('click',async()=>{const r=room;$('#hero-ready').disabled=true;try{if(await loadBattle(r)||loadedKey===r.slots.map(s=>s.hero).join(':'))await action({type:'lock',ready:!room.slots[room.seat].locked});else notice('战斗素材正在载入，稍后再点击准备。');}finally{$('#hero-ready').disabled=false;}});
$('#match-return').addEventListener('click',()=>action({type:'return'}));$('#claim-disconnect').addEventListener('click',()=>action({type:'forfeit'}));
$('#copy-room').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(room.code);notice('房间号已复制：'+room.code);}catch{notice('房间号：'+room.code);}});
async function leave(){if(room){const r=await action({type:'leave'});if(!r)return;}link.stop({forget:true});worker?.terminate();room=null;match=null;view('entrance');}
$('#leave-room').addEventListener('click',leave);$('#duel-back').addEventListener('click',async e=>{if(room){e.preventDefault();await leave();if(!room)location.href='lobby.html';}});
$('#duel-sound').textContent='声音 '+(sound.enabled?'开':'关');$('#duel-sound').addEventListener('click',()=>{sound.enabled=!sound.enabled;profile.sound=sound.enabled;saveProfile(prefs,profile);$('#duel-sound').textContent='声音 '+(sound.enabled?'开':'关');if(sound.enabled)sound.init();});
window.addEventListener('keydown',e=>{if($('#battle').hidden||e.target.matches('input,select,textarea,button,a'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!playable())return;keys.add(e.code);if(e.repeat)return;const type=({Space:'jump',KeyW:'jump',ArrowUp:'jump',ShiftLeft:'dash',ShiftRight:'dash',KeyF:'q',KeyE:'e',KeyR:'r',KeyG:'interact',KeyJ:'attack'})[e.code];if(type)queue(type);});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',clearControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)clearControls();});
canvas.addEventListener('pointermove',e=>{if(!match||!room)return;const r=canvas.getBoundingClientRect();aim=worldPoint(match.worlds[room.seat],(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height);});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0||!playable())return;e.preventDefault();canvas.focus();pointerDown=true;canvas.setPointerCapture(e.pointerId);queue('attack');});window.addEventListener('pointerup',()=>pointerDown=false);
$('#duel-fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{notice('当前窗口已铺满，可使用浏览器全屏功能。');}canvas.focus({preventScroll:true});});
document.addEventListener('fullscreenchange',()=>$('#duel-fullscreen').textContent=document.fullscreenElement?'⛶ 退出全屏':'⛶ 全屏');
$('#battle-leave').addEventListener('click',async e=>{e.preventDefault();await leave();if(!room)location.href='lobby.html';});
requestAnimationFrame(frame);networkStatus();link.resume();
