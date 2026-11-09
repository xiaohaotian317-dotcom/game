import {chromium} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('./',import.meta.url)),meta=JSON.parse(fs.readFileSync(root+'boss-body-meta-v3.json','utf8'));
const data=Object.fromEntries(Object.entries(meta.units).filter(([id])=>id!=='B12').map(([id,u])=>[id,{...u,url:'data:image/png;base64,'+fs.readFileSync(root+u.file).toString('base64')} ]));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1320,height:590},deviceScaleFactor:1});await page.setContent('<html><meta charset="UTF-8"><style>body{margin:0;background:#14222d;color:#ddc793;font-family:serif;display:flex;gap:12px;padding:12px}.card{width:310px;border:1px solid #6f6240;text-align:center}canvas{display:block;margin:auto}h3{margin:8px}</style><body></body></html>');
 await page.evaluate(async data=>{for(const [id,u]of Object.entries(data)){
  const card=document.createElement('section');card.className='card';card.innerHTML='<h3>'+id+' · '+u.name+'</h3><canvas width="300" height="350"></canvas><canvas width="112" height="112"></canvas><p>原图测量隔离 · 未改PNG</p>';document.body.append(card);
  const img=new Image();img.src=u.url;await img.decode();let c=card.querySelector('canvas').getContext('2d'),f=u.frames[6],s=f.spriteRect,k=Math.min(280/s[2],320/s[3]),dx=(300-s[2]*k)/2,dy=345-s[3]*k;c.save();c.translate(dx,dy);c.scale(k,k);c.translate(-s[0],-s[1]);let path=new Path2D();for(const [x,w,y,h]of f.sourceClipSpans)path.rect(x,y,w,h);c.clip(path);c.drawImage(img,0,0);c.restore();c=card.querySelectorAll('canvas')[1].getContext('2d');c.drawImage(img,...u.portrait.rect,0,0,112,112);
 }},data);await page.screenshot({path:root+'body-contact-sheet.png'});
}finally{await browser.close();}
