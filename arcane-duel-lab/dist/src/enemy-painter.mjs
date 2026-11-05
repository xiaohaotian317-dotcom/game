import {ENEMIES} from './enemy-roster.mjs';
import {drawEnemyGroundWarning,drawEnemyLava} from './enemy-ground-art.mjs';
import {enemyAnimationFrame,enemyCastOrigin} from './enemy-simulation.mjs';
import {BossFxPainter,loadBossEffects} from './boss-fx-painter.mjs';
const TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const COLORS={venom:'#b9e66d',web:'#d2b7f5',claw:'#fa9c86',slash:'#d1edbc',sonic:'#e7a4d5',rock:'#c9bda4',stone:'#c8d2b7',lava:'#ffae59',ice:'#b6ecff',lightning:'#ffe4a1',star:'#cbb5ff',bone:'#e6dabc',root:'#badc84',heal:'#bffb98',feather:'#c8a6ef',chain:'#b4d5de',eggHatch:'#d4b3eb'};
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`;};
function line(c,points,color,width=2){c.beginPath();for(let i=0;i<points.length;i++)i?c.lineTo(...points[i]):c.moveTo(...points[i]);c.strokeStyle=color;c.lineWidth=width;c.stroke();}
function ellipse(c,x,y,rx,ry,color,stroke=false,width=2){c.beginPath();c.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,TAU);if(stroke){c.strokeStyle=color;c.lineWidth=width;c.stroke();}else{c.fillStyle=color;c.fill();}}
function glow(c,x,y,r,color,strength=.5){const g=c.createRadialGradient(x,y,0,x,y,Math.max(1,r));g.addColorStop(0,rgba(color,strength));g.addColorStop(1,rgba(color,0));c.fillStyle=g;c.fillRect(x-r,y-r,2*r,2*r);}
function shard(c,x,y,size,color,angle=0){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=color;c.beginPath();c.moveTo(0,-size);c.lineTo(size*.3,0);c.lineTo(0,size*.45);c.lineTo(-size*.3,0);c.closePath();c.fill();line(c,[[0,-size],[0,size*.4]],'#effaff',1);c.restore();}
function lightning(c,x,y,x2,y2,time,color,width=2){const points=[];for(let i=0;i<=9;i++){const t=i/9,wiggle=i===0||i===9?0:Math.sin(i*41.3+time*24)*9;points.push([x+(x2-x)*t+wiggle,y+(y2-y)*t]);}line(c,points,rgba(color,.45),width*4);line(c,points,color,width);line(c,points,'#fffaf0',Math.max(.6,width*.4));}
export async function loadEnemyAssets(ids,assets,progress=()=>{}){
 assets.enemies||={};assets.enemyPending||={};let done=0;const bosses=[...new Set(ids)].filter(id=>ENEMIES[id]?.boss),total=ids.length+bosses.length+(bosses.length?1:0);
 if(!assets.enemyArt){
  await (assets.enemyMetaPending||=(async()=>{try{const response=await fetch('assets/enemies/bounds-v1.json');if(!response.ok)throw new Error('敌人动作信息载入失败，请重试');const data=await response.json();assets.enemyArt=data.units;}catch(error){delete assets.enemyMetaPending;throw error;}})());
 }
 await Promise.all([...new Set(ids)].map(async id=>{
  if(!ENEMIES[id])throw new Error('Unknown enemy '+id);
  if(!assets.enemies[id])await (assets.enemyPending[id]||=(async()=>{try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('无法加载'+ENEMIES[id].name+'动作，请重试'));i.src='assets/enemies/'+id+'-motion-v1.png';});if(img.width<512||img.height<512)throw new Error('敌人图集尺寸不匹配');assets.enemies[id]=img;}catch(error){delete assets.enemyPending[id];throw error;}})());
  progress(++done,total);
 }));
 await loadBossEffects(bosses,assets,()=>progress(++done,total));
}
export class EnemyPainter{
 constructor(ctx,assets){this.c=ctx;this.assets=assets;this.bossEffects=new BossFxPainter(ctx,assets);}
 health(w,e){
  if(e.hp<=0||w.campaign&&ENEMIES[e.enemyKind]?.boss)return;const c=this.c,boss=ENEMIES[e.enemyKind]?.boss,width=boss?112:e.egg?46:56;
  const y=e.y-(e.egg?65:e.visual*.97)-13;c.save();c.textAlign='center';c.font='600 '+(boss?13:11)+'px "Microsoft YaHei",sans-serif';
  const name=e.egg?'蛛卵 · 即将孵化':(e.baby?'幼蛛':ENEMIES[e.enemyKind].name);if(!w.campaign||boss||e.egg){c.lineWidth=3;c.strokeStyle='#09121b';c.strokeText(name,e.x,y-6);c.fillStyle=boss?'#f1d2a1':'#e5d6c1';c.fillText(name,e.x,y-6);}
  c.fillStyle='#07111de6';c.fillRect(e.x-width/2-2,y,width+4,9);c.fillStyle=boss?'#b16871':e.egg?'#b695d6':'#b59c76';c.fillRect(e.x-width/2,y+2,width*clamp(e.hp/e.maxHp,0,1),5);
  if(w.campaign&&!boss&&!e.egg){c.font='10px sans-serif';c.fillStyle='#f0e7cf';c.strokeStyle='#08121d';c.lineWidth=2;const hp=Math.ceil(e.hp)+' / '+e.maxHp;c.strokeText(hp,e.x,y-4);c.fillText(hp,e.x,y-4);}
  c.restore();
 }
 unit(w,e,alpha){
  const c=this.c;if(e.egg){this.egg(w,e);this.health(w,e);return;}
  const d=ENEMIES[e.enemyKind],img=this.assets.enemies?.[e.enemyKind];if(!d||!img)return;
  const dead=e.hp<=0,age=dead?w.time-(e.diedAt??w.time):0;if(age>2.1)return;
  const x=e.prevX+(e.x-e.prevX)*alpha,y=e.prevY+(e.y-e.prevY)*alpha;
  const meta=this.assets.enemyArt?.[e.enemyKind];let frame=enemyAnimationFrame(e,w.time);
  const semantic=['walk','walk','walk','walk','walk','walk','idle','windup','melee','recover','ranged','summon','hurt','stagger','dying','dead'][frame];
  const override=meta?.frameOverrides?.[semantic==='recover'?'recovery':semantic]??meta?.frameOverrides?.[frame];
  if(Array.isArray(override))frame=override[frame<6?frame%override.length:0];else if(Number.isInteger(override))frame=override;
  const cw=img.width/4,ch=img.height/4,rect=meta?.frames?.[frame]?.rect||[(frame%4)*cw,Math.floor(frame/4)*ch,cw,ch];
  const footFrame=d.flying&&frame<7?6:frame,foot=meta?.frames?.[footFrame]?.bottomNormalized??.96;
  let size=e.visual/.76,bob=d.flying?Math.sin(w.fxTime*3+e.id.length)*3:Math.abs(e.vx)<12?Math.sin(w.fxTime*2)*.7:0;
  c.save();c.globalAlpha=dead?clamp(1-(age-.65)/1.45,0,1):1;
  if(!d.flying)ellipse(c,x,y+1,e.w*1.15,5,'#02070c66');
  c.translate(x,y+bob);c.scale(e.face,1);
  if(e.bornAt){const birth=clamp((w.time-e.bornAt)/.45,0,1);c.globalAlpha*=birth;c.translate(0,(1-birth)*12);c.scale(.7+.3*birth,.7+.3*birth);}
  if(!dead&&e.hit>.04)c.filter='brightness(1.65) saturate(.5)';
  const source=meta?.frames?.[frame]?.spriteRect||rect;
  c.drawImage(img,...source,-size/2+(source[0]-rect[0])/rect[2]*size,-size*foot+(source[1]-rect[1])/rect[3]*size,source[2]/rect[2]*size,source[3]/rect[3]*size);
  c.restore();
  if(!dead&&e.ai?.passiveUntil>w.time){glow(c,x,y-e.h*.6,60,COLORS.heal,.2);for(let i=0;i<7;i++){const t=(w.time*.6+i/7)%1;ellipse(c,x+Math.sin(i*2.4)*30*(1-t),y-e.h*.5-t*65,2.5,4,COLORS.heal);}}
  this.health(w,e);this.telegraph(w,e);
 }
 telegraph(w,e){
  const a=e.ai?.attack,s=a?.plan.steps[a.index];if(!s||e.hp<=0||a.age>=s.windup)return;
  const c=this.c,p=a.age/s.windup,color=COLORS[s.style]||'#f7ca88';
  c.save();c.lineWidth=2;c.setLineDash([5,6]);
  if(s.type==='melee'||s.type==='dash'){
   const reach=s.reach*(e.attackScale??e.scale),xx=e.x+e.face*(reach*.5);ellipse(c,xx,e.y-5,reach*.58,13,rgba(color,.18));ellipse(c,xx,e.y-5,reach*.58,13,rgba(color,.7),true);
   c.setLineDash([]);const y=e.y-e.h*.58;glow(c,e.x+e.face*e.w,y,25+p*12,color,.25+p*.2);
   line(c,[[e.x+e.face*e.w,y],[e.x+e.face*(e.w+24+p*12),y-3]],color,2);
  }else if(s.type==='projectile'){
   const {x:sx,y:sy}=enemyCastOrigin(w,e);line(c,[[sx,sy],[a.aim.x,a.aim.y]],rgba(color,.35),1.5);glow(c,sx,sy,22+p*18,color,.3+p*.2);
  }else if(s.type==='egg'||s.type==='summon')ellipse(c,e.x,e.y,60,18,rgba(color,.5),true);
  else{ellipse(c,a.aim.x,w.player.y,s.radius||(s.type==='leap'?156:72),15,rgba(color,.6),true);}
  c.setLineDash([]);c.restore();this.bossEffects.windup(w,e);
 }
 egg(w,e){
  const c=this.c,age=w.time-e.bornAt,dead=e.hp<=0;if(dead&&!e.hatched&&w.time-(e.diedAt||0)>.7)return;
  if(dead&&e.hatched)return;
  c.save();c.translate(e.x,e.y);c.globalAlpha=dead?clamp(1-(w.time-e.diedAt)/.7,0,1):1;
  const grow=clamp(age/.4,0,1);c.scale(grow,grow);
  for(let i=0;i<9;i++){const a=i/9*TAU;line(c,[[0,-8],[Math.cos(a)*43,Math.sin(a)*10]],'#d9cff080',1);}
  const pulse=age>1.1?Math.sin(age*26)*1.7:0;
  const g=c.createLinearGradient(-22,-50,22,0);g.addColorStop(0,'#e7dbef');g.addColorStop(.35,'#c0a8d4');g.addColorStop(1,'#5f496f');
  ellipse(c,pulse,-25,22,29,g);ellipse(c,-7+pulse,-36,7,10,'#f5eaf677');
  for(let i=0;i<5;i++)line(c,[[Math.sin(i*2)*14,-48+i*3],[Math.sin(i*2+1)*16,-25],[Math.sin(i*2+2)*12,-4]],'#66517466',1.2);
  if(age>1.15)for(let i=0;i<3;i++)line(c,[[-16+i*14,-43],[-9+i*12,-32],[-18+i*14,-22],[-7+i*12,-10]],'#30253b',1.5+(age-1.15));
  c.restore();
 }
 zones(w){
  const c=this.c;for(const z of w.enemyZones||[]){const age=w.time-z.created,p=clamp(age/z.delay,0,1),active=age>=z.delay,color=COLORS[z.style]||COLORS.star;
   c.save();const fade=clamp((z.delay+z.life-age)*2,0,1);c.globalAlpha=fade;
   if(!active){if(!drawEnemyGroundWarning(c,this.assets,{style:z.style,x:z.x,y:z.y,radius:z.radius,progress:p,clock:w.fxTime})){ellipse(c,z.x,z.y-2,z.radius,16,rgba(color,.08+.13*p));c.setLineDash([6,5]);ellipse(c,z.x,z.y-2,z.radius,16,rgba(color,.65),true);c.setLineDash([]);ellipse(c,z.x,z.y-2,z.radius*p,12*p,rgba(color,.3),true);}this.bossEffects.falling(w,z);}
   else if(this.bossEffects.zone(w,z)||z.style==='lava'&&drawEnemyLava(c,this.assets.campaignPainter?.art,z.x,z.y,z.radius,age-z.delay)){c.restore();continue;}else{
    glow(c,z.x,z.y-6,z.radius*1.15,color,.18);ellipse(c,z.x,z.y-2,z.radius,14,rgba(color,.25));ellipse(c,z.x,z.y-2,z.radius,14,rgba(color,.7),true,1.5);
    if(z.style==='lava'){
     const g=c.createLinearGradient(0,z.y-26,0,z.y+8);g.addColorStop(0,'#ff7c2144');g.addColorStop(.7,'#ffb24b');g.addColorStop(1,'#8c3026');ellipse(c,z.x,z.y,z.radius,12,g);
     for(let i=0;i<11;i++){const xx=z.x+Math.sin(i*4.3)*z.radius*.9;line(c,[[xx-8,z.y],[xx,z.y-4-Math.sin(w.fxTime*4+i)*2],[xx+12,z.y]],'#ffeb9c',1.2);const t=(w.fxTime*.55+i/11)%1;ellipse(c,xx+Math.sin(t*7+i)*5,z.y-7-t*39,2*(1-t)+.6,3*(1-t)+1,'#ffba64');}
    }else if(z.style==='venom'){
     for(let i=0;i<9;i++){const xx=z.x+Math.sin(i*14)*z.radius*.8,t=(w.fxTime*.7+i/9)%1;ellipse(c,xx,z.y-7-t*20,3.5*(1-t)+.5,3*(1-t)+.4,rgba(color,.5));}ellipse(c,z.x,z.y-5,z.radius*.7,7,'#e1ffb42b',true);
    }else if(z.style==='ice')for(let i=0;i<9;i++)shard(c,z.x-z.radius+i*z.radius/4,z.y-5,15+Math.sin(i*9)*8+8,color,i%2?.2:-.2);
    else if(z.style==='root'||z.style==='bone')for(let i=0;i<7;i++){const xx=z.x-z.radius+i*z.radius/3,hh=24+Math.sin(i*3)*12;line(c,[[xx+12,z.y],[xx,z.y-hh],[xx-8,z.y-hh-8]],color,5);}
    else if(z.style==='web'){
     for(let i=0;i<12;i++){const a=i/12*TAU;line(c,[[z.x,z.y-5],[z.x+Math.cos(a)*z.radius,z.y-5+Math.sin(a)*12]],rgba(color,.6),1);}for(let i=1;i<4;i++)ellipse(c,z.x,z.y-5,z.radius*i/4,12*i/4,rgba(color,.5),true,1);
    }else if(z.style==='lightning')lightning(c,z.x,z.y-215,z.x,z.y,w.fxTime,color,3);
    else if(z.style==='star'){for(let i=0;i<3;i++)ellipse(c,z.x,z.y-15-i*17,z.radius*(.7+.1*Math.sin(w.fxTime*2+i)),15,color,true,1);}
   }c.restore();
  }
 }
 projectile(w,s){
  if(this.bossEffects.projectile(w,s))return true;
  if(!s.enemySource)return false;const c=this.c,color=COLORS[s.enemyStyle]||COLORS.star;c.save();
  const points=[...(s.trail||[]).slice(-8).map(p=>[p.x,p.y]),[s.x,s.y]];
  line(c,points,rgba(color,.18),12);line(c,points,rgba(color,.8),3);glow(c,s.x,s.y,23,color,.35);
  const angle=Math.atan2(s.vy,s.vx);
  if(s.enemyStyle==='venom'){c.translate(s.x,s.y);c.rotate(angle);ellipse(c,0,0,12,7,color);ellipse(c,3,-2,5,2,'#f4ffd6');for(let i=0;i<3;i++)ellipse(c,-17-i*8,Math.sin(w.fxTime*12+i)*5,3,2,rgba(color,.7));}
  else if(s.enemyStyle==='ice')shard(c,s.x,s.y,19,color,angle+Math.PI/2);
  else if(s.enemyStyle==='lightning')lightning(c,s.x-Math.cos(angle)*42,s.y-Math.sin(angle)*42,s.x+Math.cos(angle)*12,s.y+Math.sin(angle)*12,w.fxTime,color,2);
  else if(s.enemyStyle==='sonic'){c.translate(s.x,s.y);c.rotate(angle);for(let i=0;i<3;i++)ellipse(c,-i*12,0,4+i*2,12+i*4,rgba(color,.8-i*.2),true,2);}
  else if(s.enemyStyle==='stone'||s.enemyStyle==='rock'){for(let i=0;i<4;i++)shard(c,s.x+Math.cos(i*1.7+w.fxTime*4)*9,s.y+Math.sin(i*1.7+w.fxTime*4)*9,8,color,w.fxTime+i);}
  else if(s.enemyStyle==='bone'){ellipse(c,s.x,s.y,11,12,'#e3dcc6');ellipse(c,s.x-4,s.y-2,2.5,3,'#786994');ellipse(c,s.x+4,s.y-2,2.5,3,'#786994');line(c,[[s.x-5,s.y+8],[s.x+5,s.y+8]],'#5f516f',2);}
  else if(s.enemyStyle==='chain'){for(let i=0;i<points.length;i+=2)ellipse(c,points[i][0],points[i][1],5,3,color,true,1.5);line(c,[[s.x-12,s.y-10],[s.x+8,s.y],[s.x-5,s.y+13]],color,3);}
  else{shard(c,s.x,s.y,15,color,angle+Math.PI/2);ellipse(c,s.x,s.y,11,11,color,true,1);}
  c.restore();return true;
 }
 effect(w,e){
  if(e.kind==='enemyVfx'&&e.ground&&e.style==='lava'&&!ENEMIES[e.enemyKind]?.boss&&drawEnemyLava(this.c,this.assets.campaignPainter?.art,e.x,e.y,e.radius||65,e.age,{impact:true}))return true;
  if(this.bossEffects.effect(w,e))return true;
  if(e.kind!=='enemyVfx')return false;const c=this.c,p=clamp(e.age/e.duration,0,1),color=COLORS[e.style]||COLORS.star,r=(e.radius||50),fade=Math.pow(1-p,1.3);c.save();c.globalAlpha*=fade;
  glow(c,e.x,e.y,r*.9,color,.3);if(e.melee){c.translate(e.x,e.y);c.scale(e.face||1,1);c.strokeStyle=color;c.lineWidth=8*(1-p)+1;c.beginPath();c.ellipse(-r*.25,0,r*.7,r*.42,-.25,-1.5+p*.8,1.2+p*.8);c.stroke();c.lineWidth=2;c.strokeStyle='#fff5de';c.stroke();}
  else if(e.style==='eggHatch'){
   for(let i=0;i<9;i++){const a=i/9*TAU;shard(c,e.x+Math.cos(a)*p*55,e.y-25-Math.sin(a)*p*40+p*p*35,7,color,a+p*3);}
  }else if(e.style==='lightning')for(let i=0;i<5;i++){const a=i/5*TAU;lightning(c,e.x,e.y,e.x+Math.cos(a)*r*(.3+p),e.y+Math.sin(a)*r*(.3+p),w.fxTime+i,color,2);}
  else if(e.style==='ice'||e.style==='stone'||e.style==='rock')for(let i=0;i<9;i++){const a=i/9*TAU;shard(c,e.x+Math.cos(a)*r*p,e.y+Math.sin(a)*r*p,5+8*(1-p),color,a);}
  else if(e.style==='web'){for(let i=0;i<8;i++){const a=i/8*TAU;line(c,[[e.x,e.y],[e.x+Math.cos(a)*r*(.3+p),e.y+Math.sin(a)*r*(.3+p)*.4]],color,1.5);}}
  else for(let i=0;i<12;i++){const a=i/12*TAU,xx=e.x+Math.cos(a)*r*p,yy=e.y+Math.sin(a)*r*p*.6-(e.style==='heal'?p*40:0);ellipse(c,xx,yy,(1-p)*4+.5,(1-p)*6+.5,color);}
  if(!e.melee)ellipse(c,e.x,e.y,r*(.2+p),r*(.1+p*.35),rgba(color,.7),true,2);c.restore();return true;
 }
 player(w){
  const p=w.player,c=this.c;if(p.hp<=0)return;
  for(const [kind,s]of Object.entries(p.enemyStatus||{}))if(s.until>w.time){const color=kind==='burn'?COLORS.lava:COLORS.venom;for(let i=0;i<5;i++){const t=(w.fxTime*.9+i/5)%1;ellipse(c,p.x+Math.sin(i*2.3)*18,p.y-10-t*70,2+2*(1-t),5*(1-t)+1,rgba(color,.75));}}
  const ctrl=p.enemyControl;if(ctrl?.until>w.time){c.save();if(ctrl.kind==='freeze'){glow(c,p.x,p.y-48,65,COLORS.ice,.18);for(let i=0;i<6;i++)shard(c,p.x-27+i*10,p.y-7,45+Math.sin(i*4)*14,COLORS.ice+'aa',(i-2.5)*.04);}
   else{for(let i=0;i<7;i++){const y=p.y-12-i*12;ellipse(c,p.x,y,23+Math.sin(i)*3,6,'#b2bbae88');}line(c,[[p.x-15,p.y-85],[p.x+2,p.y-61],[p.x-8,p.y-35]],'#e7e4d1',2);}
   c.textAlign='center';c.font='bold 14px sans-serif';c.strokeStyle='#07101d';c.lineWidth=3;const text=(ctrl.kind==='freeze'?'冰冻 ':'石化 ')+Math.max(0,ctrl.until-w.time).toFixed(1)+'s';c.strokeText(text,p.x,p.y-125);c.fillStyle=ctrl.kind==='freeze'?'#d0f5ff':'#e6e6d8';c.fillText(text,p.x,p.y-125);c.restore();}
 }
}
