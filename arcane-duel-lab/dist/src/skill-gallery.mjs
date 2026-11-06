import {HEROES} from './simulation.mjs?v=20261030-duel12';
import {SOLO_HEROES} from './campaign-growth-data.mjs';
import {duelSkillChoices} from './duel-skill-data.mjs';
import {duelChoiceStyle} from './duel-skill-ui.mjs';
import {Sound} from './audio.mjs';
new Sound();
const params=new URLSearchParams(location.search),focus=params.get('hero'),order=SOLO_HEROES.includes(focus)?[focus,...SOLO_HEROES.filter(h=>h!==focus)]:SOLO_HEROES;
document.querySelector('#skills').innerHTML=order.map(hero=>{const h=HEROES[hero];return `<section id="codex-${hero}" style="--accent:${h.color}"><div class="hero-heading"><h2>${h.name} · ${h.given}</h2><span>${h.passive} · ${h.passiveText}</span><a href="lobby.html?view=codex&hero=${hero}">试玩与动作检视 ›</a></div><div class="icon-grid">${duelSkillChoices(hero).map(s=>`<article><div class="art-frame"><span class="skill-art" role="img" aria-label="${h.name} ${s.name}图标" style="${duelChoiceStyle(hero,s)}"></span><b class="key">${['F','E','R'][s.row]} · ${s.column?'备选':'原生'}</b></div><h3>${s.name}</h3><p>${s.description}</p><small>${(s.cd??h.skills[s.key].cd).toFixed(1)} 秒冷却 · ${['技艺','秘术','终式'][s.row]}</small></article>`).join('')}</div></section>`;}).join('');
document.querySelector('header>a').href='lobby.html?view=codex'+(SOLO_HEROES.includes(focus)?'&hero='+focus:'');

