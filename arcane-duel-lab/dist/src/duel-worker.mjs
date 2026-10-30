import {createDuel,restoreDuel,stepDuel,duelSnapshot,InputInbox,STEP} from './duel-simulation.mjs?v=20261030-duel11';
let match=null,config=null,inbox=[new InputInbox(),new InputInbox()],last=performance.now(),acc=0,lastSend=0,eventSeq=0,events=[],reported=false,paused=false;
onmessage=({data})=>{
  if(data.kind==='reset'){config=data;match=data.snapshot?restoreDuel(data.snapshot):createDuel(data.heroes,data.scene);inbox=[new InputInbox(),new InputInbox()];if(data.snapshot)inbox.forEach((i,side)=>{i.seq=data.snapshot.ack?.[side]||0;i.lastAction=data.snapshot.actionAck?.[side]||0;});last=performance.now();acc=0;lastSend=0;eventSeq=0;events=[];reported=false;paused=false;}
  if(data.kind==='input'&&match&&data.packet.epoch===config.epoch&&data.packet.roundSerial===config.roundSerial)inbox[data.side].receive(data.packet,performance.now()/1000);
  if(data.kind==='pause')paused=data.value;
};
setInterval(()=>{
  const current=performance.now(),dt=Math.min(.05,Math.max(0,(current-last)/1000));last=current;if(!match)return;
  if(!paused&&!reported&&Date.now()>=config.localStartAt){acc+=dt;while(acc>=STEP){const inputs=inbox.map(i=>i.consume(current/1000));stepDuel(match,STEP,inputs);acc-=STEP;if(match.winner!==undefined){reported=true;postMessage({kind:'round',epoch:config.epoch,roundSerial:config.roundSerial,winner:match.winner,hp:match.worlds.map(w=>w.player.hp)});break;}}}
  if(current-lastSend>=50){lastSend=current;match.ack=inbox.map(i=>i.seq);for(const w of match.worlds){for(const e of w.events)events.push({id:++eventSeq,...e});w.events.length=0;}events=events.slice(-16);const snapshot=duelSnapshot(match,{epoch:config.epoch,roundSerial:config.roundSerial});snapshot.actionAck=inbox.map(i=>i.lastAction);snapshot.events=events;postMessage({kind:'state',snapshot});}
},8);
