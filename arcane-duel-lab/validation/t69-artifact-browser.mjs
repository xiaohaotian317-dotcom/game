import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {ARTIFACTS,artifactUpgradeCost} from '../dist/src/campaign-artifacts.mjs';
const root=path.resolve(import.meta.dirname,'../dist');
const report={scope:'Isolated real campaign artifact UI; seeded browser profiles. No formal save, phone, ads, build, install, or release.',checks:[],transactions:[],errors:[],resources:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));const data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'msedge',headless:true});
const bounds=async loc=>loc.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,clientHeight:e.clientHeight,scrollHeight:e.scrollHeight,scrollTop:e.scrollTop,overflowY:s.overflowY};});
const inRect=(a,b)=>a.x>=b.x-.6&&a.y>=b.y-.6&&a.right<=b.right+.6&&a.bottom<=b.bottom+.6;
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcane-solo-growth-v1')));
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:568,height:320},{width:1280,height:720}])for(const state of ['unowned','owned','equipped','max']){
  const seed=freshSolo();seed.onboarding.step='done';seed.coins=100000;seed.artifacts=state==='unowned'?{}:Object.fromEntries(Object.keys(ARTIFACTS).map(id=>[id,{level:state==='max'?10:1}]));seed.equippedArtifact=state==='equipped'?'mirror':null;seed.mirrorEquipped=state==='equipped';
  const context=await browser.newContext({viewport:size,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('response',r=>{if(r.status()>=400)report.resources.push({url:r.url(),status:r.status()});});
  await context.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);
  await page.goto(base+'/campaign.html?touch=1&panel=artifact');await page.locator('#solo-system[open] .artifact-choices').waitFor();await page.waitForTimeout(100);
  for(const id of Object.keys(ARTIFACTS)){
   const select=page.locator('[data-artifact-select='+id+']');await select.click();
   const body=await bounds(page.locator('.system-body')),layout=await bounds(page.locator('.mirror-layout')),display=await bounds(page.locator('.mirror-display')),art=await bounds(page.locator('.artifact-large')),scroll=await bounds(page.locator('.artifact-detail-scroll')),actions=await bounds(page.locator('.artifact-action-bar')),equip=await bounds(page.locator('[data-artifact-equip]')),upgrade=await bounds(page.locator('[data-artifact-upgrade]')),footer=await bounds(page.locator('.system-footer')),selector=await bounds(select);
   assert(inRect(layout,body)&&inRect(display,layout)&&inRect(art,display),'full art frame clipped '+JSON.stringify({size,state,id,body,layout,display,art}));
   assert(inRect(scroll,layout)&&inRect(actions,layout)&&inRect(equip,actions)&&inRect(upgrade,actions),'details/actions clipped '+JSON.stringify({size,state,id,layout,scroll,actions,equip,upgrade}));
   assert(actions.bottom<=footer.y+.6&&scroll.bottom<=actions.y+.6,'footer/actions cover content');
   assert(body.scrollHeight<=body.clientHeight+1,'whole body still scrolls');
   assert(selector.height>=44&&equip.height>=44&&upgrade.height>=44,'touch target smaller than44');
   const svg=await page.locator('.artifact-large>svg').evaluate(e=>({viewBox:e.getAttribute('viewBox'),preserve:e.getAttribute('preserveAspectRatio'),natural:e.querySelector('image')?.getAttribute('href')}));assert.equal(svg.preserve,'xMidYMid meet');const crop=await page.locator('.artifact-large>svg>svg').evaluate(e=>({overflow:e.getAttribute('overflow'),x:e.getAttribute('x'),y:e.getAttribute('y'),width:e.getAttribute('width'),height:e.getAttribute('height'),viewBox:e.getAttribute('viewBox')}));assert.equal(crop.overflow,'hidden');assert.equal([crop.x,crop.y,crop.width,crop.height].join(' '),svg.viewBox);
   assert.equal(await page.locator('[data-artifact-equip]').isDisabled(),state==='unowned');assert.equal(await page.locator('[data-artifact-upgrade]').isDisabled(),['unowned','max'].includes(state));
   if(state==='unowned')assert.equal(await page.locator('.artifact-detail-scroll h3').textContent(),'尚未获得');
   const equipBefore=JSON.stringify(equip),upgradeBefore=JSON.stringify(upgrade);
   if(scroll.scrollHeight>scroll.clientHeight){await page.locator('.artifact-detail-scroll').evaluate(e=>e.scrollTop=e.scrollHeight);assert((await bounds(page.locator('.artifact-detail-scroll'))).scrollTop>0);assert.equal(JSON.stringify(await bounds(page.locator('[data-artifact-equip]'))),equipBefore);assert.equal(JSON.stringify(await bounds(page.locator('[data-artifact-upgrade]'))),upgradeBefore);await page.locator('.artifact-detail-scroll').evaluate(e=>e.scrollTop=0);}
   report.checks.push({size,state,id,body,layout,display,art,scroll,actions,equip,upgrade,selector,svg});
   if(state==='owned'){
    const before=await saved(page);await page.locator('[data-artifact-equip]').click();let after=await saved(page);assert.equal(after.equippedArtifact,id);assert.equal(after.coins,before.coins);await page.locator('[data-artifact-equip]').click();after=await saved(page);assert.equal(after.equippedArtifact,null);
    const cost=artifactUpgradeCost(after,id);await page.locator('[data-artifact-upgrade]').click();const upgraded=await saved(page);assert.equal(upgraded.coins,after.coins-cost);assert.equal(upgraded.artifacts[id].level,after.artifacts[id].level+1);report.transactions.push({size,id,equipUnequip:true,cost,level:upgraded.artifacts[id].level});
   }
   if((state==='unowned'&&(id==='spring'||[568,800].includes(size.width)))||(state==='owned'&&id==='mirror'&&size.width===800))await page.screenshot({path:path.join(import.meta.dirname,'t69-artifact-'+size.width+'-'+state+'-'+id+'.png')});
  }
  await context.close();
 }
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();const seed=freshSolo();seed.onboarding.step='done';await context.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);await page.goto(base+'/campaign.html?panel=artifact');await page.locator('.mirror-layout').waitFor();assert.equal(await page.locator('html[data-mobile]').count(),0);const desktop=await page.locator('.mirror-layout').evaluate(e=>({minHeight:getComputedStyle(e).minHeight,columns:getComputedStyle(e).gridTemplateColumns,display:getComputedStyle(document.querySelector('.artifact-action-bar')).display}));assert.equal(desktop.display,'contents');const snapshot=()=>page.evaluate(()=>Array.from(document.querySelectorAll('.artifact-choices,.artifact-choices button,.mirror-layout,.mirror-display,.artifact-large,.mirror-display h3,.mirror-display p,.mirror-description h3,.mirror-description p,.mirror-description dl,[data-artifact-equip],.artifact-upgrade,.artifact-upgrade strong,[data-artifact-upgrade]')).map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {class:e.className,x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,padding:s.padding,margin:s.margin};}));const current=await snapshot();await page.evaluate(()=>{document.querySelectorAll('.artifact-mobile-portrait').forEach(e=>e.remove());for(const e of document.querySelectorAll('.artifact-detail-scroll,.artifact-action-bar'))e.replaceWith(...e.childNodes);});const original=await snapshot();assert.deepEqual(current,original,'desktop geometry or type differs from the original DOM');report.desktop={...desktop,originalDomGeometryIdentical:true};await page.screenshot({path:path.join(import.meta.dirname,'t69-artifact-desktop.png')});await context.close();assert.deepEqual(report.errors,[]);assert.deepEqual(report.resources,[]);report.passed=true;
}catch(e){report.failure={message:e.message,stack:e.stack};throw e;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(import.meta.dirname,'t69-artifact-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,transactions:report.transactions.length,errors:report.errors}));
