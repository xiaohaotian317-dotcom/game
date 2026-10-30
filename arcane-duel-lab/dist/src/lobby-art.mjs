// The generator's top-row feet extend to y=540. Retain complete silhouettes.
export const SPLASH_RECTS={fire:[0,0,512,540],nature:[544,0,480,540],frost:[1044,0,492,540],lightning:[0,535,512,489],shadow:[544,535,480,489],star:[1056,535,480,489]};
const FACE_CENTERS={fire:[330,80],nature:[805,85],frost:[1304,105],lightning:[290,581],shadow:[862,599],star:[1268,587]};
export function splashStyle(hero){const [x,y,w,h]=SPLASH_RECTS[hero]||SPLASH_RECTS.fire,[fx,fy]=FACE_CENTERS[hero]||FACE_CENTERS.fire;return '--splash-size:'+1536/w*100+'% '+1024/h*100+'%;--splash-pos:'+x/(1536-w)*100+'% '+y/(1024-h)*100+'%;--splash-aspect:'+w+'/'+h+';--portrait-left:'+(35-(fx-x)*350/w)+'px;--portrait-top:'+(34-(fy-y)*350/w)+'px';}
