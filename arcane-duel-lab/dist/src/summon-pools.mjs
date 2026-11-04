import {SOLO_HEROES} from './campaign-growth-data.mjs';

export const POOL_ORDER=[...SOLO_HEROES];
// Adjacent atlas rows overlap: preserve each head and skirt with per-hero
// source regions rather than cutting a horizontal strip off every portrait.
export const SUMMON_RECTS={fire:[0,0,540,540],nature:[540,0,500,540],frost:[1036,0,500,540],lightning:[0,520,540,504],shadow:[540,520,516,504],star:[1056,520,480,504]};
export const SUMMON_REGIONS={
 fire:[[0,0,540,526],[0,526,235,14],[335,526,205,14]],
 nature:[[540,0,500,534],[540,534,110,6],[730,534,310,6]],
 frost:[[1036,0,500,534],[1036,534,192,6],[1268,534,268,6]],
 lightning:[[0,540,540,484],[235,526,100,14]],
 shadow:[[540,540,516,484],[650,528,80,12]],
 star:[[1056,540,480,484],[1228,528,40,12]]
};
export const POOLS={
 fire:{title:'烬火之誓',en:'OATH OF EMBERS',color:'#ef9655',dark:'#6d3024',role:'远程法术 · 爆发灼烧',verse:'让余烬，照亮最后的长夜。',copy:'执掌熔火与陨星的焰术师。以爆燃印铺开火线，让坠落的陨火终结战场。',face:[330,80]},
 nature:{title:'万象新芽',en:'WHISPER OF THE GROVE',color:'#b5d283',dark:'#314d3b',role:'远程法术 · 召唤协同',verse:'万物有灵，生生不息。',copy:'与古林缔约的森灵。荆棘听从她的呼唤，木灵鹿与古树共同守护旅途。',face:[805,85]},
 frost:{title:'霜月低语',en:'VOW OF THE FROST MOON',color:'#b3e9f0',dark:'#2d526e',role:'远程法术 · 寒霜控场',verse:'听见了吗，风雪正在低语。',copy:'踏雪而来的霜语者。让寒霜牵制追敌，以冰雪领域改变交锋的节奏。',face:[1304,105]},
 lightning:{title:'惊雷破晓',en:'HERALD OF THUNDER',color:'#f3d786',dark:'#5d4724',role:'近战雷拳 · 突进追击',verse:'雷鸣未落，拳锋已至。',copy:'以拳锋引雷的雷行者。穿过弹幕，逼近对手，让惊雷在近身的一瞬绽放。',face:[290,581]},
 shadow:{title:'夜鸦契约',en:'COVENANT OF THE RAVEN',color:'#c0a4e3',dark:'#42304f',role:'近战双刃 · 位移背袭',verse:'黑夜之中，每一步都有回声。',copy:'潜行于月影之间的影刃。残影掠过刀锋，用一次返影与背袭改写战局。',face:[862,599]},
 star:{title:'星海回响',en:'ECHOES OF THE ASTRAL SEA',color:'#d5b6f0',dark:'#343661',role:'远程法术 · 空间牵引',verse:'循着星轨，抵达未知的彼岸。',copy:'观测星轨的星术师。以引力与折跃掌握距离，在群星坍缩时完成致命一击。',face:[1268,587]}
};
export function initialPool(value,profile){return POOLS[value]?value:POOL_ORDER.find(id=>!profile.owned.includes(id))||'fire';}
export function poolURL(hero){return 'summon.html?hero='+encodeURIComponent(POOLS[hero]?hero:'fire');}
export function poolStatus(profile,hero){const owned=profile.owned.includes(hero),pity=Math.min(19,Math.max(0,profile.pity[hero]||0));return {owned,pity,remaining:20-pity,canSingle:!owned&&profile.tickets>=1,canTen:!owned&&profile.tickets>=10};}

// Keep breathing room above the full source silhouette at every viewport size.
export function portraitPlacement(hero,width,height){
 const r=SUMMON_RECTS[hero]||SUMMON_RECTS.fire,pad=Math.min(16,height*.04),scale=Math.max(0,Math.min(width/(r[2]*1.07),(height-pad*2)/r[3])),w=r[2]*scale,h=r[3]*scale;
 return {scale,w,h,x:(width-w)/2,y:(height-h)/2};
}
