import {writeFile,mkdir} from 'node:fs/promises';
import {createDuel,stepDuel,duelSnapshot,STEP} from '../dist/src/duel-simulation.mjs';
const base=process.argv[2]||'http://127.0.0.1:4192',local=new URL(base).hostname==='127.0.0.1',times=[],sizes=[];
async function api(path,body,token,expected=200){const start=performance.now(),r=await fetch(base+'/api/duel/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Duel-Token':token}:{})},body:JSON.stringify(body)}),data=await r.json();times.push(performance.now()-start);if(r.status!==expected)throw Error(path+': '+r.status+' '+JSON.stringify(data));return data;}
const host=await api('rooms',{name:'协议主机',hero:'fire'}),code=host.room.code,guest=await api('join',{code,name:'协议挑战者',hero:'nature'}),route='rooms/'+code;
await api(route+'/action',{type:'start'},host.token,409);await api(route+'/action',{type:'ready',ready:true},guest.token);await api(route+'/action',{type:'start'},host.token);await api(route+'/action',{type:'lock',ready:true},host.token);let room=(await api(route+'/action',{type:'lock',ready:true},guest.token)).room,sequence=0;
while(room.phase!=='finished'){
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,room.startAt-Date.now()+15)));
  const match=createDuel(room.slots.map(s=>s.hero),room.scene);let won;
  const packet={epoch:room.epoch,roundSerial:room.roundSerial,seq:++sequence,input:{move:0,aim:{x:match.worlds[0].player.x,y:match.worlds[0].player.y-40}},actions:[]};await api(route+'/sync',{epoch:room.epoch,seq:sequence,input:packet},guest.token);
  for(let i=0;i<4800&&won===undefined;i++){
    const p=match.worlds[0].player,t=match.worlds[1].player,cast=p.cooldowns.r<=0?'r':p.cooldowns.q<=0?'q':undefined;
    won=stepDuel(match,STEP,[{aim:{x:t.x,y:t.y-10},cast},{aim:packet.input.aim}]);
    if(i%90===0||won!==undefined){const snapshot=duelSnapshot(match,{epoch:room.epoch,roundSerial:room.roundSerial});sizes.push(JSON.stringify(snapshot).length);const reply=await api(route+'/sync',{epoch:room.epoch,seq:++sequence,snapshot},host.token);if(reply.input.seq!==packet.seq)throw Error('Guest input relay mismatch');const observed=await api(route+'/sync',{epoch:room.epoch},guest.token);if(observed.snapshot?.worlds[1].player.hp!==snapshot.worlds[1].player.hp)throw Error('Guest state relay mismatch');}
  }
  if(won===undefined)throw Error('Combat did not finish');room=(await api(route+'/action',{type:'round',epoch:room.epoch,roundSerial:room.roundSerial,winner:won,hp:match.worlds.map(w=>w.player.hp)},host.token)).room;
}
const finalScore=[...room.score],winner=room.winner;await api(route+'/action',{type:'return'},host.token);room=(await api(route+'/action',{type:'return'},guest.token)).room;if(room.phase!=='waiting')throw Error('Both clients did not return');await api(route+'/action',{type:'leave'},host.token);
times.sort((a,b)=>a-b);const report={base,scene:room.scene,score:finalScore,winner,bothReturnToWaiting:room.phase==='waiting',clients:2,requests:times.length,httpRttMs:{median:+times[Math.floor(times.length*.5)].toFixed(2),p95:+times[Math.floor(times.length*.95)].toFixed(2)},snapshotBytes:{mean:Math.round(sizes.reduce((a,b)=>a+b,0)/sizes.length),max:Math.max(...sizes)},note:'两个独立协议客户端、真实战斗模拟与 HTTP 兜底；战斗物理快进，三秒倒计时使用真实时间。RTT 为接口验证，不代表两名异地玩家的WebRTC延迟。'};
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});await writeFile(new URL('../validation/duel12-'+(local?'api':'public')+'-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
