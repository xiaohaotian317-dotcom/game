import {drawAlternateSkills} from './alternate-skill-art.mjs';
import {drawWorldDrops} from './campaign-drop-painter.mjs';
import {itemInfo} from './campaign-growth-data.mjs';
export function drawSurface(c,img,m,index,p,{flip=false}={}){const f=m?.frames?.[index];if(!img||!f)return false;const r=f.rect,b=f.spriteRect||r,s=f.standingX||[0,1],left=s[0]*r[2],right=s[1]*r[2],scale=p.w/Math.max(1,right-left),top=(f.topNormalized??.3)*r[3];c.save();if(flip){c.translate(p.x+p.w,p.y);c.scale(-1,1);}else c.translate(p.x,p.y);c.drawImage(img,...b,(b[0]-r[0]-left)*scale,(b[1]-r[1]-top)*scale,b[2]*scale,b[3]*scale);c.restore();return true;}
export function drawSoloEffects(c,w,art){drawAlternateSkills(c,w,art);
 drawWorldDrops(c,w,art);
}
