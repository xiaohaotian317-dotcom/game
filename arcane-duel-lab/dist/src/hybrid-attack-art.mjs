// Native paint, uniform scale and measured phase pivots; material motion stays deterministic.
export function drawHybridFrame(c,assets,hero,phase,x,y,{angle=0,width=165,alpha=1}={}){
 const meta=assets.hybridMeta,im=assets.hybridAttacks;if(!meta||!im)return false;
 const index=(hero==='shadow'?4:0)+phase,f=meta.frames[index];if(!f)return false;
 const scale=width/f.rect[2];c.save();c.globalAlpha*=Math.max(0,Math.min(1,alpha));c.translate(x,y);c.rotate(angle);
 if(hero==='lightning')c.globalCompositeOperation='lighter';
 c.drawImage(im,...f.rect,-f.pivot[0]*scale,-f.pivot[1]*scale,f.rect[2]*scale,f.rect[3]*scale);c.restore();return true;
}
export function drawHybridProjectile(c,assets,w,s){
 if(!s.hybridBasic)return false;const hero=s.kind==='shadowCrescent'?'shadow':'lightning',a=Math.atan2(s.vy,s.vx),trail=s.trail||[];
 for(let i=2;i<trail.length;i+=3){const p=trail[i];drawHybridFrame(c,assets,hero,1+Math.floor(s.age/.075)%2,p.x,p.y,{angle:a,width:hero==='shadow'?150:162,alpha:(i/trail.length)*.1});}
 drawHybridFrame(c,assets,hero,1+Math.floor(s.age/.075)%2,s.x,s.y,{angle:a,width:hero==='shadow'?160:174});return true;
}
export function drawHybridEffect(c,assets,e){
 if(!['hybridLaunch','hybridImpact'].includes(e.kind))return false;
 const t=Math.max(0,Math.min(1,e.age/e.duration)),impact=e.kind==='hybridImpact';
 drawHybridFrame(c,assets,e.hero,impact?3:0,e.x,e.y,{angle:e.angle||0,width:(impact?196:120)*(impact?.75+.25*Math.sin(t*Math.PI*.5):.7+.3*t),alpha:Math.min(1,e.age/.018)*Math.pow(1-t,.65)});return true;
}
