const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function phaseFrames(age,duration,{loop=false,impact=false,count=8}={}){
 const remaining=duration-age;let position;
 if(impact)position=4+clamp(age/Math.max(.001,duration),0,1)*(count-5);
 else if(loop&&age>.16&&remaining>.22)position=2+((age-.16)*12)%4;
 else if(loop&&remaining<=.22)position=6+clamp(1-remaining/.22,0,1);
 else position=clamp(age/Math.max(.001,loop?.16:duration),0,1)*(loop?2:count-1);
 const a=Math.min(count-1,Math.floor(position)),fraction=position-a,b=loop&&a===5?2:Math.min(count-1,a+1);return {a,b,mix:fraction};
}
export function drawAnchoredFrame(c,img,frame,x,y,size,{ground=false,angle=0,alpha=1,reference=256}={}){
 if(!img||!frame||alpha<=0)return false;const r=frame.rect||frame.sourceRect,s=frame.spriteRect||r,p=frame.pivot||frame.pivotLocal||[r[2]/2,r[3]/2],px=p[0],py=ground?(frame.groundContactY??p[1]):p[1],scale=size/reference;
 c.save();c.globalAlpha*=alpha;c.translate(x,y);if(angle)c.rotate(angle);c.drawImage(img,...s,(s[0]-r[0]-px)*scale,(s[1]-r[1]-py)*scale,s[2]*scale,s[3]*scale);c.restore();return true;
}
export function drawFrameBlend(c,img,frames,phase,x,y,size,options={}){
 const alpha=options.alpha??1;drawAnchoredFrame(c,img,frames[phase.a],x,y,size,{...options,alpha:alpha*(1-phase.mix)});if(phase.mix>.001)drawAnchoredFrame(c,img,frames[phase.b],x,y,size,{...options,alpha:alpha*phase.mix});
}
