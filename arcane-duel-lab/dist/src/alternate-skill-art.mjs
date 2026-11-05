import {drawFxFrame} from './boss-fx-painter.mjs';
const image=url=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('技能素材加载失败：'+url));im.src=url;});
export async function loadAlternateArt(heroes,assets,progress=()=>{}){
 assets.alternateArt||={};const art=assets.alternateArt;art.pending||={};
 art.metaPromise??=fetch('assets/campaign-growth/growth-hero-bounds-v1.json').then(r=>{if(!r.ok)throw Error('技能素材信息加载失败');return r.json();}).catch(e=>{art.metaPromise=null;throw e;});
 art.heroMeta=await art.metaPromise;let done=0;const ids=[...new Set(heroes)];
 await Promise.all(ids.map(async hero=>{if(!art['heroFx-'+hero]){art.pending[hero]??=Promise.all([image('assets/campaign-growth/'+art.heroMeta.units[hero].file),image('assets/campaign-growth/'+art.heroMeta.icons[hero].file)]).then(([fx,icon])=>{art['heroFx-'+hero]=fx;art['heroIcon-'+hero]=icon;}).catch(e=>{delete art.pending[hero];throw e;});await art.pending[hero];}progress(++done,ids.length);}));return art;
}
export function drawAlternateSkills(c,w,art){const m=art.heroMeta?.units?.[w.hero],img=art['heroFx-'+w.hero]||art.heroFx,fields=w.duelSkills?.fields||w.campaign?.soloFields||[];
 for(const e of w.effects){if(e.kind!=='soloSkill'||!m||!img)continue;const field=e.fieldCastId===undefined?null:fields.find(f=>f.castId===e.fieldCastId);if(e.fieldCastId!==undefined&&!field)continue;const p=e.age/e.duration,frame=e.row*4+Math.min(3,Math.floor(p*4)),x=field?.x??e.x,y=field?.y??e.y;c.save();c.translate(x,y);if(e.face<0)c.scale(-1,1);drawFxFrame(c,img,m,frame,0,0,e.size||240,{ground:!!e.ground,alpha:Math.min(1,(1-p)*5)});c.restore();}
 for(const s of w.projectiles){if(s.kind!=='soloBolt'||!img||!m)continue;drawFxFrame(c,img,m,s.soloRow*4+Math.floor(s.age*12)%4,s.x,s.y,100,{angle:Math.atan2(s.vy,s.vx)});}
}
