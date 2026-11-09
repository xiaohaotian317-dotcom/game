import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1400,height:820}});
let html='<style>body{margin:0;background:#172027;color:#f5d6a2;font:20px sans-serif}main{display:flex}.cell{width:350px}svg{width:350px;height:350px;overflow:hidden}</style><main>';
for(const frame of [6,10]){for(const [id,v]of [['B17',3],['B18',2],['B19',3],['B20',3]]){const file=new URL(id+'-motion-v'+v+'.png',import.meta.url),data=readFileSync(file).toString('base64');html+=`<div class="cell">${id} frame${frame}<svg viewBox="627 ${frame===6?314:627} 313 313"><image href="data:image/png;base64,${data}" width="1254" height="1254"/></svg></div>`;}html+='</main><main>';}
await page.setContent(html+'</main>');await page.waitForTimeout(120);await page.screenshot({path:fileURLToPath(new URL('idle6-review.png',import.meta.url))});await browser.close();
