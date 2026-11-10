export function mobileQuality(storage=globalThis.localStorage){let q='high';try{q=storage?.getItem('arcane-mobile-quality')||q;}catch{}return q==='low'?'low':'high';}
export function renderBudget(){const mobile=!!globalThis.arcaneMobile;return {maxDpr:mobile?(mobileQuality()==='low'?1:1.35):2,fps:mobile&&mobileQuality()==='low'?30:60};}
export function trimMobileAssets(assets,{heroes=[],enemies=[]}={}){
 if(!globalThis.arcaneMobile||!assets)return;
 const keepHeroes=new Set(heroes),keepEnemies=new Set(enemies);
 for(const h of ['fire','nature','frost','lightning','shadow','star'])if(!keepHeroes.has(h)){
  for(const key of [h,h+'Core',h+'Fx'])delete assets[key];delete assets.pending?.[h];
 }
 for(const bucket of ['enemies','enemyPending','bossFx','bossFxPending'])if(assets[bucket])for(const id of Object.keys(assets[bucket]))if(!keepEnemies.has(id))delete assets[bucket][id];
 delete assets.campaignPainter;
}
