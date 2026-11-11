import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo,addItem} from '../dist/src/campaign-profile.mjs';

const root=path.resolve(import.meta.dirname,'../dist');
const report={scope:'Isolated Edge browser QA of the real forge UI. Seeded inventory only; no phone, formal save, SDK, ad request, build or installation.',checks:[],errors:[],passed:false};
const server=http.createServer(async(req,res)=>{try{const file=path.join(root,decodeURIComponent(new URL(req.url,'http://local').pathname));const data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch({channel:'msedge',headless:true});
const bounds=async locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom,font:Number.parseFloat(s.fontSize),scrollHeight:e.scrollHeight,clientHeight:e.clientHeight};});
const inRect=(a,b)=>a.x>=b.x-.5&&a.y>=b.y-.5&&a.right<=b.right+.5&&a.bottom<=b.bottom+.5;
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:568,height:320},{width:1280,height:720}])for(const state of ['empty','many']){
  const seed=freshSolo();seed.onboarding.step='done';seed.bag=[];seed.coins=10000;
  if(state==='many'){
   for(let i=0;i<24;i++)addItem(seed,{type:'equipment',slot:i%2?'armor':'weapon',role:i%3?'staff':'melee',quality:i%6,stage:2+i%10});
   for(const type of ['stoneSmall','stoneMedium','stoneHigh'])addItem(seed,{type,count:20});
  }
  const context=await browser.newContext({viewport:size,hasTouch:true}),page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await context.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);
  await page.goto(base+'/campaign.html?touch=1&panel=forge');
  await page.locator('#solo-system[open] .furnaces').waitFor();
  await page.waitForTimeout(160);
  const initial=await page.evaluate(()=>localStorage.getItem('arcane-solo-growth-v1'));
  for(const mode of ['equipment','stone','material-0','material-1','material-2']){
   await page.locator(`[data-furnace-open="${mode}"]`).click();
   const picker=page.locator('.furnace-picker'),inventory=picker.locator('.furnace-inventory');
   await picker.waitFor();
   const frame=await bounds(picker),list=await bounds(inventory),back=await bounds(picker.locator('[data-furnace-back]'));
   assert(list.height>40&&inRect(list,frame),JSON.stringify({size,state,mode,frame,list}));
   assert(back.height>=44&&back.width>=44&&inRect(back,frame),'back target clipped');
   assert.equal(await picker.locator('[data-furnace-remove]').count(),0,'no selected slot must not reserve a remove row');
   const entry={size,state,mode,frame,list,back};
   if(mode==='equipment'){
    const filters=await picker.locator('[data-furnace-filter]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};}));
    for(const r of filters)assert(r.height>=44&&r.width>=44&&inRect(r,frame),'filter target clipped');
    assert(filters.every(r=>r.right<=back.x+1),'filter overlaps return');
    await picker.locator('[data-furnace-filter=armor]').click();
    await picker.locator('[data-furnace-filter=all]').click();entry.filters=filters;
   }
   if(state==='empty'){
    const empty=await bounds(inventory.locator('.empty-forge')),heading=await bounds(inventory.locator('.empty-forge h3')),copy=await bounds(inventory.locator('.empty-forge p'));
    assert(inRect(empty,list)&&inRect(heading,list)&&inRect(copy,list),'empty explanation clipped '+JSON.stringify({size,mode,empty,heading,copy,list}));
    entry.empty={empty,heading,copy};
   }else{
    const first=inventory.locator('[data-furnace-pick]').first(),icon=await bounds(first),name=await bounds(inventory.locator('article strong').first()),quantity=await bounds(inventory.locator('article small').first());
    assert(icon.width>=48&&icon.height>=48&&inRect(icon,list),'first icon clipped');assert(name.font>=12);assert(quantity.font>=11);
    const last=inventory.locator('[data-furnace-pick]:not([disabled])').last();await last.scrollIntoViewIfNeeded();const lastRect=await bounds(last);assert(inRect(lastRect,list),'last item cannot be reached');
    await last.click();assert.equal(await picker.count(),0,'selection should return to furnace');
    await page.locator(`[data-furnace-open="${mode}"]`).click();
    const remove=await bounds(page.locator('[data-furnace-remove]')),listSelected=await bounds(page.locator('.furnace-inventory'));
    assert(remove.height>=44&&remove.width>=44&&remove.y>=listSelected.bottom-.5&&inRect(remove,await bounds(page.locator('.furnace-picker'))),'remove overlaps inventory');
    await page.locator('[data-furnace-remove]').click();assert.equal(await page.locator('.furnace-picker').count(),0);
    entry.item={icon,name,quantity,lastRect,remove,listSelected};
    await page.locator(`[data-furnace-open="${mode}"]`).click();assert.equal(await page.locator('[data-furnace-remove]').count(),0);
   }
   if(['equipment','stone','material-0'].includes(mode))await page.screenshot({path:path.join(import.meta.dirname,`t65-forge-${size.width}-${state}-${mode}.png`)});
   await page.locator('[data-furnace-back]').click();assert.equal(await page.locator('.furnace-picker').count(),0);
   assert.equal(await page.evaluate(()=>localStorage.getItem('arcane-solo-growth-v1')),initial,'selection/back/remove must not consume or save items');
   report.checks.push(entry);
  }
  await context.close();
 }
 // Desktop has no mobile marker and retains the existing presentation.
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage();
 await context.addInitScript(()=>{localStorage.setItem('arcane-solo-growth-v1',JSON.stringify({version:1,onboarding:{step:'done'},bag:[],owned:['fire'],selected:'fire'}));});
 await page.goto(base+'/campaign.html?panel=forge');await page.locator('[data-furnace-open=stone]').click();assert.equal(await page.locator('html[data-mobile]').count(),0);assert.equal(await page.locator('[data-furnace-remove]').count(),0);await page.locator('[data-furnace-back]').click();await context.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.failure={message:error.message,stack:error.stack};throw error;
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(import.meta.dirname,'t65-forge-browser.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
