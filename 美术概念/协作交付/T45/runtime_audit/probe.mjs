import {readFileSync} from 'node:fs';
import {createWorld,step,STEP} from '../../../../arcane-duel-lab/dist/src/simulation.mjs';
import {placeEncounter,enemyMeleeReady,enemyMeleeReach,enemyCastOrigin} from '../../../../arcane-duel-lab/dist/src/enemy-simulation.mjs';
import {ENEMIES} from '../../../../arcane-duel-lab/dist/src/enemy-roster.mjs';
import {firstTerrainHit} from '../../../../arcane-duel-lab/dist/src/collision.mjs';
const root=new URL('../../../../arcane-duel-lab/dist/assets/enemies/',import.meta.url);
const art={...JSON.parse(readFileSync(new URL('bounds-v1.json',root))).units,...JSON.parse(readFileSync(new URL('chapter2/bounds-v1.json',root))).units};
for(const id of process.argv.slice(2).length?process.argv.slice(2):['M11']) {
 const w=createWorld('fire','moon');w.enemyArt=art;w.player.hp=w.player.maxHp=50000;
 Object.assign(w.player,{x:850,y:w.floor,prevX:850,prevY:w.floor,platformId:'ground'});
 const [e]=placeEncounter(w,[id],{x:1280,y:w.floor});const s=ENEMIES[id].patterns[0].steps[0];
 for(let n=0;n<20/STEP;n++){step(w,STEP);w.events=[];if(n%120===119){const origin={x:e.x,y:e.y-Math.min(e.h*.42,75)},hit=firstTerrainHit(w,origin.x,origin.y,w.player.x,w.player.y-55);console.log(JSON.stringify({t:w.time,id,x:e.x,y:e.y,vx:e.vx,player:{x:w.player.x,y:w.player.y,hp:w.player.hp},state:e.ai.state,seq:e.ai.sequence,ready:e.ai.readyAt,reach:enemyMeleeReach(w,e,s),mReady:enemyMeleeReady(w,e,s),origin,castOrigin:enemyCastOrigin(w,e),hit}));}}
 console.log(JSON.stringify({id,attacks:w.enemyEvents.filter(event=>event.type==='attackStarted'),platforms:w.platforms,obstacles:w.obstacles}));
}
