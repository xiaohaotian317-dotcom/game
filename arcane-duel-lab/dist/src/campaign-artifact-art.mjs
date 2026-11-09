export {relicIconMarkup as artifactIconMarkup} from './relic-art.mjs';
import {relicIconStyle} from './relic-art.mjs';
import swordMeta from '../assets/artifacts/sword-meta-v1.json' with {type:'json'};
export function artifactIconStyle(id){if(id==='ward'||id==='spring')return relicIconStyle(id);if(id==='mirror')return "background-image:url('assets/pets/mirror-v1.png');background-size:245.3674% 107.4502%;background-position:11.2088% 19.7183%";const m=swordMeta,r=m.frames[0].rect;return `background-image:url('assets/artifacts/${m.file}');background-size:${m.size[0]/r[2]*100}% ${m.size[1]/r[3]*100}%;background-position:${r[0]/(m.size[0]-r[2])*100}% ${r[1]/(m.size[1]-r[3])*100}%`;}
