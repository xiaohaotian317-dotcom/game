import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1240,height:1690},deviceScaleFactor:1}),report={scope:'Six heroes, actual original movement FX and hero renderer, three sampled ages. Isolated art QA, no save writes, not human animation acceptance.',errors:[],failed:[]};
page.on('pageerror',e=>report.errors.push(e.stack||String(e)));page.on('response',r=>{if(r.status()>=400)report.failed.push(r.url());});
try{
 await page.route('**/__t46_movement',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:#08131e}canvas{display:block;margin:20px;width:1200px;height:1650px}</style><canvas width="1200" height="1650"></canvas>'}));
 await page.goto('http://127.0.0.1:4223/__t46_movement');
 report.result=await page.evaluate(async()=>{
  const [{Renderer,loadAssets,ensureHeroAssets},{createWorld,step,STEP,HEROES},{drawMovementFx}]=await Promise.all([import('/src/renderer.mjs'),import('/src/simulation.mjs'),import('/src/movement-fx.mjs')]);
  const assets=await loadAssets(()=>{},{scenes:false});for(const hero of Object.keys(HEROES))await ensureHeroAssets(hero,assets);
  const canvas=document.querySelector('canvas'),renderer=new Renderer(canvas,assets),c=renderer.ctx;c.fillStyle='#0b1926';c.fillRect(0,0,1200,1650);c.textAlign='center';c.fillStyle='#e2c58c';c.font='26px Microsoft YaHei';c.fillText('六职业 · 轻量二段跳与瞬移特效',600,44);c.font='13px Microsoft YaHei';c.fillStyle='#b1bdbe';c.fillText('实际人物和原图 · 每格依次为 0.10 / 0.25 / 0.40 秒 · 静态相位检查',600,70);
  let samples=0;for(const [index,hero]of Object.keys(HEROES).entries())for(const [column,kind]of ['jump','teleport'].entries()){
   const left=column*600,top=95+index*255;c.fillStyle=index%2?'#102330':'#0c1d2a';c.fillRect(left+8,top,584,247);c.strokeStyle='#685f48';c.strokeRect(left+8,top,584,247);c.fillStyle=HEROES[hero].color;c.font='17px Microsoft YaHei';c.fillText(HEROES[hero].name+' · '+(kind==='jump'?'二段跳':'瞬移'),left+300,top+28);
   for(const [n,age]of [.1,.25,.4].entries()){
    const w=createWorld(hero);w.targets=[];w.obstacles=[];w.player.grounded=true;w.player.y=w.floor;step(w,STEP,{jump:true});for(let i=0;i<12;i++)step(w,STEP,{});step(w,STEP,{jump:true});
    if(kind==='teleport')step(w,STEP,{dash:true});const e=w.effects.find(e=>e.kind==='heroMovement'&&e.movementKind===kind);if(!e)throw Error('Missing '+hero+' '+kind);
    const x=left+110+n*190,y=top+215;Object.assign(w.player,{x,prevX:x,y,prevY:y});Object.assign(e,{x,y,age});renderer.hero(w,1,.1);drawMovementFx(c,w,e,assets);samples++;
   }
  }return {samples,heroes:Object.keys(HEROES).length,files:Object.keys(assets.movementFx),saveKeys:localStorage.length};
 });
 await page.screenshot({path:fileURLToPath(new URL('t46-six-hero-movement.png',import.meta.url)),fullPage:true});report.passed=report.result.samples===36&&report.result.saveKeys===0&&!report.errors.length&&!report.failed.length;
}catch(e){report.passed=false;report.fatal=e.stack;}finally{writeFileSync(new URL('campaign18-movement-qa.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();}
process.exitCode=report.passed?0:1;
