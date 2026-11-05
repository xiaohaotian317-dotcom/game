import {drawFxFrame} from './boss-fx-painter.mjs';
import {drawLandingWarning} from './combat-feedback.mjs';
export function drawEnemyGroundWarning(c,assets,{style,x,y,radius,progress,clock=0}){
 const hero=style==='lava'?'fire':style==='ice'?'frost':null;
 if(!hero||!assets?.landingRings)return false;
 drawLandingWarning(c,assets,{hero,x,y,radius,progress,clock});return true;
}
export function drawEnemyLava(c,art,x,y,radius,age,{impact=false}={}){
 if(!art?.fxMeta?.fire||!art['fire-v2.png'])return false;
 const frame=impact?4+Math.min(3,Math.floor(age*10)):8+Math.floor(age*10)%8;
 return drawFxFrame(c,art['fire-v2.png'],art.fxMeta.fire,frame,x,y,impact?Math.max(95,radius*2.1):radius*2.4,{ground:true});
}
