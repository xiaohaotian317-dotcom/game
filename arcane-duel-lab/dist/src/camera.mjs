const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function cameraView(w){return {x:w.camera?.x||0,width:w.camera?.overview?(w.width||1440):1440};}
export function updateCamera(w,dt){
  w.camera||={x:0,overview:false};
  if(w.camera.overview){w.camera.x=0;return;}
  const look=w.player.face*95,target=clamp(w.player.x+look-720,0,Math.max(0,(w.width||1440)-1440));
  w.camera.x+=(target-w.camera.x)*(1-Math.exp(-5*dt));
}
export function worldPoint(w,u,v){const view=cameraView(w);return{x:clamp(view.x+u*view.width,0,w.width||1440),y:clamp(v*(w.height||800),0,w.height||800)};}
