import {drawWorldDrops} from './campaign-drop-painter.mjs';
import {drawFxFrame} from './boss-fx-painter.mjs';
import {itemInfo} from './campaign-growth-data.mjs';
export function drawSurface(c,img,m,index,p,{flip=false}={}){const f=m?.frames?.[index];if(!img||!f)return false;const r=f.rect,b=f.spriteRect||r,s=f.standingX||[0,1],left=s[0]*r[2],right=s[1]*r[2],scale=p.w/Math.max(1,right-left),top=(f.topNormalized??.3)*r[3];c.save();if(flip){c.translate(p.x+p.w,p.y);c.scale(-1,1);}else c.translate(p.x,p.y);c.drawImage(img,...b,(b[0]-r[0]-left)*scale,(b[1]-r[1]-top)*scale,b[2]*scale,b[3]*scale);c.restore();return true;}
export function drawSoloEffects(c,w,art){const m=art.heroMeta?.units?.[w.hero],img=art['heroFx-'+w.hero]||art.heroFx;
 for(const e of w.effects){if(e.kind!=='soloSkill'||!m||!img)continue;const p=e.age/e.duration,frame=e.row*4+Math.min(3,Math.floor(p*4));drawFxFrame(c,img,m,frame,e.x,e.y,e.size||240,{ground:!!e.ground,alpha:Math.min(1,(1-p)*5)});}
 for(const f of w.campaign.soloFields||[]){if(!f.follow||!img||!m)continue;drawFxFrame(c,img,m,f.row*4+Math.floor(w.fxTime*6)%4,f.x,f.y,350,{ground:true,alpha:.6});}
 for(const s of w.projectiles){if(s.kind!=='soloBolt'||!img||!m)continue;drawFxFrame(c,img,m,s.soloRow*4+Math.floor(s.age*12)%4,s.x,s.y,100,{angle:Math.atan2(s.vy,s.vx)});}
 drawWorldDrops(c,w,art);
}
