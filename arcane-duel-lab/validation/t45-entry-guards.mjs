import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),report={scope:'Isolated actual campaign entry UI, no formal save touched',checks:[]};
const base='http://127.0.0.1:4223/campaign.html',key='arcane-solo-growth-v1',p=freshSolo();p.cleared=Array.from({length:11},(_,i)=>i+1);
async function open(page){await page.goto(base);await page.locator('[data-chapter="2"]').click();await page.locator('[data-stage="21"]').click();await page.locator('#enter-stage').click();await page.locator('[data-team-hero="fire"]').click();}
try{
 const page=await context.newPage();await page.goto(base);await page.evaluate(([k,p])=>localStorage.setItem(k,JSON.stringify(p)),[key,p]);await open(page);
 report.checks.push({name:'selection consumes no cooldown',passed:await page.evaluate(k=>!JSON.parse(localStorage.getItem(k)).challenges?.endlessEnteredAt,key)});
 await page.route('**/assets/campaign/chapter2/chapter2-stage20-v1.png',route=>route.abort());await page.locator('[data-team-confirm]').click();await page.locator('#retry-load:not([hidden])').waitFor({timeout:60000});
 report.checks.push({name:'failed asset load consumes no cooldown',passed:await page.evaluate(k=>!JSON.parse(localStorage.getItem(k)).challenges?.endlessEnteredAt,key)});await page.close();
 const pages=await Promise.all([context.newPage(),context.newPage()]);await Promise.all(pages.map(open));await Promise.all(pages.map(p=>p.locator('[data-team-confirm]').click()));
 await Promise.all(pages.map(p=>p.waitForFunction(()=>!document.querySelector('#battle-screen').hidden||!document.querySelector('#retry-load').hidden,{},{timeout:60000})));
 const states=await Promise.all(pages.map(p=>p.evaluate(k=>({battle:!document.querySelector('#battle-screen').hidden,retry:!document.querySelector('#retry-load').hidden,text:document.querySelector('#loading-text').textContent,stored:JSON.parse(localStorage.getItem(k)).challenges}),key)));
 report.states=states;report.checks.push({name:'two windows allow exactly one real battle',passed:states.filter(s=>s.battle).length===1&&states.filter(s=>s.retry).length===1});report.checks.push({name:'one persisted run for both windows',passed:states.every(s=>s.stored.endlessRuns===1&&s.stored.endlessEnteredAt>0)});
 report.passed=report.checks.every(c=>c.passed);assert.ok(report.passed,JSON.stringify(report));
}catch(e){report.passed=false;report.error=e.stack;process.exitCode=1;}finally{await writeFile(new URL('campaign18-entry-guards.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();await browser.close();}
