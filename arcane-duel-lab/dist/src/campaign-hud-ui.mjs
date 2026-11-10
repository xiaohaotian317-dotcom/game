import {ensureHudArt,hudArtwork,hudElement,hudLayoutStyle} from './realm-hud-art.mjs';
import {petPortraitStyle} from './campaign-pet-ui.mjs';import {PETS,PET_STAGE} from './campaign-pet-data.mjs';
const $=s=>document.querySelector(s);
export function mountBattleHud(){const stack=document.createElement('div');stack.className='battle-party-stack';$('.battle-top').prepend(stack);for(const id of ['party-hud','companion-hud','artifact-hud'])stack.append($('#'+id));const artifact=$('#artifact-hud');artifact.insertAdjacentHTML('afterbegin','<span class="artifact-hud-frame" aria-hidden="true"></span>');}
export async function styleStageTitle(stage,petMode=false){await ensureHudArt();const root=$('.objective'),f=hudElement('title',stage.artStageId||stage.id);root.querySelector('.realm-hud-plate')?.remove();root.insertAdjacentHTML('afterbegin',hudArtwork(f));root.style.cssText=hudLayoutStyle(f);root.dataset.theme=stage.theme;$('#stage-title').textContent=stage.name+(petMode?' · 灵宠副本':'');}
export function styleArtifactHud(id){const root=$('#artifact-hud');if(root.dataset.artifact===id)return;const f=hudElement('artifact',id);if(!f)return;root.dataset.artifact=id;root.style.cssText=hudLayoutStyle(f);root.querySelector('.artifact-hud-frame').innerHTML=hudArtwork(f);}
export async function stylePetGate(stage){const id=PET_STAGE[stage.id];if(!id)return;await ensureHudArt();const root=$('#pet-challenge'),f=hudElement('pet',id);root.dataset.pet=id;root.style.cssText=hudLayoutStyle(f);root.querySelector('.pet-gate-frame').innerHTML=hudArtwork(f);root.querySelector('.pet-gate-portrait').style.cssText=petPortraitStyle(id,0);root.querySelector('.pet-gate-caption').textContent='挑战守关首领，迎战'+PETS[id].name;
 // The authored round portrait cap must keep its aspect while the quiet middle
 // border can extend horizontally. No bitmap is stretched or edited here.
 if(globalThis.arcaneMobile||new URLSearchParams(location.search).get('touch')==='1'){
  const [x,y,w,h]=f.rect,s=f.safeRectLocal||[f.safeRect[0]-x,f.safeRect[1]-y,f.safeRect[2],f.safeRect[3]],a=f.avatarCircleLocal;
  if(!a)return;const left=s[0],right=w-s[0]-s[2];root.classList.add('pet-gate-compact');
  for(const [key,value]of Object.entries({'cap-left':left/h,'cap-right':right/h,'avatar-x':(a[0]-a[2])/h,'avatar-y':(a[1]-a[2])/h,'avatar-size':a[2]*2/h}))root.style.setProperty('--pet-'+key,String(value));
  root.querySelector('.pet-gate-frame').innerHTML=[[x,left],[x+left,w-left-right],[x+w-right,right]].map(([sx,sw])=>`<span class="pet-gate-cap">${hudArtwork({...f,rect:[sx,y,sw,h]})}</span>`).join('');
 }
}
