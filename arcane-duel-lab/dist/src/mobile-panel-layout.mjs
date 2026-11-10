import {SUMMON_RECTS,SUMMON_REGIONS} from './summon-pools.mjs';
import {touchEnabled} from './platform.mjs';
let installed=false,portraitImage,scheduled=false;
const loadPortrait=()=>portraitImage||(portraitImage=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='assets/lobby/hero-splashes-v1.png';}));
/** Phone-only presentation enhancement. Never changes gameplay or profile data. */
export function installMobilePanelLayout(){
 if(installed||!touchEnabled()||typeof document==='undefined')return;installed=true;
 const collapse=()=>{const toolbar=document.querySelector('#solo-toolbar'),toggle=document.querySelector('.mobile-system-toggle');if(toolbar){toolbar.dataset.mobileExpanded='false';toolbar.inert=true;}toggle?.setAttribute('aria-expanded','false');};
 const apply=()=>{
  scheduled=false;
  const toolbar=document.querySelector('#solo-toolbar');
  if(toolbar&&!document.querySelector('.mobile-system-toggle')){const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-system-toggle';toggle.setAttribute('aria-controls','solo-toolbar');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','展开系统菜单');toggle.innerHTML='<span aria-hidden="true">☷</span><small>菜单</small>';toolbar.before(toggle);collapse();toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'收起系统菜单':'展开系统菜单');toolbar.dataset.mobileExpanded=String(open);toolbar.inert=!open;});toolbar.addEventListener('click',event=>{if(event.target.closest('button'))collapse();});}
  const detail=document.querySelector('#stage-detail .detail-copy');if(detail&&!detail.querySelector('.mobile-stage-scroll')){const scroll=document.createElement('div');scroll.className='mobile-stage-scroll';scroll.setAttribute('aria-label','守关妖兽与本关战利品');for(const id of ['detail-enemies','detail-loot','detail-unlock']){const child=document.getElementById(id);if(child)scroll.append(child);}detail.querySelector('#enter-stage')?.before(scroll);}
  for(const svg of document.querySelectorAll('.archive-hero-art:not([data-mobile-portrait])')){
   const hero=svg.closest('[data-archive-hero]')?.dataset.archiveHero;if(!hero||!SUMMON_RECTS[hero])continue;
   const canvas=document.createElement('canvas');canvas.className='archive-hero-art mobile-archive-portrait';canvas.dataset.mobilePortrait=hero;canvas.role='img';canvas.setAttribute('aria-label',svg.getAttribute('aria-label')||'英雄完整立绘');svg.replaceWith(canvas);
   const draw=()=>{const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(box.width*dpr);canvas.height=Math.round(box.height*dpr);loadPortrait().then(image=>{if(!canvas.isConnected)return;const [x,y,w,h]=SUMMON_RECTS[hero],regions=SUMMON_REGIONS[hero],s=Math.min(canvas.width/w,canvas.height/h),dx=(canvas.width-w*s)/2,dy=(canvas.height-h*s)/2,ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);ctx.save();ctx.translate(dx-x*s,dy-y*s);ctx.scale(s,s);ctx.beginPath();for(const [rx,ry,rw,rh]of regions)ctx.rect(rx,ry,rw,rh);ctx.clip();ctx.drawImage(image,0,0);ctx.restore();}).catch(()=>{});};new ResizeObserver(draw).observe(canvas);draw();
  }
 };
 const queue=()=>{if(!scheduled){scheduled=true;queueMicrotask(apply);}};
 new MutationObserver(queue).observe(document.body,{childList:true,subtree:true});apply();
 document.addEventListener('click',event=>{
  const card=event.target.closest('.archive-skill-card');if(!card||event.target.closest('button,select,a'))return;
  event.stopPropagation();const popup=document.createElement('dialog');popup.className='mobile-skill-description';const heading=document.createElement('h3');heading.textContent=card.querySelector('h3')?.textContent||'技能';const copy=document.createElement('p');copy.textContent=card.querySelector('.archive-skill-description')?.textContent||'';const meta=document.createElement('p');meta.textContent=card.querySelector('.archive-skill-meta')?.textContent||'';const close=document.createElement('button');close.textContent='返回技能';close.type='button';close.addEventListener('click',e=>{e.stopPropagation();popup.close();popup.remove();});popup.append(heading,copy,meta,close);card.closest('dialog').append(popup);popup.addEventListener('cancel',()=>popup.remove());popup.showModal();
 },true);
 window.addEventListener('arcane-background',collapse);
}
