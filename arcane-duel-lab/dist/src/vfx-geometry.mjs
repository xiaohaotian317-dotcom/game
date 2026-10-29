export const fract=v=>v-Math.floor(v);
export const noise=n=>fract(Math.sin(n*127.1+311.7)*43758.5453);
export function lightningPath(x0,y0,x1,y1,clock=0,seed=0){
  const dx=x1-x0,dy=y1-y0,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length,frame=Math.floor(clock*28),points=[];
  for(let i=0;i<=14;i++){const f=i/14,j=(noise(i*3+frame*17+seed)-.5)*Math.min(25,length*.17)*Math.sin(Math.PI*f);points.push([x0+dx*f+nx*j,y0+dy*f+ny*j]);}return points;
}
export function shadowSlashShape(phase=0){const t=Math.max(0,Math.min(1,phase));return {angle:-.36+t*.60,center:42,width:150+t*20,height:112,tip:{x:109,y:-5},arcs:[[[8,32],[106,49],[113,-20]],[[0,22],[92,36],[101,-27]]]};}
