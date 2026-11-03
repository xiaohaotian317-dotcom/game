// Macro regions give travel clusters and combat clearings different silhouettes.
export const PLATFORM_REGIONS={combat:[[800,2300],[3300,4800],[5900,7400],[8900,10400]],travel:[[380,800],[2380,3230],[4880,5830],[7480,8830],[10480,11000]]};
export function campaignPlatforms(seed,width=11200,floor=760){
 let state=seed>>>0;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},out=[],sx=width/11200;
 const add=(x,height,w,region,zone,role='main',parent='ground')=>{const p={id:'campaign-upper-'+out.length,x:Math.round(x*sx),y:floor-Math.round(height),w:Math.round(w*sx),shape:Math.floor(random()*3),type:'campaign-upper',region,zone,role,accessFrom:parent,active:true,hp:Infinity,maxHp:Infinity};out.push(p);return p;};
 for(const [zone,[start,end]]of PLATFORM_REGIONS.combat.entries()){
  const leftW=340+random()*120,rightW=350+random()*135;
  add(start+35+random()*65,145+random()*50,leftW,'combat',zone);
  add(end-rightW-35-random()*70,140+random()*55,rightW,'combat',zone);
 }
 for(const [zone,[start,end]]of PLATFORM_REGIONS.travel.entries()){
  const span=end-start;
  const pattern=zone===0||zone===4?[[0,.42,100],[.51,.44,185]]:zone===1?[[0,.27,115],[.23,.34,225],[.54,.4,350]]:zone===2?[[0,.24,120],[.21,.31,235],[.49,.32,365],[.81,.18,180]]:[[0,.18,105],[.155,.23,225],[.365,.285,375],[.66,.205,295],[.865,.13,160]];
  let previous=null;
  for(const [index,[pos,ratio,height]]of pattern.entries()){
   const x=start+span*pos+(random()-.5)*18,w=Math.max(180,span*ratio+(random()-.5)*25),h=height+(random()-.5)*18;
   previous=add(x,h,w,'travel',zone,index===0?'step':h>290?'high':'main',previous?.id||'ground');
  }
 }
 return out.sort((a,b)=>a.x-b.x);
}
