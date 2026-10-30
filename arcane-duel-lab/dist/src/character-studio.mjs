import {Renderer,loadAssets,ensureHeroAssets} from './renderer.mjs?v=20261029-ui10';
import {createWorld,HEROES} from './simulation.mjs?v=20261029-ui10';
const $=s=>document.querySelector(s),buttons=[...document.querySelectorAll('[data-mode]')];
let mode='idle',phase=0,paused=false,face=1,last=performance.now(),renderers,worlds;
const names={idle:'待机',run:'跑步',jump:'起跳',fall:'下落',land:'落地',attack:'普攻',q:'F 技能',e:'E 技能',r:'R 技能',dash:'冲刺',hurt:'受击'};
function sync(){buttons.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));document.querySelectorAll('.mode-name').forEach(e=>e.textContent=names[mode]);$('#play-toggle').textContent=paused?'播放':'暂停';$('#play-toggle').setAttribute('aria-pressed',String(paused));$('#face-toggle').textContent='朝向：'+(face===1?'右':'左');$('#face-toggle').setAttribute('aria-pressed',String(face===-1));}
buttons.forEach(b=>b.addEventListener('click',()=>{mode=b.dataset.mode;phase=0;paused=false;sync();}));
$('#play-toggle').addEventListener('click',()=>{paused=!paused;sync();});$('#face-toggle').addEventListener('click',()=>{face*=-1;sync();});
$('#keyframe').addEventListener('click',()=>{phase=['q','e','r','attack'].includes(mode)?.51:.28;paused=true;sync();});
$('#pose-phase').addEventListener('input',e=>{phase=Number(e.target.value)/100;paused=true;sync();});
function prepare(w,t){const p=w.player;p.x=p.prevX=0;p.y=p.prevY=0;p.face=face;p.vx=0;p.vy=0;p.grounded=true;p.land=0;p.dash=0;p.hurt=0;p.cast=null;p.stomp=false;p.cycle=t*10.8;w.time=t;w.aim={x:face*550,y:-120};
  if(mode==='run')p.vx=face*310;if(mode==='jump'){p.grounded=false;p.vy=-500;}if(mode==='fall'){p.grounded=false;p.vy=460;}if(mode==='land')p.land=.18*(1-phase);if(mode==='dash'){p.dash=.12;p.vx=face*850;p.grounded=false;}if(mode==='hurt')p.hurt=.24*(.3+.7*Math.sin(phase*Math.PI));
  if(['attack','q','e','r'].includes(mode)){const s=HEROES[w.hero].skills[mode];p.cast={key:mode,age:phase*s.duration,duration:s.duration,releaseAt:s.release,variant:null};}}
function paint(renderer,w,dt){const c=renderer.ctx,canvas=renderer.canvas,d=Math.min(devicePixelRatio||1,2);if(canvas.width!==Math.round(540*d)){canvas.width=Math.round(540*d);canvas.height=Math.round(540*d);}c.setTransform(d,0,0,d,0,0);
  const g=c.createRadialGradient(270,250,25,270,250,330);g.addColorStop(0,w.hero==='fire'?'#302937':'#273531');g.addColorStop(1,'#101725');c.fillStyle=g;c.fillRect(0,0,540,540);c.strokeStyle='#c3ad7d16';c.lineWidth=1;
  for(let x=54;x<540;x+=54){c.beginPath();c.moveTo(x,0);c.lineTo(x,540);c.stroke();}for(let y=54;y<540;y+=54){c.beginPath();c.moveTo(0,y);c.lineTo(540,y);c.stroke();}
  c.strokeStyle='#c9b17a44';c.beginPath();c.ellipse(270,480,115,17,0,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(70,484);c.lineTo(470,484);c.stroke();c.save();c.translate(260,477);const zoom=w.hero==='lightning'&&mode==='attack'?1.6:mode==='r'?1.8:2.0;c.scale(zoom,zoom);renderer.hero(w,1,dt);
  if(w.hero==='lightning'&&mode==='attack'&&w.player.cast.age>=w.player.cast.releaseAt){renderer.roster.effect(w,{id:1,kind:'thunderPunch',attach:'fist',face:w.player.face,x:0,y:0,age:Math.max(.03,w.player.cast.age-w.player.cast.releaseAt),duration:.38});}
  c.restore();}
function loop(now){const dt=Math.max(0,Math.min((now-last)/1000,.05));last=now;if(!paused)phase=(phase+dt/(mode==='run'?.8:1.6))%1;
  if(renderers){for(const h of ['fire','nature','frost','lightning','shadow','star']){prepare(worlds[h],paused?phase*2:now/1000);paint(renderers[h],worlds[h],dt);}$('#pose-phase').value=Math.round(phase*100);$('#phase-label').textContent=Math.round(phase*100)+'%';}requestAnimationFrame(loop);}
try{const assets=await loadAssets(()=>{},{scenes:false});await Promise.all(['frost','lightning','shadow','star'].map(h=>ensureHeroAssets(h,assets)));renderers={};worlds={};for(const h of ['fire','nature','frost','lightning','shadow','star']){renderers[h]=new Renderer($('#'+h+'-preview'),assets);worlds[h]=createWorld(h);}$('#studio-status').textContent='六职业独立动作 · 修订 09 · 同一套角色绘制用于检视页和实际战斗';const params=new URLSearchParams(location.search);if(params.get('pose')==='f')mode='q';else if(names[params.get('pose')])mode=params.get('pose');if(params.get('still')==='1'){paused=true;phase=.51;}if(params.get('face')==='left')face=-1;sync();requestAnimationFrame(loop);}catch(e){$('#studio-status').textContent='角色加载失败，请刷新重试。';console.error(e);}
