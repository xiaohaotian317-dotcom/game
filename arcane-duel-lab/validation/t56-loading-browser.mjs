import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated desktop touch browser, deliberately held local assets to inspect real loading screens. No phone or live ad request.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname)),data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
const seed=freshSolo();seed.onboarding.step='done';seed.cleared=Array.from({length:23},(_,i)=>i+1);
async function context(size){const c=await browser.newContext({viewport:size,hasTouch:true});await c.addInitScript(seed=>{if(!localStorage.getItem('arcane-solo-growth-v1'))localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed));},seed);return c;}
try{
 for(const [size,stage,scene] of [[{width:800,height:360},23,'moon'],[{width:736,height:414},2,'lava'],[{width:1280,height:720},5,'garden']]){
  const c=await context(size),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'/campaign.html?touch=1');await p.locator(`[data-stage="${stage}"]`).click();
  if(stage===23)assert(!/没有(?:BOSS|首领)/i.test(await p.locator('#stage-detail').innerText()));
  await p.locator('#enter-stage').click();await p.locator('[data-team-hero="fire"]').click();
  let release;const held=new Promise(r=>release=r);await p.route('**/assets/**',async route=>{if(/\.(png|json)(\?|$)/.test(route.request().url())&&!route.request().url().includes('/loading/'))await held;await route.continue();});
  await p.locator('[data-team-confirm]').click();await p.locator('#loading:not([hidden])').waitFor();
  await p.locator('#loading-art').evaluate(im=>im.decode());
  const state=await p.evaluate(()=>{const e=document.querySelector('#loading'),im=e.querySelector('img'),box=e.getBoundingClientRect();return {src:im.getAttribute('src'),fit:getComputedStyle(im).objectFit,width:box.width,height:box.height,progress:e.querySelector('progress').value,buttons:[...e.querySelectorAll('button:not([hidden])')].map(b=>{const r=b.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};})};});
  assert.equal(state.src,`assets/loading/${scene}-loading-v1.png`);assert.equal(state.fit,'cover');assert.equal(state.width,size.width);assert.equal(state.height,size.height);assert.equal(state.progress,0);
  for(const b of state.buttons)assert(b.h>=44&&b.x>=0&&b.y>=0&&b.x+b.w<=size.width+1&&b.y+b.h<=size.height+1);
  await p.screenshot({path:path.join(import.meta.dirname,`t56-loading-${scene}-${size.width}.png`)});
  release();await p.locator('#loading').waitFor({state:'hidden',timeout:45000});await p.locator('#battle-screen:not([hidden])').waitFor();
  report.checks.push({name:'Actual campaign entry uses approved art, proportional full viewport, visible 44px return and real resource completion',stage,size,scene});await c.close();
 }
 const c=await context({width:800,height:360}),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(base+'/index.html?touch=1');await p.locator('#start-button:not([disabled])').waitFor();assert.equal(await p.locator('.title-foot').count(),0);assert.equal(await p.locator('#loading').evaluate(e=>getComputedStyle(e).clipPath==='inset(50%)'||e.getBoundingClientRect().height<=1),true);report.checks.push({name:'Start footer removed while live status remains accessible'});
 // Use a slow actual card-pool image, then a failed first load and its retry.
 let attempt=0;await p.route('**/assets/summon/fire-sanctum-v1.png',async route=>{attempt++;if(attempt===1){await new Promise(r=>setTimeout(r,450));await route.abort();}else await route.continue();});
 await p.goto(base+'/summon.html?hero=fire&touch=1');await p.locator('.realm-loading.loading-error:not([hidden])').waitFor();assert((await p.locator('.loading-landscape').getAttribute('style')).includes('lava-loading-v1.png'));await p.locator('.loading-retry').click();await p.locator('.realm-loading').waitFor({state:'hidden',timeout:30000});assert.equal(attempt,2);report.checks.push({name:'Card-pool loading failure keeps original illustration and retry recovers actual art'});
 await p.goto(base+'/characters.html?touch=1');await p.waitForFunction(()=>document.querySelector('#studio-status')?.textContent.includes('六职业'),null,{timeout:45000});await p.locator('.realm-loading').waitFor({state:'hidden'});report.checks.push({name:'Six-hero studio finishes shared illustrated resource loading'});
 await p.goto(base+'/bestiary.html?touch=1');await p.waitForFunction(()=>document.querySelector('.realm-loading')&&document.querySelector('#load-notice')?.textContent==='',null,{timeout:20000});await p.locator('[data-kind="boss"]').click();await p.waitForFunction(()=>document.querySelector('#load-notice')?.textContent==='',null,{timeout:20000});await p.locator('.realm-loading').waitFor({state:'hidden'});report.checks.push({name:'Bestiary creature and boss asset loads finish shared illustrated overlay'});
 await c.close();assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t56-loading-browser-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
