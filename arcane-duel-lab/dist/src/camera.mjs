const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cameraView(w){return {x:w.camera?.x||0,y:w.camera?.y||0,width:w.camera?.overview?(w.width||1440):(w.camera?.viewWidth||1440),height:w.camera?.viewHeight||w.height||800};}
export function fitDuelCamera(w,width,height){
  const aspect=Math.max(.1,width/Math.max(1,height)),worldHeight=w.height||680;
  w.camera||={x:0,overview:false};w.camera.overview=false;
  w.camera.viewWidth=Math.min(1280,worldHeight*aspect,w.width||2304);
  w.camera.viewHeight=w.camera.viewWidth/aspect;
}
export function updateCamera(w,dt){
  w.camera||={x:0,overview:false};
  if(w.camera.overview){w.camera.x=0;w.camera.y=0;return;}
  const view=cameraView(w),look=w.player.face*(w.duel?view.width*.08:95),target=clamp(w.player.x+look-view.width/2,0,Math.max(0,(w.width||1440)-view.width));
  const targetY=clamp(w.player.y-view.height*.76,0,Math.max(0,(w.height||800)-view.height));
  if(w.duel&&!w.camera.initialized){w.camera.x=target;w.camera.y=targetY;w.camera.initialized=true;}
  const ease=1-Math.exp(-(w.duel?8:5)*dt);w.camera.x+=(target-w.camera.x)*ease;
  w.camera.y=w.duel?(w.camera.y||0)+(targetY-(w.camera.y||0))*ease:0;
}
export function worldPoint(w,u,v){const view=cameraView(w);return{x:clamp(view.x+u*view.width,0,w.width||1440),y:clamp(view.y+v*view.height,0,w.height||800)};}
export function opponentEdge(view,actor,width,height){
  if(!actor||actor.hp<=0||width<=0||height<=0)return null;
  const px=(actor.x-view.x)/view.width*width,py=(actor.y-58-view.y)/view.height*height;
  if(px>=0&&px<=width&&py>=0&&py<=height)return null;
  const cx=width/2,cy=height/2,dx=px-cx,dy=py-cy;
  const left=48,right=width-48,top=Math.min(118,height*.25),bottom=height-Math.min(120,height*.25);
  const tx=Math.abs(dx)<.001?Infinity:(dx>0?right-cx:cx-left)/Math.abs(dx);
  const ty=Math.abs(dy)<.001?Infinity:(dy>0?bottom-cy:cy-top)/Math.abs(dy),t=Math.max(0,Math.min(tx,ty));
  return {x:clamp(cx+dx*t,left,right),y:clamp(cy+dy*t,top,bottom),angle:Math.atan2(dy,dx)*180/Math.PI};
}
