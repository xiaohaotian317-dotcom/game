import {drawFxFrame} from './boss-fx-painter.mjs';
import {phaseFrames,drawFrameBlend} from './fx-animation.mjs';
const image=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('技能素材加载失败：'+url));im.src=url;});
export async function loadAlternateArt(heroes,assets,progress=()=>{}){
 assets.alternateArt||={};const art=assets.alternateArt;art.pending||={};
 art.metaPromise??=Promise.all(['assets/campaign-growth/growth-hero-bounds-v1.json','assets/refined-skills/atlas-meta-v2.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error('技能素材信息加载失败');return r.json();}))).catch(e=>{art.metaPromise=null;throw e;});
 [art.heroMeta,art.refinedMeta]=await art.metaPromise;let done=0;const ids=[...new Set(heroes)];
 await Promise.all(ids.map(async hero=>{if(!art['heroFx-'+hero]){art.pending[hero]??=Promise.all([image('assets/campaign-growth/'+art.heroMeta.units[hero].file),image('assets/campaign-growth/'+art.heroMeta.icons[hero].file),image('assets/refined-skills/'+art.refinedMeta.units[hero].file)]).then(([fx,icon,refined])=>{art['heroFx-'+hero]=fx;art['heroIcon-'+hero]=icon;art['refined-'+hero]=refined;}).catch(e=>{delete art.pending[hero];throw e;});await art.pending[hero];}progress(++done,ids.length);}));return art;
}
export function drawAlternateSkills(c,w,art){const m=art.heroMeta?.units?.[w.hero],img=art['heroFx-'+w.hero]||art.heroFx,fields=w.duelSkills?.fields||w.campaign?.soloFields||[];
 const refined=art.refinedMeta?.units?.[w.hero],bitmap=art['refined-'+w.hero];
 if(refined&&bitmap){
  for(const e of w.effects){if(e.kind!=='soloSkill')continue;const field=e.fieldCastId===undefined?null:fields.find(f=>f.castId===e.fieldCastId);if(e.fieldCastId!==undefined&&!field)continue;const age=Math.min(e.duration,e.age+(e.visualOffset||0)),phase=phaseFrames(age,e.duration,{loop:!!field,impact:e.phase==='impact'});c.save();c.translate(field?.x??e.x,field?.y??e.y);if(e.face<0)c.scale(-1,1);drawFrameBlend(c,bitmap,refined.frames.slice(e.row*8,e.row*8+8),phase,0,0,e.size||240,{ground:!!e.ground,alpha:Math.min(1,(e.duration-age)*5)});c.restore();}
  for(const s of w.projectiles){if(s.kind!=='soloBolt')continue;const row=s.soloRow||0,phase={a:2+Math.floor(s.age*14)%2,b:2+(Math.floor(s.age*14)+1)%2,mix:s.age*14%1};drawFrameBlend(c,bitmap,refined.frames.slice(row*8,row*8+8),phase,s.x,s.y,row===1&&w.hero==='fire'?180:125,{angle:Math.atan2(s.vy,s.vx)});}
  return;
 }
 for(const e of w.effects){if(e.kind!=='soloSkill'||!m||!img)continue;const field=e.fieldCastId===undefined?null:fields.find(f=>f.castId===e.fieldCastId);if(e.fieldCastId!==undefined&&!field)continue;const p=Math.min(1,(e.age+(e.visualOffset||0))/e.duration),frame=e.row*4+Math.min(3,Math.floor(p*4)),x=field?.x??e.x,y=field?.y??e.y;c.save();c.translate(x,y);if(e.face<0)c.scale(-1,1);drawFxFrame(c,img,m,frame,0,0,e.size||240,{ground:!!e.ground,alpha:Math.min(1,(1-p)*5)});c.restore();}
 for(const s of w.projectiles){if(s.kind!=='soloBolt'||!img||!m)continue;drawFxFrame(c,img,m,s.soloRow*4+Math.floor(s.age*12)%4,s.x,s.y,100,{angle:Math.atan2(s.vy,s.vx)});}
}
