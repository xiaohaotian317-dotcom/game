// Separate from ordinary hit invulnerability: a real blink also dodges DoT ticks
// and on-hit control for this short absolute-time window.
export const blinkProtected=(w,actor=w.player)=>(Number.isFinite(actor?.blinkUntil)&&actor.blinkUntil>w.time)||(Number.isFinite(actor?.artifactGuardUntil)&&actor.artifactGuardUntil>w.time);
export function protectBlink(w,actor=w.player,duration=.15){actor.blinkUntil=w.time+Math.max(0,Math.min(.25,duration));actor.invuln=Math.max(actor.invuln||0,duration);}
