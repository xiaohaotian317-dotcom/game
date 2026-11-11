import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated browser settings UI, using the real SettingsDialog, save and redeem modules. Fake native bridge counts only; no phone, real app exit, SDK, ads, formal saves or installation.',checks:[],errors:[],passed:false};
const fixture=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/settings.css"><link rel="stylesheet" href="/realm-controls.css"><style>body{margin:0;background:radial-gradient(ellipse at 50% 30%,#23343a,#050b13);color:#ecd5a4;font:14px SimSun,serif;min-height:100vh}#qa-open{padding:14px}</style></head><body><button id="qa-open">打开设置</button><script type="module">window.qaCalls={quit:0,exports:[],imports:0,backups:0};window.arcaneDesktop={quit:()=>qaCalls.quit++};await import('/src/realm-controls.mjs');const {SettingsDialog}=await import('/src/settings-dialog.mjs');window.qaSettings=new SettingsDialog({storage:localStorage});document.querySelector('#qa-open').onclick=()=>{window.qaOpenReturn=qaSettings.open();};window.qaReady=true;</script></body></html>`;
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://local');if(url.pathname==='/t66-qa.html'){res.setHeader('content-type','text/html');res.end(fixture);return;}const file=path.join(root,decodeURIComponent(url.pathname));res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
const box=async locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,clip:s.clipPath,font:s.fontSize};});
const inside=(a,b)=>a.x>=b.x-.5&&a.y>=b.y-.5&&a.right<=b.right+.5&&a.bottom<=b.bottom+.5;
try{
 for(const mobile of [true,false])for(const size of [{width:800,height:360},{width:736,height:414},{width:568,height:320},{width:1280,height:720}]){
  const context=await browser.newContext({viewport:size,hasTouch:mobile});const seed=freshSolo();seed.onboarding.step='done';
  await context.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(base+'/t66-qa.html'+(mobile?'?touch=1':''));await p.waitForFunction(()=>window.qaReady);await p.locator('#qa-open').click();
  assert(await p.evaluate(()=>qaOpenReturn===undefined&&qaSettings.el.open),'open must remain synchronous');
  await p.waitForFunction(()=>document.querySelectorAll('.settings-ornate-action[data-action-art=ready]').length===2);
  if(!mobile)await p.locator('.settings-footer-actions').scrollIntoViewIfNeeded();
  const dialog=await box(p.locator('.realm-settings')),footer=[];
  for(const selector of ['.settings-done','[data-exit-app]']){
   const button=p.locator(selector),r=await box(button),label=await box(button.locator('.settings-action-label'));
   assert(r.width>=44&&r.height>=44&&inside(label,r)&&inside(r,dialog),'footer clipped '+JSON.stringify({mobile,size,selector,r,label,dialog}));assert.equal(r.clip,'none');assert(await button.locator('.archive-art-piece').count()>=9);footer.push(r);
  }
  assert(footer[0].right<=footer[1].x,'footer actions overlap');
  await p.screenshot({path:path.join(import.meta.dirname,`t66-settings-${mobile?'mobile':'desktop'}-${size.width}-audio.png`)});
  await p.locator('[data-exit-app]').click();assert.equal(await p.evaluate(()=>qaCalls.quit),1);assert(await p.locator('.realm-settings').evaluate(e=>e.open));
  await p.locator('.settings-done').click();assert.equal(await p.locator('.realm-settings').evaluate(e=>e.open),false);
  await p.locator('#qa-open').click();await p.locator('[data-tab=save]').click();
  const actions=[];
  for(const selector of ['[data-export-save]','[data-import-save]']){
   const button=p.locator(selector);await button.scrollIntoViewIfNeeded();const r=await box(button),label=await box(button.locator('.settings-action-label')),content=await box(p.locator('.settings-content'));
   assert(r.width>=44&&r.height>=44&&inside(label,r)&&inside(r,content),'save action clipped '+JSON.stringify({mobile,size,selector,r,label,content}));assert.equal(r.clip,'none');actions.push(r);
  }
  assert(actions[0].right<=actions[1].x,'save buttons overlap');
  await p.screenshot({path:path.join(import.meta.dirname,`t66-settings-${mobile?'mobile':'desktop'}-${size.width}-save.png`)});
  const before=await p.evaluate(()=>localStorage.getItem('arcane-solo-growth-v1'));
  await p.locator('[data-import-save]').click();assert((await p.locator('.settings-status').textContent()).includes('请先勾选'));assert.equal(await p.evaluate(()=>qaCalls.imports),0);
  await p.evaluate(()=>{window.arcaneMobile={bridge:{exportSave:async value=>qaCalls.exports.push(value),importSave:async()=>{qaCalls.imports++;return {text:''};},saveBackup:async()=>{qaCalls.backups++;}}};});
  await p.locator('[data-export-save]').click();await p.waitForFunction(()=>qaCalls.exports.length===1);const exported=await p.evaluate(()=>JSON.parse(qaCalls.exports[0].text));assert.equal(exported.format,'arcane-duel-save');assert(exported.checksum);
  await p.locator('[data-replace-consent]').check();await p.locator('[data-import-save]').click();await p.waitForFunction(()=>qaCalls.imports===1);assert.equal(await p.evaluate(()=>qaCalls.backups),0);assert.equal(await p.evaluate(()=>localStorage.getItem('arcane-solo-growth-v1')),before,'cancelled import must preserve full save');
  await p.locator('[data-tab=gift]').click();const preview=await p.locator('.gift-rewards').textContent();assert(preview.includes('抽奖券 ×3')&&preview.includes('中金币宝箱 ×3')&&preview.includes('中经验药水 ×3'),preview);
  await p.locator('#realm-gift-code').fill('秘境决斗666');await p.locator('.gift-form button').click();assert.equal(await p.locator('.settings-status').textContent(),'兑换成功：3张抽奖券已到账，3个中金币宝箱与3瓶中角色经验药水已放入背包。');
  const redeemed=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcane-solo-growth-v1')));assert.equal(redeemed.tickets,3);assert.equal(redeemed.bag.find(i=>i.type==='chestMedium').count,5);assert.equal(redeemed.bag.find(i=>i.type==='xpMedium').count,6);
  report.checks.push({mobile,size,dialog,footer,saveActions:actions,synchronousOpen:true,sourcePieces:true,returnClosed:true,fakeQuitCalls:1,exportChecksum:true,importConsentRequired:true,cancelPreservesSave:true,giftPreview:preview,giftRewards:{tickets:3,mediumChestsAdded:3,mediumXpAdded:3}});
  await context.close();
 }
 // Slow/failing decorative artwork must never delay or disable the original actions.
 const context=await browser.newContext({viewport:{width:800,height:360},hasTouch:true}),p=await context.newPage();
 await p.route('**/assets/archive-ui/atlas-meta-v1.json',async route=>{await new Promise(r=>setTimeout(r,500));await route.abort();});
 await p.goto(base+'/t66-qa.html?touch=1');await p.waitForFunction(()=>window.qaReady);await p.locator('#qa-open').click();assert(await p.evaluate(()=>qaSettings.el.open&&qaOpenReturn===undefined));await p.locator('.settings-done').click();assert.equal(await p.locator('.realm-settings').evaluate(e=>e.open),false);await p.waitForTimeout(600);await p.locator('#qa-open').click();await p.locator('[data-exit-app]').click();assert.equal(await p.evaluate(()=>qaCalls.quit),1);await context.close();report.artFailureFallback=true;
 report.artSource={file:'dist/assets/archive-ui/archive-controls-v1.png',element:'upgrade',slice:[150,58,150,54],sha256:createHash('sha256').update(await fs.readFile(path.join(root,'assets/archive-ui/archive-controls-v1.png'))).digest('hex'),pixelEdits:false};
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};throw error;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t66-settings-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
