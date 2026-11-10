// Presentation only: the original painting, stage coordinates and route paths share
// one uniformly scaled plane. No stage, unlock, camera or combat data is mutated.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const overlap=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
export function mapPaintingLayout(width,height,naturalWidth,naturalHeight,chapter=1){
 if(![width,height,naturalWidth,naturalHeight].every(v=>Number.isFinite(v)&&v>0))return null;
 const scale=width/naturalWidth,w=width,h=naturalHeight*scale;
 // On wide phones remove quiet upper sky/lower ocean, not a side of the world.
 // Narrower tablets retain the full-width painting and honest quiet letterboxing.
 const focus=chapter===2?.46:.43;
 return {width:w,height:h,left:0,top:h>height?clamp(height*.5-h*focus,height-h,0):(height-h)/2,scale};
}
export function installCampaignMapViewport(map){
 if(!map||!(globalThis.arcaneMobile||new URLSearchParams(location.search).get('touch')==='1'))return null;
 const screen=map.closest('#world-screen'),image=map.querySelector('img'),probe=document.createElement('div');probe.className='map-safe-probe';probe.setAttribute('aria-hidden','true');screen.append(probe);
 let stages=[],chapter=1,frame=0;
 function schedule(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;layout();});}
 function layout(){
  if(screen.hidden||!screen.clientWidth||!image.complete||!image.naturalWidth)return;
  const box=screen.getBoundingClientRect(),painting=mapPaintingLayout(box.width,box.height,image.naturalWidth,image.naturalHeight,chapter);if(!painting)return;
  const px=(key,value)=>map.style.setProperty(key,value+'px');px('--map-width',painting.width);px('--map-height',painting.height);px('--map-left',painting.left);px('--map-top',painting.top);map.dataset.viewportReady='true';map.dataset.mapChapter=String(chapter);
  const safe=probe.getBoundingClientRect(),margin=3,w=clamp(box.width*.1,48,88),h=clamp(box.height*.2,48,88),obstacles=[...screen.querySelectorAll('.map-back,.map-progress,.chapter-select,.map-menu-toggle')].filter(e=>e.getClientRects().length&&!(e.classList.contains('map-menu-toggle')&&e.closest('.map-menu.expanded'))).map(e=>{const r=e.getBoundingClientRect();return {left:r.left-3,right:r.right+3,top:r.top-3,bottom:r.bottom+3};});
  const bounds=(x,y)=>({left:x-w/2,right:x+w/2,top:y-h/2,bottom:y+h/2});
  for(const s of stages){
   const button=map.querySelector(`[data-stage="${s.id}"]`);if(!button)continue;
   const bottomReserve=s.mode==='tutorial'?16:0;
   const original={x:box.left+painting.left+painting.width*s.mapX/100,y:box.top+painting.top+painting.height*s.mapY/100},fit=p=>({x:clamp(p.x,safe.left+w/2+margin,safe.right-w/2-margin),y:clamp(p.y,safe.top+h/2+margin,safe.bottom-h/2-margin-bottomReserve)});let center=fit(original);
   for(let pass=0;pass<2;pass++)for(const obstacle of obstacles){if(!overlap(bounds(center.x,center.y),obstacle))continue;
    const candidates=[{x:center.x,y:obstacle.top-h/2-2},{x:center.x,y:obstacle.bottom+h/2+2},{x:obstacle.left-w/2-2,y:center.y},{x:obstacle.right+w/2+2,y:center.y}].map(fit);
    const score=p=>obstacles.reduce((n,r)=>n+overlap(bounds(p.x,p.y),r),0)*100+Math.hypot(p.x-original.x,p.y-original.y);center=candidates.sort((a,b)=>score(a)-score(b))[0];
   }
   Object.assign(button.style,{left:center.x-box.left-painting.left+'px',top:center.y-box.top-painting.top+'px',width:w+'px',height:h+'px'});button.dataset.mapAnchor=`${s.mapX},${s.mapY}`;
   const zoom=button.querySelector('.node-zoom');if(zoom){zoom.style.backgroundSize=`${painting.width}px ${painting.height}px`;zoom.style.backgroundPosition=`${box.left+painting.left-center.x+w/2}px ${box.top+painting.top-center.y+h/2}px`;}
  }
 }
 function update(nextStages,nextChapter){stages=nextStages;chapter=nextChapter;for(const button of screen.querySelectorAll('[data-chapter]')){if(button.dataset.compactChapter)continue;const title=button.textContent.split(' · '),number=title[0],name=title[1]||'';button.setAttribute('aria-label',button.textContent);button.innerHTML=`<span>${number}</span><small>${name}</small>`;button.dataset.compactChapter='true';}schedule();}
 image.addEventListener('load',schedule);globalThis.addEventListener('resize',schedule);globalThis.visualViewport?.addEventListener('resize',schedule);const observer=new ResizeObserver(schedule);observer.observe(screen);observer.observe(probe);return {update,refresh:schedule};
}
