import {ENEMIES} from './enemy-roster.mjs';
import {enemyCastOrigin} from './enemy-simulation.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export async function loadBossEffects(ids,assets,progress=()=>{}){
 const bosses=[...new Set(ids)].filter(id=>ENEMIES[id]?.boss);if(!bosses.length)return;
 assets.bossFx||={};assets.bossFxPending||={};
 if(!assets.bossFxMeta){await (assets.bossMetaPending||=(async()=>{try{const r=await fetch('assets/boss-fx/bounds-v2.json');if(!r.ok)throw new Error('首领特效信息载入失败');assets.bossFxMeta=await r.json();}catch(e){delete assets.bossMetaPending;throw e;}})());}progress();
 await Promise.all(bosses.map(async id=>{if(!assets.bossFx[id])await (assets.bossFxPending[id]||=(async()=>{try{const img=new Image();await new Promise((yes,no)=>{img.onload=yes;img.onerror=()=>no(new Error('首领特效载入失败：'+ENEMIES[id].name));img.src='assets/boss-fx/'+assets.bossFxMeta.units[id].file;});assets.bossFx[id]=img;}catch(e){delete assets.bossFxPending[id];throw e;}})());progress();}));
}
// Render original transparent bitmap at one uniform scale; isolate neighbor cells.
export function drawFxFrame(c,img,meta,frame,x,y,size,{ground=false,angle=0,alpha=1}={}){
 const f=meta?.frames?.[frame];if(!img||!f)return false;const r=f.rect,s=f.spriteRect||r,center=f.centerX??r[2]/2,foot=(ground?f.bottomNormalized:.5)*r[3],scale=size/r[2];
 c.save();c.translate(x,y);if(angle)c.rotate(angle);c.globalAlpha*=alpha;c.drawImage(img,...s,(s[0]-r[0]-center)*scale,(s[1]-r[1]-foot)*scale,s[2]*scale,s[3]*scale);c.restore();return true;
}
export class BossFxPainter{
 constructor(c,assets){this.c=c;this.a=assets;}
 sprite(id,frame,x,y,size,options){return drawFxFrame(this.c,this.a.bossFx?.[id],this.a.bossFxMeta?.units?.[id],frame,x,y,size,options);}
 windup(w,e){const a=e.ai?.attack,s=a?.plan.steps[a.index];if(!ENEMIES[e.enemyKind]?.boss||!s||a.age>=s.windup)return false;const p=clamp(a.age/s.windup,0,1),o=enemyCastOrigin(w,e);return this.sprite(e.enemyKind,Math.min(3,Math.floor(p*4)),o.x,o.y,100+p*38,{alpha:.6+p*.35});}
 projectile(w,s){const id=s.enemyKind||w.targets.find(e=>e.id===s.enemySource)?.enemyKind;if(!ENEMIES[id]?.boss)return false;const angle=Math.atan2(s.vy,s.vx);return this.sprite(id,4+Math.floor(s.age*14)%4,s.x,s.y,96,{angle});}
 effect(w,e){if(e.kind!=='enemyVfx'||!ENEMIES[e.enemyKind]?.boss)return false;const p=clamp(e.age/e.duration,0,1),ground=['heal','bone','root','web'].includes(e.style)&&!e.melee&&e.ground;return this.sprite(e.enemyKind,(ground?12:8)+Math.min(3,Math.floor(p*4)),e.x,e.y,Math.max(95,Math.min(390,(e.radius||75)*2.1)),{alpha:Math.min(1,(1-p)*4),ground:!!ground,angle:e.melee&&e.face<0?Math.PI:0});}
 zone(w,z){if(!ENEMIES[z.enemyKind]?.boss)return false;const age=w.time-z.created,active=age>=z.delay;if(!active)return false;const life=z.life||1,fade=Math.min(1,(z.delay+life-age)*3);return this.sprite(z.enemyKind,12+Math.floor(age*8)%4,z.x,z.y,Math.min(390,z.radius*2.5),{ground:true,alpha:Math.max(0,fade)});}
 falling(w,z){const age=w.time-z.created;if(!z.fall||age<z.warning||age>=z.delay)return false;const p=(age-z.warning)/z.fall;return this.sprite(z.enemyKind,4+Math.min(3,Math.floor(p*4)),z.x-110*(1-p),z.y-480*(1-p),170,{angle:Math.atan2(480,110)});}
}
