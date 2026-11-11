import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {startTowerRun} from '../dist/src/tower-state.mjs';
const root=path.resolve(import.meta.dirname,'../dist'),report={scope:'Isolated copy of actual campaign.html, real result renderer and CSS/assets; plus two actual campaign battle loads using temporary QA profiles. No formal saves, native phone, ads or leaderboard requests. Geometry/click and battle-load checks only.',checks:[],errors:[],passed:false};
const source=await fs.readFile(path.join(root,'campaign.html'),'utf8');
const fixture=source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>','<head><base href="/">').replace('</head>','<link rel="stylesheet" href="mobile-layout.css"><link rel="stylesheet" href="tower.css"></head>').replace('<html lang="zh-CN">','<html lang="zh-CN" data-mobile="android">').replace('<body>','<body class="tower-battle">');
const server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(name==='/__qa/t59'){res.setHeader('content-type','text/html');res.end(fixture);return;}const file=path.resolve(root,'.'+name);if(!file.startsWith(root+path.sep))throw Error('path');const data=await fs.readFile(file);res.setHeader('content-type',file.endsWith('.mjs')?'text/javascript':file.endsWith('.json')?'application/json':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/octet-stream');res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}),base=`http://127.0.0.1:${server.address().port}`;
try{
 for(const size of [{width:800,height:360},{width:736,height:414},{width:960,height:432},{width:568,height:320},{width:1280,height:720}]){
  const context=await browser.newContext({viewport:size,hasTouch:true}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/__qa/t59');await page.locator('#result-frame').evaluate(e=>e.decode());
  for(const sample of [{floor:2,win:true},{floor:10000,win:true},{floor:70,win:false}]){
   await page.evaluate(async sample=>{
    const $=s=>document.querySelector(s),dialog=$('#result-dialog');if(dialog.open)dialog.close();
    const {renderTowerResult}=await import('/src/campaign-result-ui.mjs');
    dialog.className='result-tower '+(sample.win?'result-victory':'result-defeat');
    $('#result-frame').src='assets/campaign-results/'+(sample.win?'victory-shell-v2.png':'defeat-shell-v2.png');await $('#result-frame').decode();
    $('#result-label').textContent=sample.win?'FLOOR CONQUERED':'THE ASCENT REMAINS';
    $('#result-title').textContent=sample.win?'第 '+sample.floor+' 层已破':'止步第 '+sample.floor+' 层';$('#result-stage').textContent='无尽之塔';
    $('#result-copy').textContent=sample.win?'保留当前生命与法力，继续向更高处进发。':'本次挑战结束，已经完成的最高层数会被保留。';
    dialog.style.setProperty('--result-scene',"url('assets/campaign/stage01-v1.png')");
    renderTowerResult($('#result-rewards'),{completed:sample.win?sample.floor:sample.floor-1,weekBest:sample.floor});
    $('#result-primary .result-button-label').textContent=sample.win?(sample.floor>=10000?'完成登塔':'继续第 '+(sample.floor+1)+' 层'):'重新登塔';$('#result-map span').textContent='结束并返回塔楼';
    window.__towerClicks=[];for(const id of ['result-primary','result-map'])$('#'+id).onclick=()=>window.__towerClicks.push(id);
    dialog.showModal();
   },sample);
   await page.waitForTimeout(450);
   const layout=await page.evaluate(()=>{const r=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom};},$=s=>document.querySelector(s);return {dialog:r($('#result-dialog')),heading:r($('#result-title')),scroll:r($('.result-scroll')),stats:[...document.querySelectorAll('[data-tower-stat]')].map(e=>({text:e.textContent,rect:r(e)})),primary:r($('#result-primary')),map:r($('#result-map')),content:r($('.result-content')),scrollSize:{client:$('.result-scroll').clientHeight,full:$('.result-scroll').scrollHeight}};});
   assert(layout.dialog.x>=0&&layout.dialog.y>=0&&layout.dialog.right<=size.width+1&&layout.dialog.bottom<=size.height+1);
   assert(layout.heading.y>=layout.content.y&&layout.heading.bottom<layout.primary.y);
   for(const stat of layout.stats){assert(stat.rect.y>=layout.scroll.y-1);assert(stat.rect.bottom<=layout.scroll.bottom+1,'floor is clipped by scroll opening');assert(stat.rect.bottom<layout.primary.y,'floor is behind action');}
   assert(layout.scrollSize.full<=layout.scrollSize.client+1,'tower record requires scrolling');
   for(const button of [layout.primary,layout.map])assert(button.height>=44&&button.x>=0&&button.right<=size.width&&button.bottom<=size.height);
   await page.locator('#result-primary').click();await page.locator('#result-map').click();assert.deepEqual(await page.evaluate(()=>window.__towerClicks),['result-primary','result-map']);
   if(size.width===800||size.width===568)await page.screenshot({path:path.join(import.meta.dirname,`t59-tower-${size.width}-${sample.floor}-${sample.win?'win':'loss'}.png`)});
   report.checks.push({size,sample,layout,actionsClicked:true});
  }
  await context.close();
 }
 for(const floor of [1,10000]){
  const context=await browser.newContext({viewport:{width:800,height:360},hasTouch:true}),page=await context.newPage(),seed=freshSolo();
  seed.onboarding.step='done';const run=startTowerRun(seed,['fire'],{id:'t59-browser-run'});run.completed=floor-1;run.floor=floor;
  await context.addInitScript(seed=>localStorage.setItem('arcane-solo-growth-v1',JSON.stringify(seed)),seed);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+'/campaign.html?tower=t59-browser-run&touch=1');await page.locator('#battle-screen:not([hidden])').waitFor({timeout:60000});
  const title=await page.locator('#stage-title').evaluate(el=>{const a=el.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(el);const b=range.getBoundingClientRect();return {text:el.textContent,label:el.getAttribute('aria-label'),x:a.x,y:a.y,right:a.right,bottom:a.bottom,textX:b.x,textY:b.y,textRight:b.right,textBottom:b.bottom};});
  report.checks.push({actualCampaignLoad:true,floor,title});await page.screenshot({path:path.join(import.meta.dirname,`t59-tower-actual-floor-${floor}.png`)});
  assert.equal(title.text,`第 ${floor} 层`);assert(title.label.includes(String(floor)));assert(title.y>=0&&title.bottom<80);assert(title.textX>=title.x-1&&title.textRight<=title.right+1&&title.textY>=title.y-2&&title.textBottom<=title.bottom+2);
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await browser.close();await new Promise(r=>server.close(r));await fs.writeFile(path.join(import.meta.dirname,'t59-tower-browser-report.json'),JSON.stringify(report,null,2));}
console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors}));
