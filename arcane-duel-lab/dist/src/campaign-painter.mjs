import {drawPets} from './campaign-pet-painter.mjs';
import {drawFxFrame} from './boss-fx-painter.mjs';
import {drawSurface,drawSoloEffects} from './campaign-growth-painter.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),TAU=Math.PI*2;
function ellipse(c,x,y,rx,ry,color,line=0){c.beginPath();c.ellipse(x,y,Math.max(1,rx),Math.max(1,ry),0,0,TAU);c.fillStyle=color;c.strokeStyle=color;line?(c.lineWidth=line,c.stroke()):c.fill();}
function atlas(c,art,key,frame,x,y,size,grounded=true){const m=art.fxMeta?.[key],img=art[m?.file];if(!img||!m)return false;const f=m.frames[frame],r=f.rect,s=f.spriteRect,cx=f.centerX/r[2],foot=grounded?f.bottomNormalized:.5;c.drawImage(img,...s,x-size*cx+(s[0]-r[0])/r[2]*size,y-size*foot+(s[1]-r[1])/r[3]*size,s[2]/r[2]*size,s[3]/r[3]*size);return true;}
export async function loadCampaignArt(stage,progress=()=>{},hero='fire'){const art={};let count=0;const total=19;await Promise.all(['campaign/scene-meta-v1.json','campaign/fx-meta-v1.json','boss-fx/bounds-v2.json','campaign-growth/growth-ui-bounds-v1.json','campaign-growth/growth-hero-bounds-v1.json'].map(async(name,i)=>{const r=await fetch('assets/'+name);if(!r.ok)throw Error('素材信息加载失败：'+name);art[['meta','fxMeta','newMeta','growthMeta','heroMeta'][i]]=await r.json();progress(++count,total);}));const response=await fetch('assets/pets/pets-meta-v1.json');if(!response.ok)throw Error('灵宠素材信息加载失败');art.petMeta=await response.json();progress(++count,total);const sources=[['petImage','pets/'+art.petMeta.file],['mirrorImage','pets/'+art.petMeta.mirror.file],[stage.art,'campaign/'+stage.art],['ice-v1.png','campaign/ice-v1.png'],['fire-v2.png','campaign/fire-v2.png'],['portalImage','boss-fx/'+art.newMeta.portal.file],['platformImage','boss-fx/'+art.newMeta.platforms.file],['groundImage','campaign-growth/'+art.growthMeta.ground.file],['variedPlatformImage','campaign-growth/'+art.growthMeta.platforms.file],['heroFx','campaign-growth/'+art.heroMeta.units[hero].file],['itemImage','campaign-growth/'+art.growthMeta.items.file],['equipmentImage','campaign-growth/'+art.growthMeta.equipment.file],['armorImage','campaign-growth/'+art.growthMeta.armors.file]];await Promise.all(sources.map(([key,path])=>new Promise((yes,no)=>{const img=new Image();img.onload=()=>{art[key]=img;progress(++count,total);yes();};img.onerror=()=>no(Error('素材加载失败：'+path));img.src='assets/'+path;})));return art;}
export class CampaignPainter{
 constructor(art){this.art=art;this.backgroundCache={};if(typeof document!=='undefined'){for(const [name,img]of Object.entries(art)){if(!name.startsWith('stage')||!img?.width)continue;const layer=document.createElement('canvas');layer.width=img.width;layer.height=img.height;const c=layer.getContext('2d');c.filter='saturate(.73) contrast(.82) brightness(.92)';c.drawImage(img,0,0);this.backgroundCache[name]=layer;}}}
 background(c,w,view){
  const stage=w.campaign.stage,img=this.backgroundCache[stage.art]||this.art[stage.art],groundY=this.art.meta?.[stage.art.replace('-v1.png','')]?.groundY??.713,bh=w.floor/groundY,tile=img?bh*img.width/img.height:1600;
  c.fillStyle='#101923';c.fillRect(view.x,0,view.width,w.height);
  // Full illustrations remain intact, with slow parallax. Mirrored repeats hide hard seams.
  c.save();c.globalAlpha=.9;const offset=view.x*.72;
  for(let i=Math.floor((view.x-offset)/tile)-1;i<=Math.ceil((view.x+view.width-offset)/tile);i++){const x=i*tile+offset;if(img){c.save();c.translate(x+(i%2?tile:0),0);if(i%2)c.scale(-1,1);c.drawImage(img,0,0,tile,bh);c.restore();}}
  c.restore();const shade=c.createLinearGradient(0,0,0,w.height);shade.addColorStop(0,'#06101b10');shade.addColorStop(.65,'#07111b08');shade.addColorStop(1,'#06101ba0');c.fillStyle=shade;c.fillRect(view.x,0,view.width,w.height);
  // Atmospheric particles stay subtle; the hero and attack telegraphs are brightest.
  c.save();c.fillStyle=stage.color;c.globalAlpha=.23;for(let i=0;i<26;i++){const x=view.x+((i*149-w.fxTime*(stage.theme==='ice'?20:7))%view.width+view.width)%view.width,y=(i*67+w.fxTime*(stage.theme==='ice'?27:-9))%w.height;c.beginPath();c.arc(x,y,i%3?1:2,0,TAU);c.fill();}c.restore();
 }
 ground(c,w,view){
  const s=w.campaign.stage,color=s.color;
  if(this.art.groundImage){c.save();c.beginPath();c.rect(view.x-20,w.floor-12,view.width+40,w.height-w.floor+24);c.clip();for(let i=Math.floor(view.x/360)-1;i<=Math.ceil((view.x+view.width)/360);i++)drawSurface(c,this.art.groundImage,this.art.growthMeta?.ground,s.id-1,{x:i*360,y:w.floor,w:368},{flip:Math.abs(i)%3===1});c.restore();}
  for(const p of w.platforms){if(p.id==='ground'||p.type==='root'||!p.active||p.x>view.x+view.width||p.x+p.w<view.x)continue;const x=Math.max(p.x,view.x-50),right=Math.min(p.x+p.w,view.x+view.width+50),depth=24;
   const varied=p.shape&&this.art.variedPlatformImage,m=varied?this.art.growthMeta.platforms:this.art.newMeta?.platforms,img=varied?this.art.variedPlatformImage:this.art.platformImage;if(drawSurface(c,img,m,s.id-1,p,{flip:p.shape===2}))continue;
   const grad=c.createLinearGradient(0,p.y,0,p.y+depth);grad.addColorStop(0,s.theme==='ice'?'#7a9eac':s.theme==='lava'?'#5c4540':'#4b5250');grad.addColorStop(.08,'#303a40');grad.addColorStop(1,'#101c25');c.fillStyle=grad;c.fillRect(x,p.y,right-x,depth);
   c.fillStyle=color;c.globalAlpha=.65;c.fillRect(x,p.y,right-x,s.theme==='ice'?4:2);c.globalAlpha=1;
   c.save();c.beginPath();c.rect(x,p.y,right-x,depth);c.clip();for(let a=Math.floor(x/90)*90;a<right;a+=90){c.strokeStyle='#09141b80';c.lineWidth=2;c.beginPath();c.moveTo(a,p.y+5);c.lineTo(a+9,p.y+depth);c.moveTo(a,p.y+20);c.lineTo(a+90,p.y+20);c.stroke();}c.restore();
  }
  if(w.campaign.lock){c.save();for(const x of [w.campaign.lock.x+14,w.campaign.lock.x+w.campaign.lock.width-14]){const g=c.createLinearGradient(x-12,0,x+12,0);g.addColorStop(0,'#d5b77a00');g.addColorStop(.5,'#d5b77a50');g.addColorStop(1,'#d5b77a00');c.fillStyle=g;c.fillRect(x-12,60,24,w.floor-60);for(let i=0;i<7;i++)ellipse(c,x,105+i*69,3,8,'#e5d3a1a0');}c.restore();}
 }
 effects(c,w,alpha=1){drawPets(c,w,this.art,alpha);drawSoloEffects(c,w,this.art);const cc=w.campaign;for(const h of cc.hazards){const age=w.time-h.born,color=h.kind==='lava'?'#ffac65':h.kind==='ice'?'#b8eafa':cc.stage.color;
   if(age<h.delay){const p=age/h.delay;ellipse(c,h.x,h.y-2,h.radius,9,'#0c152b90');c.save();c.setLineDash([6,4]);ellipse(c,h.x,h.y-2,h.radius,9,color,1.5);c.restore();ellipse(c,h.x,h.y-2,h.radius*p,7,color+'75');c.fillStyle=color;c.font='bold 18px serif';c.textAlign='center';c.fillText('!',h.x,h.y-26);continue;}
   const falling=age<h.delay+h.fall,kind=h.kind==='lava'?'fire':h.kind==='ice'?'ice':null;
   if(falling){const t=clamp((age-h.delay)/h.fall,0,1),y=h.y-300*(1-t);if(kind)atlas(c,this.art,kind,kind==='ice'?4+Math.min(3,Math.floor(t*4)):Math.min(3,Math.floor(t*4)),h.x,y,kind==='fire'?160:130,false);
    else{c.save();c.translate(h.x,y);c.rotate(.25);c.fillStyle=color;c.beginPath();c.moveTo(0,-45);c.lineTo(16,0);c.lineTo(0,27);c.lineTo(-17,0);c.fill();c.restore();}continue;}
   const impactAge=age-h.delay-h.fall;
   if(kind==='fire'){const f=impactAge<.4?4+Math.min(3,Math.floor(impactAge*10)):8+Math.floor(impactAge*10)%8;atlas(c,this.art,'fire',f,h.x,h.y+2,impactAge<.4?190:h.radius*2.4);}
   else if(kind==='ice')atlas(c,this.art,'ice',8+Math.min(7,Math.floor(impactAge*14)),h.x,h.y+1,155);
   else{ellipse(c,h.x,h.y-3,h.radius*(1+impactAge*.1),11,color+'45');ellipse(c,h.x,h.y-5,h.radius,10,color,1);}
  }
  const p=cc.portal;if(p){const age=w.time-p.born;c.save();c.globalAlpha=clamp(age*2,0,1);if(this.art.portalImage&&this.art.newMeta?.portal){drawFxFrame(c,this.art.portalImage,this.art.newMeta.portal,5,p.x,p.y,260,{ground:true});c.save();c.translate(p.x,p.y-132);c.rotate(age*.17);ellipse(c,0,0,38,38,'#bdfaf019',1);c.restore();}else atlas(c,this.art,'portal',5,p.x,p.y,260);c.fillStyle='#fff0c4';c.font='14px "Microsoft YaHei"';c.textAlign='center';c.fillText(Math.abs(w.player.x-p.x)<65&&w.player.y>w.floor-80?'按 X 结算 · C 拾取战利品':'靠近传送门 · 按 X 结算',p.x,p.y-270);c.restore();}
 }
}


