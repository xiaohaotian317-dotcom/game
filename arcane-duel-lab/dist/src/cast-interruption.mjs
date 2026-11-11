// Only an unperformed solo cast can give back the mana reserved at its start.
export function interruptPlayerCast(w) {
 const p=w.player,c=p.cast;
 if(c&&!c.released&&c.manaPaid>0&&w.campaign?.progression){
  const paid=c.manaPaid;c.manaPaid=0;
  p.mp=Math.min(p.maxMp,p.mp+paid);
  p.cooldowns[c.key]=0;
  w.campaign.dirty=true;
 }
 p.cast=null;
 if(w.campaign?.progression)p.buffer=null;
}
