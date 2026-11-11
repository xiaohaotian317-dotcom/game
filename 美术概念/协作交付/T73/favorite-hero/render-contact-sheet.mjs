import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {pathToFileURL} from 'node:url';
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
const folder=import.meta.dirname;
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:444,height:248},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(folder,'contact-sheet.html')).href);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('image')).length===6);
 await page.waitForTimeout(500);
 const boxes=await page.locator('svg').evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,viewBox:e.getAttribute('viewBox')})));
 if(boxes.length!==6||boxes.some(b=>b.width!==180||b.height!==48))throw new Error('contact geometry');
 await page.screenshot({path:path.join(folder,'contact-sheet-180x48.png')});
 await writeFile(path.join(folder,'contact-sheet-audit.json'),JSON.stringify({sourcePixelsModified:false,renderMethod:'SVG viewBox cropping plus aspect-ratio-preserving meet; 1 device pixel per CSS pixel; no text overlay',background:'#10202b',order:['fire-v2','nature-v2','frost-v1','lightning-v1','shadow-v1','star-v1'],boxes},null,2)+'\n');
}finally{await browser.close();}
