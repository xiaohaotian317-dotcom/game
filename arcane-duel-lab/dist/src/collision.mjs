// Continuous collision: even a projectile crossing a thin wall in one frame stops.
export function segmentBox(x0,y0,x1,y1,b,r=0){
  let enter=0,exit=1;
  for(const [p,d,min,max] of [[x0,x1-x0,b.x-r,b.x+b.w+r],[y0,y1-y0,b.y-r,b.y+b.h+r]]){
    if(Math.abs(d)<1e-9){if(p<min||p>max)return null;continue;}
    const a=(min-p)/d,z=(max-p)/d;enter=Math.max(enter,Math.min(a,z));exit=Math.min(exit,Math.max(a,z));
    if(enter>exit)return null;
  }
  return enter>=0&&enter<=1?enter:null;
}
export function terrain(w){
  return [...w.platforms.filter(b=>b.active&&b.x>=0).map(b=>({x:b.x,y:b.y,w:b.w,h:b.id==='ground'?180:b.type==='wood'?15:(b.renderDepth||18),source:b})),...(w.obstacles||[]).filter(b=>b.active!==false)];
}
export function firstTerrainHit(w,x0,y0,x1,y1,r=0){
  let best=null;
  for(const b of terrain(w)){
    const t=segmentBox(x0,y0,x1,y1,b,r);
    if(t!==null&&(!best||t<best.t))best={t,x:x0+(x1-x0)*t,y:y0+(y1-y0)*t,box:b};
  }
  return best;
}
export function clearLine(w,x0,y0,x1,y1){const h=firstTerrainHit(w,x0,y0,x1,y1);return !h||h.t>.995;}
export function resolveSolidSides(w,a,previousX,previousY){
  for(const b of w.obstacles||[]){
    if(b.actor===false||b.active===false)continue;
    if(a.x+a.w<=b.x||a.x-a.w>=b.x+b.w||a.y<=b.y||a.y-a.h>=b.y+b.h)continue;
    if(previousY<=b.y+2&&a.vy>=0){a.y=b.y;a.vy=0;a.grounded=true;a.platformId=b.id;}
    else if(previousX+a.w<=b.x+1){a.x=b.x-a.w;a.vx=0;}
    else if(previousX-a.w>=b.x+b.w-1){a.x=b.x+b.w+a.w;a.vx=0;}
    else if(previousY-a.h>=b.y+b.h-2&&a.vy<0){a.y=b.y+b.h+a.h;a.vy=0;}
    else {a.x=Math.abs(a.x-b.x)<Math.abs(a.x-(b.x+b.w))?b.x-a.w:b.x+b.w+a.w;a.vx=0;}
  }
}
