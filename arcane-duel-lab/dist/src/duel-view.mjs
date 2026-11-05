// Correct from the last displayed predicted position, never the previous authority packet.
export function reconcileRenderOffset(displayed,next,maxError=90){
 if(!displayed||!next)return null;const x=displayed.x-next.x,y=displayed.y-next.y;
 return Number.isFinite(x)&&Number.isFinite(y)&&Math.hypot(x,y)<maxError?{x,y}:null;
}
