export const WIN_SCORE=3;
export const BASE_MAX_HEALTH=Object.freeze({fire:120,nature:120,frost:110,lightning:120,shadow:110,star:115});
export const MAX_HEALTH=Object.freeze(Object.fromEntries(Object.entries(BASE_MAX_HEALTH).map(([hero,hp])=>[hero,Math.round(hp*1.5)])));
export const FROST_SNARE_DAMAGE=18;
export const FROST_ECHO_DAMAGE=12;
