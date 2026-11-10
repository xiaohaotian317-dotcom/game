import {SOLO_HEROES,SOLO_NAMES,experience} from './campaign-growth-data.mjs';
import {archivePortrait} from './archive-character-ui.mjs';
import {heroStats} from './campaign-profile.mjs';
import {splashStyle,SPLASH_RECTS} from './lobby-art.mjs?v=20261030-duel12';
import {validateTeam} from './campaign-team.mjs';

export class CampaignTeamSelection{
 constructor({element,getProfile,onConfirm,onBack,onPrepare}){Object.assign(this,{element,getProfile,onConfirm,onBack,onPrepare});this.slots=[null,null];this.slot=0;element.addEventListener('click',e=>this.action(e));}
 open(stage,petMode=false){this.stage=stage;this.petMode=petMode;this.slots=[null,null];this.slot=0;this.message='';this.element.hidden=false;this.render();this.element.querySelector('[data-team-slot]')?.focus();}
 close(){this.element.hidden=true;}
 render(){const p=this.getProfile(),count=this.slots.filter(Boolean).length;
  this.element.innerHTML=`<div class="team-scenery" style="background-image:url('assets/campaign/${this.stage.art}')"></div><header class="team-heading"><button data-team-back>‹ 返回关卡</button><div><small>PREPARE YOUR EXPEDITION</small><h1>选择出战英雄</h1><p>${this.stage.name}${this.petMode?' · 灵宠副本':''}</p></div><span class="team-count">${count}<small> / 2</small></span></header><div class="team-main"><div class="team-slots">${this.slots.map((id,i)=>{const stats=id&&heroStats(p,id);return `<section class="team-slot ${i===this.slot?'choosing':''} ${id?'filled':'empty'}"><button class="team-slot-select" data-team-slot="${i}" aria-label="选择角色${i+1}${id?' '+SOLO_NAMES[id]:''}" aria-pressed="${i===this.slot}"><span class="team-slot-label">角色${i+1} <kbd>${i+1}</kbd></span>${id?`${archivePortrait(id).replace('archive-hero-art','team-full-hero')}<span class="team-hero-name"><small>Lv.${stats.level}</small><strong>${SOLO_NAMES[id]}</strong><span>生命 ${stats.maxHp} · 法力 ${stats.maxMp} · 攻击 ${stats.attack}</span></span>`:'<span class="team-empty-seal"><b>＋</b><span>选择英雄</span><small>点击下方英雄加入</small></span>'}</button>${id?`<button class="team-remove" data-team-remove="${i}" aria-label="移除角色${i+1}">×</button>`:''}</section>`;}).join('')}</div><aside class="team-roster"><div class="team-roster-title"><h2>英雄名册</h2><small>已拥有 ${p.owned.length} / ${SOLO_HEROES.length}</small></div><div class="team-hero-grid">${SOLO_HEROES.map(id=>{const owned=p.owned.includes(id),slot=this.slots.indexOf(id);return `<button data-team-hero="${id}" ${owned?'':'disabled'} class="team-roster-hero ${owned?'':'locked'} ${slot>=0?'assigned':''}" aria-label="${SOLO_NAMES[id]}${owned?'，加入出战':'，尚未拥有'}"><i style="${splashStyle(id)}"></i><span><strong>${SOLO_NAMES[id]}</strong><small>${owned?'Lv.'+experience(p.heroes[id].exp).level:'尚未拥有'}</small></span>${slot>=0?`<em>${slot+1}</em>`:''}</button>`;}).join('')}</div><p class="team-hint">选择一至两位英雄<br>进入关卡后按 <kbd>1</kbd> / <kbd>2</kbd> 切换</p><button class="team-prepare" data-team-prepare>角色与装备整备</button></aside></div><footer class="team-footer"><p role="status">${this.message||'一位上场，一位候命。也可以只带一位出发。'}</p><button class="gold" data-team-confirm ${count?'':'disabled'}>开始挑战 <span>›</span></button></footer>`;
 }
 action(e){const b=e.target.closest('button');if(!b||b.disabled)return;
  if(b.hasAttribute('data-team-prepare')){this.onPrepare?.();return;}
  if(b.hasAttribute('data-team-back')){this.close();this.onBack();return;}
  if(b.dataset.teamSlot!==undefined){this.slot=Number(b.dataset.teamSlot);this.message='';this.render();return;}
  if(b.dataset.teamRemove!==undefined){const slot=Number(b.dataset.teamRemove);this.slots[slot]=null;this.slot=slot;this.message='';this.render();return;}
  if(b.dataset.teamHero){const id=b.dataset.teamHero,p=this.getProfile();if(!p.owned.includes(id))return;const other=this.slots.indexOf(id);if(other>=0&&other!==this.slot){this.message=SOLO_NAMES[id]+'已在角色'+(other+1)+'中';this.render();return;}this.slots[this.slot]=id;if(!this.slots[1-this.slot])this.slot=1-this.slot;this.message='';this.render();return;}
  if(b.hasAttribute('data-team-confirm')){try{const team=validateTeam(this.getProfile(),this.slots.filter(Boolean));this.close();this.onConfirm(this.stage,this.petMode,team);}catch(error){this.message=error.message;this.render();}}
 }
}
