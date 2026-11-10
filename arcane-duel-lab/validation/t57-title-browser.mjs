import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated browser checks of full-width proportional mobile title, safe 44px buttons and actual navigation. Desktop keeps its original layout. No phone or ad request.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname)),data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
const seed=freshSolo();seed.onboarding.step='done';seed.cleared=Array.from({length:23},(_,i)=>i+1);
async function context(size){const c=await browser.newContext({viewport:size,hasTouch:true});await c.addInitScript(seed=>{if(!localStorage.getItem('arcane-solo-growth-v1'))localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed));},seed);return c;}
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:960,height:432},{width:1280,height:720}]){
  const c=await context(size),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'/index.html?touch=1');await p.locator('#start-button:not([disabled])').waitFor();
  await p.locator('#title-settings-open image').evaluate(async e=>{const im=new Image();im.src=e.getAttribute('href');await im.decode();});
  const rects=await p.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height};};return {screen:r(document.querySelector('#title-screen')),start:r(document.querySelector('#start-button')),settings:r(document.querySelector('#title-settings-open')),art:getComputedStyle(document.querySelector('#title-screen')).backgroundSize};});
  for(const r of [rects.start,rects.settings])assert(r.w>=44&&r.h>=44&&r.x>=0&&r.y>=0&&r.x+r.w<=size.width+1&&r.y+r.h<=size.height+1);
  if(size.width/size.height>=1672/941)assert.equal(parseFloat(rects.art),size.width);
  await p.screenshot({path:path.join(import.meta.dirname,`t57-title-${size.width}.png`)});
  await p.locator('#title-settings-open').click();await p.locator('.realm-settings[open]').waitFor();await p.locator('.settings-close').click();
  await p.locator('#start-button').click();await p.waitForURL('**/lobby.html');report.checks.push({size,rects,realSettingsAndStartClicks:true});await c.close();
 }
 const c=await context({width:1280,height:720}),p=await c.newPage();await p.goto(base+'/index.html');await p.locator('#start-button:not([disabled])').waitFor();assert.equal(await p.locator('#title-settings-open').evaluate(e=>e.classList.contains('mobile-title-settings')),false);await c.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t57-title-browser-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
