import {SOLO_SKILLS,SOLO_NAMES,skillById,upgradeCosts} from './campaign-growth-data.mjs';
import {skillTabs} from './campaign-passive-ui.mjs';
import {archiveFrame} from './archive-ui-art.mjs';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=['q','e','r'],keyLabels=['F','E','R'];
const gold=value=>Number(value).toLocaleString('zh-CN');

function purchaseButton(action,id,label,cost,coins,{maxed=false}={}){
 const affordable=coins>=cost,disabled=maxed||!affordable;
 const title=maxed?'已完成五次强化':affordable?`${label}消耗 ${gold(cost)} 金币`:`还差 ${gold(cost-coins)} 金币`;
 return `<button type="button" class="archive-primary archive-skill-primary" ${action}="${esc(id)}" ${disabled?'disabled':''} title="${title}" aria-label="${maxed?'已满强化':`${label}，${gold(cost)}金币${affordable?'':'，金币不足'}`}">${archiveFrame('upgrade')}<span><b>${maxed?'强化已满':label}</b>${maxed?'':`<small>${gold(cost)} 金币</small>`}</span></button>`;
}

/** Render only: ownership, learning, equipping and purchases stay in CampaignSystemUI. */
export function renderArchiveSkills(ui,profile,hero,skillStyle){
 const record=profile.heroes[hero],skills=SOLO_SKILLS[hero],coins=Number.isFinite(profile.coins)?profile.coins:0;
 const rows=[0,1,2].map(row=>`<section class="archive-skill-row" aria-label="${keyLabels[row]}技能，两种招式选择一种"><div class="archive-skill-row-label"><kbd>${keyLabels[row]}</kbd><span>${['技艺','秘术','终式'][row]}</span><small>二选一</small></div><div class="archive-skill-pair">${[0,1].map(column=>{
  const skill=skills.find(s=>s.row===row&&s.column===column),rank=record.skills[skill.id],known=rank!==undefined,equipped=record.slots[skill.key]===skill.id,maxed=known&&rank>=5;
  const cost=maxed?0:known?upgradeCosts[row][rank]:skill.cost,short=cost>coins;
  const status=equipped?`<span class="archive-skill-equipped">已佩戴 · ${keyLabels[row]}</span>`:known?`<button type="button" class="archive-skill-equip" data-equip-skill="${skill.id}">佩戴到 ${keyLabels[row]}</button>`:'';
  const hint=maxed?'五次强化已完成':short?`还差 ${gold(cost-coins)} 金币`:known?'每次强化：效果 +8% · 冷却 −2%':'学习后可佩戴至同一行技能槽';
  return `<article class="skill-card archive-skill-card ${known?'':'locked'} ${equipped?'equipped':''}" draggable="${known}" data-drag-skill="${skill.id}" aria-label="${esc(skill.name)}，${keyLabels[row]}技能，${known?`强化${rank}级`:'未学习'}${equipped?'，已佩戴':''}">${archiveFrame('attributes')}<div class="archive-skill-heading"><i class="system-skill-art" style="${esc(skillStyle(hero,skill))}" aria-hidden="true"></i><div class="archive-skill-title"><small>${column?'新分支':'原生招式'} · ${known?'已学习':'未学习'}</small><h3>${esc(skill.name)}</h3><span class="archive-skill-rank">${known?`强化 +${rank} / 5`:'等待修习'}</span></div></div><p class="archive-skill-description">${esc(skill.description)}</p><div class="archive-skill-meta"><span>消耗 <b>${Number(skill.mana.toFixed(1))}</b> 法力</span><span>${keyLabels[row]} · ${['技艺','秘术','终式'][row]}</span></div><div class="skill-actions archive-skill-actions">${status}${known?purchaseButton('data-upgrade-skill',skill.id,'强化',cost,coins,{maxed}):purchaseButton('data-learn',skill.id,'学习',cost,coins)}</div><small class="archive-skill-hint ${short?'shortfall':''}">${hint}</small></article>`;
 }).join('')}</div></section>`).join('');
 const slots=keys.map((key,row)=>{const skill=skillById(record.slots[key]);return `<div data-skill-slot="${key}" aria-label="${keyLabels[row]}佩戴槽，${skill?esc(skill.name):'尚未学习'}"><kbd>${keyLabels[row]}</kbd>${skill?`<i style="${esc(skillStyle(hero,skill))}" aria-hidden="true"></i><strong>${esc(skill.name)}</strong><small>强化 +${record.skills[skill.id]} / 5</small>`:'<span>尚未学习</span><small>学习后选择本行招式</small>'}</div>`;}).join('');
 return `<section class="archive-skills" aria-label="${esc(SOLO_NAMES[hero])}职业技能">${skillTabs('active')}<div class="archive-skills-toolbar">${ui.selector(profile,hero)}<p class="archive-skill-wallet"><span>可用金币</span><b>${gold(coins)}</b></p></div><div class="archive-skills-scroll" tabindex="0" role="region" aria-label="六种职业技能，向下滚动查看全部招式"><div class="skills-grid archive-skills-grid">${rows}</div></div><section class="archive-loadout-panel" aria-label="当前佩戴技能"><div class="archive-loadout-label"><span>当前佩戴</span><small>每行二选一 · 点击佩戴或拖动到对应槽</small></div><div class="skill-loadout archive-skill-loadout">${slots}</div></section></section>`;
}
