import {SPLASH_RECTS} from './lobby-art.mjs?v=20261030-duel12';
import {SOLO_HEROES} from './campaign-growth-data.mjs';

export const POOL_ORDER=[...SOLO_HEROES];
// The old atlas rows overlap: exclude top-row boots from lower-row display art.
export const SUMMON_RECTS=Object.fromEntries(Object.entries(SPLASH_RECTS).map(([id,r])=>[id,['lightning','shadow','star'].includes(id)?[r[0],544,r[2],480]:[...r]]));
export const POOLS={
 fire:{title:'烬火之誓',en:'OATH OF EMBERS',color:'#ef9655',dark:'#6d3024',role:'远程法术 · 爆发灼烧',verse:'让余烬，照亮最后的长夜。',copy:'执掌熔火与陨星的焰术师。以爆燃印铺开火线，让坠落的陨火终结战场。',face:[330,80],hair:[.15,.38,.42,.29],cloth:[.35,.68,.53,.26],glow:[.22,.18]},
 nature:{title:'万象新芽',en:'WHISPER OF THE GROVE',color:'#b5d283',dark:'#314d3b',role:'远程法术 · 召唤协同',verse:'万物有灵，生生不息。',copy:'与古林缔约的森灵。荆棘听从她的呼唤，木灵鹿与古树共同守护旅途。',face:[805,85],hair:[.25,.31,.28,.25],cloth:[.48,.68,.4,.27],glow:[.85,.23]},
 frost:{title:'霜月低语',en:'VOW OF THE FROST MOON',color:'#b3e9f0',dark:'#2d526e',role:'远程法术 · 寒霜控场',verse:'听见了吗，风雪正在低语。',copy:'踏雪而来的霜语者。让寒霜牵制追敌，以冰雪领域改变交锋的节奏。',face:[1304,105],hair:[.23,.31,.37,.23],cloth:[.58,.66,.38,.27],glow:[.84,.29]},
 lightning:{title:'惊雷破晓',en:'HERALD OF THUNDER',color:'#f3d786',dark:'#5d4724',role:'近战雷拳 · 突进追击',verse:'雷鸣未落，拳锋已至。',copy:'以拳锋引雷的雷行者。穿过弹幕，逼近对手，让惊雷在近身的一瞬绽放。',face:[290,581],hair:[.52,.13,.18,.11],cloth:[.63,.64,.35,.25],glow:[.17,.17]},
 shadow:{title:'夜鸦契约',en:'COVENANT OF THE RAVEN',color:'#c0a4e3',dark:'#42304f',role:'近战双刃 · 位移背袭',verse:'黑夜之中，每一步都有回声。',copy:'潜行于月影之间的影刃。残影掠过刀锋，用一次返影与背袭改写战局。',face:[862,599],hair:[.32,.22,.3,.19],cloth:[.39,.62,.38,.3],glow:[.8,.48]},
 star:{title:'星海回响',en:'ECHOES OF THE ASTRAL SEA',color:'#d5b6f0',dark:'#343661',role:'远程法术 · 空间牵引',verse:'循着星轨，抵达未知的彼岸。',copy:'观测星轨的星术师。以引力与折跃掌握距离，在群星坍缩时完成致命一击。',face:[1268,587],hair:[.45,.12,.17,.1],cloth:[.57,.67,.39,.27],glow:[.76,.17]}
};
export function initialPool(value,profile){return POOLS[value]?value:POOL_ORDER.find(id=>!profile.owned.includes(id))||'fire';}
export function poolURL(hero){return 'summon.html?hero='+encodeURIComponent(POOLS[hero]?hero:'fire');}
export function poolStatus(profile,hero){const owned=profile.owned.includes(hero),pity=Math.min(19,Math.max(0,profile.pity[hero]||0));return {owned,pity,remaining:20-pity,canSingle:!owned&&profile.tickets>=1,canTen:!owned&&profile.tickets>=10};}

// Elliptical weights fade continuously to zero. Facial pixels are pinned separately.
export function portraitMotion(hero,u,v,time,reduced=false){
 if(reduced)return {x:0,y:0};
 const d=POOLS[hero]||POOLS.fire;
 const weight=([x,y,rx,ry])=>Math.max(0,1-((u-x)/rx)**2-((v-y)/ry)**2);
 const r=SUMMON_RECTS[hero]||SUMMON_RECTS.fire,fx=(d.face[0]-r[0])/r[2],fy=(d.face[1]-r[1])/r[3],distance=((u-fx)/.15)**2+((v-fy)/.17)**2,pin=Math.min(1,Math.max(0,(distance-1)/1.5));
 if(pin===0)return {x:0,y:0};
 const hair=weight(d.hair)*pin,cloth=weight(d.cloth)*pin,wave=Math.sin(time*1.55+v*4.4);
 return {x:hair*wave*3.2+cloth*Math.sin(time*1.1+u*3)*2,y:hair*Math.cos(time*1.55+v*3)*.9+cloth*Math.sin(time*1.1)*.65};
}
