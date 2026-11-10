// Touch aim stays attached to the accepted cast, rather than following a moving stick.
// The same input flag is carried through host simulation and client prediction.
export function beforeMobileCastStep(w,input){
  w.mobileCastInput=input.touchAim===true;
  const c=w.player.cast;
  if(!c?.touchAim||input.cast)return input;
  w.player.face=c.face;
  w.aim={x:c.x,y:c.y};
  const stopUntil=Math.min(c.duration,c.releaseAt+.08,.5);
  return {...input,aim:{...w.aim},move:c.age<stopUntil?0:input.move};
}

export function lockMobileCastFacing(w){
  const p=w.player,c=p.cast;
  if(!c||!w.mobileCastInput)return;
  c.touchAim=true;c.face=Math.abs(c.x-p.x)>1?Math.sign(c.x-p.x):p.face;
  p.face=c.face;w.aim={x:c.x,y:c.y};
}

export function prepareMobileCastRelease(w,c){
  if(!c?.touchAim)return;
  w.player.face=c.face;w.aim={x:c.x,y:c.y};
}

export function mobileCastMovement(w,input){
  const c=w.player.cast;
  return c?.touchAim&&c.age<Math.min(c.duration,c.releaseAt+.08,.5)?0:(input.move||0);
}
