// Touch aim stays attached to the accepted cast, rather than following a moving stick.
// The same input flag is carried through host simulation and client prediction.
export function beforeMobileCastStep(w,input){
  w.mobileCastInput=input.touchAim===true;
  const c=w.player.cast;
  if(!c?.touchAim||input.cast)return input;
  w.player.face=c.face;
  w.aim={x:c.x,y:c.y};
  return {...input,aim:{...w.aim}};
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
  const move=input.move||0;
  // Keep forward fire at walking speed. Only a shot opposite the stick needs
  // the short turn-and-release plant; do not overwrite the held stick input.
  const turning=c?.touchAim&&move&&Math.sign(move)!==c.face;
  return turning&&c.age<Math.min(c.duration,c.releaseAt+.08,.5)?0:move;
}
