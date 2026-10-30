// The generator's top-row feet extend to y=540. Retain complete silhouettes.
export const SPLASH_RECTS={fire:[0,0,512,540],nature:[544,0,480,540],frost:[1044,0,492,540],lightning:[0,535,512,489],shadow:[544,535,480,489],star:[1056,535,480,489]};
export function splashStyle(hero){const [x,y,w,h]=SPLASH_RECTS[hero]||SPLASH_RECTS.fire;return '--splash-size:'+1536/w*100+'% '+1024/h*100+'%;--splash-pos:'+x/(1536-w)*100+'% '+y/(1024-h)*100+'%;--splash-aspect:'+w+'/'+h;}
