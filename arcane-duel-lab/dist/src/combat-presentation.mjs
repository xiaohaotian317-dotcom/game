const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const number=(value,fallback=0)=>Number.isFinite(value)?value:fallback;
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
const point=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<1e7&&Math.abs(y)<1e7;
const COLORS={fire:'#f2b26a',nature:'#b8d990',frost:'#a8deef',lightning:'#f0d493',shadow:'#c3a6da',star:'#b8d7ed'};

/** World coordinates. Simulation already moves t.y upward; this adds only a
 * small opening lift, not a second constant-speed drift. Non-damage text falls
 * through to the renderer's existing healing/status text path. */
export function drawDamageText(ctx,t){
 if(!t?.damage)return false;
 if(!ctx||!point(t.x,t.y))return true;
 const age=Math.max(0,number(t.age)),duration=clamp(number(t.duration,1.1),.12,5);
 if(age>=duration)return true;
 const critical=!!t.critical,incoming=!!t.incoming,splash=!!t.splash;
 const size=critical?clamp(number(t.size,38),34,40):clamp(number(t.size,splash?24:27),24,28);
 const launch=smooth(age/.055),settle=smooth((age-.055)/.11);
 const scale=age<.055?.78+launch*(critical?.42:.34):1+(critical?.20:.12)*(1-settle);
 const alpha=smooth(age/.018)*(1-smooth((age-duration*.64)/(duration*.36)));
 const lane=clamp(Math.round(number(t.lane)),-3,3),lift=(critical?11:7)*(1-Math.exp(-age*10));
 const label=String(t.text??'');if(!label)return true;
 ctx.save();
 try{
  ctx.translate(t.x+lane*(splash?14:11),t.y-lift-Math.abs(lane)*3);ctx.scale(scale,scale);
  ctx.globalAlpha=alpha;ctx.globalCompositeOperation='source-over';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineJoin='round';ctx.miterLimit=2;ctx.shadowBlur=0;ctx.shadowColor='transparent';
  ctx.font=`900 ${size}px "Arial Black","Microsoft YaHei",sans-serif`;
  ctx.strokeStyle=critical?'#501b24':incoming?'#391b29':'#101a2b';ctx.lineWidth=critical?5:3.4;
  const width=critical?188:150;ctx.strokeText(label,0,0,width);
  if(critical){const gold=ctx.createLinearGradient(0,-size*.6,0,size*.6);gold.addColorStop(0,'#fff0b7');gold.addColorStop(.42,'#ffd475');gold.addColorStop(1,incoming?'#f18459':'#e8913d');ctx.fillStyle=gold;}
  else ctx.fillStyle=typeof t.color==='string'&&t.color?t.color:incoming?'#ffd0b7':'#f6e4b1';
  ctx.fillText(label,0,0,width);
  if(critical){ctx.font='800 12px "Microsoft YaHei",sans-serif';ctx.lineWidth=2.5;ctx.strokeStyle='#431621';ctx.fillStyle='#ffd48a';ctx.strokeText('暴击',0,-size*.68);ctx.fillText('暴击',0,-size*.68);}
 }finally{ctx.restore();}
 return true;
}

/** Call in world space after the fixed portal frame. Only the inner ellipse is
 * painted; the frame, its ground anchor and the exit caption remain untouched. */
export function drawPortalInterior(ctx,w,portal){
 if(!ctx||!portal||!point(portal.x,portal.y))return false;
 const clock=number(w?.fxTime,number(w?.time)),rx=44,ry=92;
 ctx.save();
 try{
  ctx.translate(portal.x,portal.y-132);ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,TAU);ctx.clip();
  ctx.globalCompositeOperation='source-over';ctx.shadowBlur=0;ctx.shadowColor='transparent';
  const depth=ctx.createRadialGradient(-8,-18,3,0,0,100);depth.addColorStop(0,'#1e70867a');depth.addColorStop(.55,'#17495e64');depth.addColorStop(1,'#061f3540');ctx.fillStyle=depth;ctx.fillRect(-rx,-ry,rx*2,ry*2);
  for(let i=0;i<4;i++){
   const x=Math.sin(clock*.13+i*2.2)*21,y=Math.cos(clock*.10+i*1.7)*63;
   const mist=ctx.createRadialGradient(x,y,1,x,y,49);mist.addColorStop(0,'#8ce8e425');mist.addColorStop(.48,'#508eb918');mist.addColorStop(1,'#68a9cf00');ctx.fillStyle=mist;ctx.fillRect(x-49,y-49,98,98);
  }
  ctx.lineCap='round';ctx.lineJoin='round';
  for(let band=0;band<2;band++){
   ctx.beginPath();for(let i=0;i<=24;i++){const y=-104+i*208/24,envelope=Math.sqrt(Math.max(0,1-(y/105)**2)),x=Math.sin(y*.026+clock*.22+band*Math.PI)*25*envelope+Math.sin(clock*.09+band)*4;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}
   ctx.strokeStyle=band?'#72adc51b':'#79dcd324';ctx.lineWidth=10;ctx.stroke();ctx.strokeStyle=band?'#a4dded44':'#c4f8e943';ctx.lineWidth=1.5;ctx.stroke();
  }
  for(let i=0;i<9;i++){
   const progress=((clock*.055+i/9)%1+1)%1,y=ry*(1-progress*2),edge=Math.sqrt(Math.max(0,1-(y/ry)**2)),x=Math.sin(i*2.399+clock*.10)*rx*.67*edge;
   const alpha=Math.sin(progress*Math.PI)*.38;ctx.fillStyle=`rgba(182,239,239,${alpha})`;ctx.beginPath();ctx.ellipse(x,y,.65+(i%3)*.22,1.3+(i%2)*.5,0,0,TAU);ctx.fill();
  }
  const sweepY=Math.sin(clock*.11)*ry,sweep=ctx.createLinearGradient(0,sweepY-23,0,sweepY+23);sweep.addColorStop(0,'#b2f6ef00');sweep.addColorStop(.5,'#b2f6ef15');sweep.addColorStop(1,'#b2f6ef00');ctx.fillStyle=sweep;ctx.fillRect(-rx,-ry,rx*2,ry*2);
 }finally{ctx.restore();}
 return true;
}

function cursorArt(ctx,w,assets){
 const art=assets?.heroCursors,frame=art?.frames?.[w.hero],image=art?.image,r=frame?.rect;
 if(!image||typeof image!=='object'||image.complete===false||('naturalWidth' in image&&image.naturalWidth===0)||!Array.isArray(r)||r.length<4||!r.every(Number.isFinite)||r[0]<0||r[1]<0||r[2]<=0||r[3]<=0)return false;
 const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
 if(!Number.isFinite(iw)||!Number.isFinite(ih)||iw<=0||ih<=0||r[0]+r[2]>iw||r[1]+r[3]>ih)return false;
 const pivot=frame.pivotLocal,px=Number.isFinite(pivot?.[0])?pivot[0]:r[2]/2,py=Number.isFinite(pivot?.[1])?pivot[1]:r[3]/2,scale=26/(Number.isFinite(frame.outerRadius)&&frame.outerRadius>0?2*frame.outerRadius:Math.max(r[2],r[3]));
 ctx.globalAlpha=frame.renderHint?.opacity??.65;
 if(!point(px,py))return false;
 ctx.drawImage(image,...r,-px*scale,-py*scale,r[2]*scale,r[3]*scale);return true;
}

/** Canvas-only reticle; neither the OS cursor nor the supplied atlas is edited. */
export function drawHeroAim(ctx,w,assets){
 if(!ctx||!point(w?.aim?.x,w?.aim?.y))return false;
 ctx.save();
 try{
  ctx.translate(w.aim.x,w.aim.y);ctx.globalAlpha*=.65;ctx.shadowBlur=0;ctx.shadowColor='transparent';ctx.globalCompositeOperation='source-over';
  if(cursorArt(ctx,w,assets))return true;
  const hero=Object.hasOwn(COLORS,w.hero)?w.hero:'fire';ctx.strokeStyle=COLORS[hero];ctx.fillStyle=COLORS[hero];ctx.lineWidth=1.1;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.arc(0,0,8.5,.22,Math.PI-.22);ctx.arc(0,0,8.5,Math.PI+.22,TAU-.22);ctx.stroke();
  ctx.beginPath();ctx.ellipse(0,0,1,1,0,0,TAU);ctx.fill();
  if(hero==='fire'){
   ctx.beginPath();ctx.moveTo(-2,-8);ctx.quadraticCurveTo(-3,-11,0,-13);ctx.quadraticCurveTo(3,-9,2,-8);ctx.stroke();
  }else if(hero==='nature'){
   for(const sign of [-1,1]){ctx.beginPath();ctx.moveTo(sign*6,sign*6);ctx.quadraticCurveTo(sign*12,sign*5,sign*10,sign*10);ctx.quadraticCurveTo(sign*5,sign*12,sign*6,sign*6);ctx.stroke();}
  }else if(hero==='frost'){
   for(let i=0;i<3;i++){const a=-Math.PI/2+i*TAU/3,x=Math.cos(a),y=Math.sin(a);ctx.beginPath();ctx.moveTo(x*8-y*2,y*8+x*2);ctx.lineTo(x*12,y*12);ctx.lineTo(x*8+y*2,y*8-x*2);ctx.stroke();}
  }else if(hero==='lightning'){
   ctx.beginPath();ctx.moveTo(-2,-12);ctx.lineTo(1,-8);ctx.lineTo(-1,-8);ctx.lineTo(2,-4);ctx.moveTo(2,12);ctx.lineTo(-1,8);ctx.stroke();
  }else if(hero==='shadow'){
   ctx.beginPath();ctx.arc(-2,0,10,-.8,.65);ctx.arc(2,0,10,Math.PI-.8,Math.PI+.65);ctx.stroke();
  }else{
   ctx.beginPath();ctx.ellipse(0,0,11,4.2,-.45,0,TAU);ctx.moveTo(0,-4);ctx.lineTo(3,0);ctx.lineTo(0,4);ctx.lineTo(-3,0);ctx.closePath();ctx.stroke();
  }
 }finally{ctx.restore();}
 return true;
}
