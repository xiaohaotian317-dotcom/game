import {corePoint,RIGS,headSkinRegion} from './character-rig.mjs?v=20261030-duel12';
// A small continuous mesh animates the original paint at runtime. No cut head,
// duplicate neck, rewritten PNG, or separate floating hair layer is introduced.
const grid=new Map();
function triangles(hero,cols=6,rows=8){
 const key=hero+':'+cols+':'+rows;if(grid.has(key))return grid.get(key);
 const columns=[0,.12,.24,.4,.6,.8,1],heights=[...new Set([...Array.from({length:rows+1},(_,i)=>i/rows*.72),...headSkinRegion(hero).range])].sort((a,b)=>a-b),points=[];let faces=[];for(const y of heights)for(let x=0;x<=cols;x++)points.push([columns[x],y]);
 for(let y=0;y<heights.length-1;y++)for(let x=0;x<cols;x++){const i=y*(cols+1)+x;faces.push([i,i+1,i+cols+2],[i,i+cols+2,i+cols+1]);}
 const area=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 // Pin actual rendered shoulder vertices, not just the analytic warp function.
 // Inserting a point on an edge also splits its neighbour, preserving continuity.
 for(const uv of [RIGS[hero].nearShoulder,RIGS[hero].farShoulder]){
  if(points.some(p=>Math.hypot(p[0]-uv[0],p[1]-uv[1])<1e-9))continue;
  const index=points.push(uv)-1;
  faces=faces.flatMap(face=>{const [a,b,c]=face.map(i=>points[i]),total=area(a,b,c),weights=[area(uv,b,c)/total,area(a,uv,c)/total,area(a,b,uv)/total];
   if(weights.some(w=>w< -1e-9))return [face];
   return [[face[0],face[1],index],[face[1],face[2],index],[face[2],face[0],index]].filter(f=>area(...f.map(i=>points[i]))>1e-10);
  });
 }
 const mesh={points,faces};grid.set(key,mesh);return mesh;
}
export function skinMesh(hero,pose,bounds){
 const mesh=triangles(hero);return {uv:mesh.points,faces:mesh.faces,points:mesh.points.map(uv=>corePoint(hero,pose,uv,bounds))};
}
const ghosts=new Map();
export function drawCoreSkin(c,img,bounds,hero,pose,frame,cacheGhost=false){
 if(cacheGhost&&typeof OffscreenCanvas!=='undefined'){
  const key=hero+':'+(pose.head||0)+':'+(pose.hair||0);let item=ghosts.get(key);
  if(!item){const r=RIGS[hero],w=bounds.w/bounds.h*98+12,h=110,x=-r.hip[0]*(w-12)-6,y=-r.hip[1]*98-6,canvas=new OffscreenCanvas(Math.ceil(w*4),h*4),ctx=canvas.getContext('2d');
   ctx.scale(4,4);ctx.translate(-x,-y);drawCoreSkin(ctx,img,bounds,hero,{...pose,lean:0},{...frame,origin:{x:0,y:0}},false);item={canvas,x,y,w,h};
  }else ghosts.delete(key);
  ghosts.set(key,item);while(ghosts.size>16)ghosts.delete(ghosts.keys().next().value);
  c.save();c.translate(frame.origin.x,frame.origin.y);c.rotate(pose.lean);c.drawImage(item.canvas,item.x,item.y,item.w,item.h);c.restore();return;
 }
 const mesh=skinMesh(hero,pose,bounds),{w,h}=bounds;
 c.save();c.translate(frame.origin.x,frame.origin.y);c.rotate(pose.lean);
 // The lower torso is rigid paint: one draw instead of dozens of redundant faces.
 const r=RIGS[hero],s=98/h;c.drawImage(img,bounds.x,bounds.y+h*.72,w,h*.28,-r.hip[0]*w*s,(.72-r.hip[1])*98,w*s,98*.28);
 // Face/crown are one rigid draw: preserve the painted features, with no internal
 // triangle edges or neck weighting passing through cheeks, eyes or chin.
 const {neck,range}=headSkinRegion(hero),px=(neck[0]-r.hip[0])*w*s,py=(neck[1]-r.hip[1])*98;
 c.save();c.translate(px,py);c.rotate(pose.head||0);c.translate(-px,-py);
 c.drawImage(img,bounds.x+w*.24,bounds.y,w*.76,h*range[0],(.24-r.hip[0])*w*s,-r.hip[1]*98,w*s*.76,98*range[0]);c.restore();
 for(const face of mesh.faces){
  if(face.every(i=>mesh.uv[i][0]>=.24-1e-9&&mesh.uv[i][1]<=range[0]+1e-9))continue;
  const src=face.map(i=>({x:mesh.uv[i][0]*w,y:mesh.uv[i][1]*h})),dst=face.map(i=>mesh.points[i]);
  const [s0,s1,s2]=src,[d0,d1,d2]=dst,ax=s1.x-s0.x,ay=s1.y-s0.y,bx=s2.x-s0.x,by=s2.y-s0.y,det=ax*by-ay*bx;
  const a=((d1.x-d0.x)*by-(d2.x-d0.x)*ay)/det,b=((d1.y-d0.y)*by-(d2.y-d0.y)*ay)/det;
  const cc=((d2.x-d0.x)*ax-(d1.x-d0.x)*bx)/det,d=((d2.y-d0.y)*ax-(d1.y-d0.y)*bx)/det;
  // Subpixel overlap suppresses antialias cracks between neighbouring faces.
  const centre={x:(d0.x+d1.x+d2.x)/3,y:(d0.y+d1.y+d2.y)/3};
  c.save();c.beginPath();dst.forEach((p,i)=>{const dx=p.x-centre.x,dy=p.y-centre.y,l=Math.hypot(dx,dy)||1,x=p.x+dx/l*.10,y=p.y+dy/l*.10;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.clip();
  c.transform(a,b,cc,d,d0.x-a*s0.x-cc*s0.y,d0.y-b*s0.x-d*s0.y);
  c.drawImage(img,bounds.x,bounds.y,w,h,0,0,w,h);c.restore();
 }c.restore();
}
