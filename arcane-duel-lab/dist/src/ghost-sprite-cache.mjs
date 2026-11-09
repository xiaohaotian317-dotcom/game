// Flatten each captured pose once. Live mesh/limb draws must not each invoke a
// GPU filter: seven afterimages otherwise create hundreds of filtered layers.
export class GhostSpriteCache {
 constructor(limit=24,createCanvas=(w,h)=>typeof OffscreenCanvas==='undefined'?null:new OffscreenCanvas(w,h)){
  this.limit=limit;this.createCanvas=createCanvas;this.items=new Map();this.scratch=null;
 }
 get(world,ghost,paint){
  // Snapshot projection clones ghosts, so object identity is not a stable key.
  // Age is intentionally excluded: the captured silhouette fades, not re-rigs.
  const key=JSON.stringify([world.hero,world.characterScale||1,ghost.x,ghost.y,ghost.face,ghost.cycle,ghost.grounded,ghost.pose,world.player.cast?.key]);
  let item=this.items.get(key);
  if(item){this.items.delete(key);this.items.set(key,item);return item;}
  const scale=world.characterScale||1,w=320*scale,h=320*scale,x=-160*scale,y=-260*scale,resolution=2;
  const canvas=this.createCanvas(Math.ceil(w*resolution),Math.ceil(h*resolution));if(!canvas)return null;
  this.scratch??=this.createCanvas(640,640);const source=this.scratch;
  if(source.width!==canvas.width)source.width=canvas.width;if(source.height!==canvas.height)source.height=canvas.height;
  const ctx=source.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,source.width,source.height);ctx.save();ctx.scale(resolution,resolution);ctx.translate(-x,-y);paint(ctx);ctx.restore();
  const tint=canvas.getContext('2d');tint.filter=world.hero==='shadow'?'brightness(1.7) sepia(.8) hue-rotate(215deg) saturate(2.1)':'brightness(1.5) saturate(.8)';tint.shadowColor=world.hero==='shadow'?'#c9a6ff':'#fff0ba';tint.shadowBlur=4*resolution;tint.drawImage(source,0,0);tint.filter='none';
  item={canvas,x,y,w,h};this.items.set(key,item);while(this.items.size>this.limit)this.items.delete(this.items.keys().next().value);return item;
 }
}
