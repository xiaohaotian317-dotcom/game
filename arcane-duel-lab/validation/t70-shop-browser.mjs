import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {localDay} from '../dist/src/shop-state.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated browser UI only; existing three claims retained at new limit five. No SDK or ad requests, no phone or real saves.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const size of [{width:800,height:360},{width:568,height:320}]){
  const context=await browser.newContext({viewport:size,hasTouch:true}),p=await context.newPage(),seed=freshSolo();seed.onboarding.step='done';seed.shop={day:localDay(),counts:{coins:3,experience:3,stone:3},ticketAds:0,receipts:['previously-verified']};
  await context.addInitScript(p=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(p)),seed);
  await p.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'/shop.html?touch=1');await p.locator('[data-offer=coins]').waitFor();
  for(const id of ['coins','experience','stone'])assert.match(await p.locator(`[data-offer=${id}]`).locator('xpath=ancestor::article').locator('small').textContent(),/今日 3 \/ 5/);
  assert.match(await p.locator('[data-offer=ticket]').locator('xpath=ancestor::article').locator('small').textContent(),/今日 0 \/ 2/);
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcane-solo-growth-v1')));assert.equal(saved.shop.counts.coins,3);assert(saved.shop.receipts.includes('previously-verified'));
  await p.screenshot({path:path.join(import.meta.dirname,`t70-shop-${size.width}.png`)});report.checks.push({size,basicRewards:'3 / 5',tickets:'0 / 2',recordsPreserved:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t70-shop-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
