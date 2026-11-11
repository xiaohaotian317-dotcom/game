import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Real shop/pet UI using isolated browser saves. Seeded coins/pets for QA, no formal save, phone, SDK or ad requests.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname)),data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:1280,height:720}]){
  const context=await browser.newContext({viewport:size,hasTouch:true}),p=await context.newPage(),seed=freshSolo();seed.onboarding.step='done';seed.coins=10000;seed.cleared=[4,5];seed.pets=[{id:'qa-pet',kind:'mossdeer',exp:2000,form:2,traits:{hp:1,mp:1,attack:1},skillRanks:[1,0,0]}];seed.activePetId='qa-pet';
  await context.addInitScript(seed=>{if(!localStorage.getItem('arcane-solo-growth-v1'))localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed));},seed);
  p.on('pageerror',e=>report.errors.push(e.message));await p.goto(base+'/shop.html?touch=1');await p.locator('[data-offer=coins]').waitFor();
  await p.locator('[data-shop-tab=gold]').click();assert.equal(await p.locator('[data-buy]').count(),5);
  await p.waitForFunction(()=>document.querySelector('#shop-rewards').clientHeight>60);
  const layout=await p.locator('[data-buy]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom,right:r.right};}));
  for(const b of layout)assert(b.height>=44&&b.x>=0&&b.right<=size.width&&b.bottom<=size.height,'shop button clipped '+JSON.stringify(b));
  await p.screenshot({path:path.join(import.meta.dirname,`t61-shop-${size.width}.png`)});
  await p.locator('[data-buy=buyStoneSmall]').click();await p.locator('.shop-confirm button[value=cancel]').click();assert.equal(await p.locator('#shop-coins').textContent(),'10000');
  for(const id of ['buyStoneSmall','buyStoneMedium','buyPetXpSmall','buyPetXpMedium','buyPetSkillStone']){await p.locator('[data-buy='+id+']').click();await p.locator('[data-confirm-buy]').click();await p.locator('.shop-confirm:not([open])').waitFor({state:'attached'});}
  assert.equal(await p.locator('#shop-coins').textContent(),'4650');
  await p.goto(base+'/campaign.html?touch=1&panel=pet');await p.locator('.pet-archive[data-mobile-pet=ready]').waitFor();
  await p.locator('[data-mobile-pet-tab=skills]').click();
  const first=p.locator('[data-pet-skill-index="0"]');await first.scrollIntoViewIfNeeded();
  const skill=first.locator('xpath=ancestor::article');assert((await skill.locator('.pet-skill-cost').getAttribute('aria-label')).includes('技能石×1（持有1）'));
  const petButtons=await p.locator('[data-pet-skill-upgrade]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,height:r.height};}));
  for(const b of petButtons)assert(b.height>=44&&b.x>=0&&b.right<=size.width&&b.bottom<=size.height,'pet skill button outside phone '+JSON.stringify(b));
  await p.screenshot({path:path.join(import.meta.dirname,`t61-pet-${size.width}.png`)});
  await first.click();await p.waitForFunction(()=>JSON.parse(localStorage.getItem('arcane-solo-growth-v1')).pets[0].skillRanks[0]===2);
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('arcane-solo-growth-v1')));assert(!saved.bag.some(i=>i.type==='petSkillStone'));assert.equal(saved.pets[0].skillRanks[0],2);
  report.checks.push({size,layout,purchaseCancelNoCharge:true,fivePurchasesCoins:4650,skillStoneConsumedOnce:true,petSkillLevelAfterUpgrade:3});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t61-shop-browser-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
