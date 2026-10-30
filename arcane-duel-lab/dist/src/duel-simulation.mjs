import {createWorld,step,hitSummon,interactNearest,STEP,HEROES} from './simulation.mjs?v=20261030-duel11';
const SHARED=['platforms','obstacles','mechanisms','mirror','spring'];
export function createDuel(heroes,scene='moon'){
  const worlds=heroes.map(h=>createWorld(h,scene));
  for(const [side,w] of worlds.entries()){
    w.duel=true;w.duelSide=side;w.duelSecondary=side===1;w.poseKey='duel-'+side;w.serial=side*1e6;w.targets=[];
    const p=w.player,x=side?w.width-w.spawn.x:w.spawn.x;Object.assign(p,{id:'p'+side,duelActor:true,x,prevX:x,face:side?-1:1,deadUntil:0,burnUntil:0,nextBurn:0,rootUntil:0,fieldForce:0});w.spawn={x,y:p.y};w.aim={x:side?x-300:x+300,y:p.y-50};
  }
  const match={worlds,tick:0,winner:undefined,ack:[0,0]};wireDuel(match);return match;
}
export function wireDuel(match){
  const [a,b]=match.worlds;for(const key of SHARED)b[key]=a[key];
  for(let side=0;side<2;side++){const w=match.worlds[side],rival=match.worlds[1-side];if(rival.fox){rival.fox.duelSummon=true;rival.fox.id='stag-'+(1-side);rival.fox.deadUntil=0;}
    w.targets=[rival.player,...(rival.fox?[rival.fox]:[])];w.duelRivalMirrors=rival.iceMirrors;w.duelHitSummon=(amount,x)=>hitSummon(rival,amount,x);
  }return match;
}
export function stepDuel(match,dt,inputs=[{},{}]){
  if(match.winner!==undefined)return match.winner;
  const hitstop=Math.max(...match.worlds.map(w=>w.hitstop||0));for(const w of match.worlds)w.hitstop=hitstop;
  for(let side=0;side<2;side++){
    wireDuel(match);const w=match.worlds[side],input=inputs[side]||{};if(input.interact)interactNearest(w);step(w,dt,input);
    // Keep a single terrain array even when a tree expires and replaces it.
    if(side===1)match.worlds[0].platforms=w.platforms;
  }
  wireDuel(match);match.tick++;
  const hp=match.worlds.map(w=>w.player.hp);if(hp.some(n=>n<=0))match.winner=hp.every(n=>n<=0)?null:hp[0]<=0?1:0;
  return match.winner;
}
const STREAM=['hero','time','fxTime','player','aim','effects','projectiles','trees','fox','fields','constructs','iceMirrors','portals','ghosts','roleState','stats','shake','flash','impact','hitstop','serial'];
function compact(value){if(typeof value==='number')return Number.isFinite(value)?(Number.isInteger(value)?value:Math.round(value*1000)/1000):1e9;if(Array.isArray(value))return value.map(compact);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k,v])=>typeof v!=='function'&&v!==undefined).map(([k,v])=>[k,compact(v)]));return value;}
export function duelSnapshot(match,{epoch,roundSerial,seq=match.tick}={}){
  const shared=Object.fromEntries(SHARED.map(k=>[k,match.worlds[0][k]]));
  return compact({epoch,roundSerial,seq,tick:match.tick,scene:match.worlds[0].sceneId,ack:match.ack,shared,worlds:match.worlds.map(w=>{const stream=Object.fromEntries(STREAM.map(k=>[k,w[k]]));stream.effects=w.effects.slice(-65);stream.projectiles=w.projectiles.slice(-45).map(p=>({...p,trail:p.trail?.slice(-5)}));stream.ghosts=w.ghosts?.slice(-5);stream.texts=w.texts.slice(-12);return stream;})});
}
export function restoreDuel(snapshot){
  if(!snapshot||!Array.isArray(snapshot.worlds)||snapshot.worlds.length!==2||snapshot.worlds.some(w=>!HEROES[w.hero]))return null;
  const match=createDuel(snapshot.worlds.map(w=>w.hero),snapshot.scene);match.tick=snapshot.tick;match.ack=snapshot.ack||[0,0];
  for(let side=0;side<2;side++){Object.assign(match.worlds[side],snapshot.worlds[side]);Object.assign(match.worlds[side],snapshot.shared);}
  return wireDuel(match);
}
export function safeInput(value){return {move:value?.move>0?1:value?.move<0?-1:0,attack:value?.attack===true,down:value?.down===true,drop:value?.drop===true,aim:{x:Math.max(0,Math.min(2304,Number(value?.aim?.x)||0)),y:Math.max(0,Math.min(800,Number(value?.aim?.y)||0))}};}
export class InputInbox{
  constructor(){this.seq=-1;this.lastAction=0;this.input=safeInput({});this.actions=[];this.receivedAt=0;}
  receive(packet,time){if(!packet||!Number.isSafeInteger(packet.seq)||packet.seq<0)return;this.receivedAt=time;if(packet.seq>=this.seq){this.seq=packet.seq;this.input=safeInput(packet.input);}
    for(const action of Array.isArray(packet.actions)?packet.actions:[]){if(!action||!Number.isSafeInteger(action.id)||action.id<=this.lastAction||this.actions.some(a=>a.id===action.id))continue;if(['attack','jump','dash','interact','q','e','r'].includes(action.type))this.actions.push({id:action.id,type:action.type});}this.actions.sort((a,b)=>a.id-b.id);this.actions=this.actions.slice(-24);
  }
  consume(time){const action=this.actions.shift();if(action)this.lastAction=Math.max(this.lastAction,action.id);const input={...this.input,aim:{...this.input.aim}};if(time-this.receivedAt>.6){input.move=0;input.attack=false;input.down=false;}
    if(action){if(['q','e','r'].includes(action.type))input.cast=action.type;else input[action.type]=true;}return input;
  }
}
export {STEP};
