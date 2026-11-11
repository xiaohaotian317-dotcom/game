import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated mobile lobby layout and real entry clicks, original artwork unchanged. No phone/save/ad interaction.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname)),data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
const seed=freshSolo();seed.onboarding.step='done';
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:960,height:432},{width:1024,height:768}]){
  const c=await browser.newContext({viewport:size,hasTouch:true});await c.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);
  const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'/lobby.html?touch=1');await p.locator('.mobile-mode-art').first().waitFor();
  await p.waitForFunction(()=>document.querySelector('#owned-count').textContent.includes('1'));
  const layout=await p.locator('.mode-card').evaluateAll(es=>es.map(e=>{
   const svg=e.querySelector('.mobile-mode-art'),m=svg.getScreenCTM(),r=e.getBoundingClientRect(),vb=svg.viewBox.baseVal;
   return {name:e.getAttribute('aria-label'),x:r.x,y:r.y,width:r.width,height:r.height,scaleX:m.a,scaleY:m.d,source:{x:vb.x,y:vb.y,width:vb.width,height:vb.height},background:getComputedStyle(e.querySelector('.mode-art')).backgroundImage};
  }));
  for(const [i,l] of layout.entries()){assert(Math.abs(l.scaleX-l.scaleY)<1e-8,JSON.stringify(l));assert.equal(l.source.x,i*512);assert.equal(l.source.width,512);assert.equal(l.background,'none');assert(l.x>=0&&l.y>=0&&l.x+l.width<=size.width+1&&l.y+l.height<=size.height+1);}
  await p.screenshot({path:path.join(import.meta.dirname,`t58-lobby-${size.width}.png`)});
  const destinations=[];
  for(const [selector,target] of [['.summon-card','summon.html'],['#duel-open','duel.html'],['#stages-open','campaign.html']]){
   await p.locator(selector).click();await p.waitForURL(`**/${target}`);destinations.push(target);await p.goto(base+'/lobby.html?touch=1');await p.locator('.mobile-mode-art').first().waitFor();
  }
  report.checks.push({size,layout,destinations});await c.close();
 }
 const c=await browser.newContext({viewport:{width:1280,height:720}}),p=await c.newPage();await p.goto(base+'/lobby.html');
 assert.equal(await p.locator('.mobile-mode-art').first().evaluate(e=>getComputedStyle(e).display),'none');await c.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t58-lobby-browser-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
