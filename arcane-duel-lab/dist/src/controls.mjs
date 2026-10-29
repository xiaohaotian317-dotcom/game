// The simulation retains its first-slot ID `q`; every player-facing binding is F.
export const KEY_LABELS=Object.freeze({attack:'LMB',q:'F',e:'E',r:'R',dash:'SHIFT'});
export const RECAST_WINDOWS=Object.freeze({fire:2.5,nature:3.5,frost:3.5,lightning:3.5,shadow:3.5,star:3.5});
export const INTERACT_CODE='KeyG';
export function skillForCode(code){return ({KeyF:'q',KeyE:'e',KeyR:'r'})[code]||null;}
