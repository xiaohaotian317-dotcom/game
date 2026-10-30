import {WIN_SCORE,MAX_HEALTH} from '../dist/src/match-rules.mjs';
const HEROES=['fire','nature','frost','lightning','shadow','star'],SCENES=['moon','lava','garden'];
class RoomError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const fail=(message,status)=>{throw new RoomError(message,status);};
const now=()=>Date.now(),id=()=>crypto.randomUUID();
const codeOf=value=>String(value||'').trim().toUpperCase();
const nameOf=value=>String(value||'冒险者').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,16)||'冒险者';
const slot=(name,hero)=>({name:nameOf(name),hero:HEROES.includes(hero)?hero:'fire',ready:false,locked:false,returned:false});
function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store'}});}
export class RoomService{
  constructor(db,{clock=now,random=Math.random}={}){this.db=db;this.clock=clock;this.random=random;}
  async row(code){const r=await this.db.prepare('SELECT * FROM duel_rooms WHERE code = ?').bind(code).first();if(!r||r.expires_at<this.clock())fail('房间不存在或已过期',404);return r;}
  seat(row,token){if(token&&token===row.host_token)return 0;if(token&&token===row.guest_token)return 1;fail('房间凭证无效，请重新加入',403);}
  async view(row,seat){const r=JSON.parse(row.data),relay=await this.db.prepare('SELECT host_seen, guest_seen FROM duel_relay WHERE code = ?').bind(row.code).first();return {...r,code:row.code,seat,revision:row.revision,serverTime:this.clock(),seen:[relay?.host_seen||0,relay?.guest_seen||0]};}
  async create(body){
    const wanted=codeOf(body.code);if(wanted&&!/^[A-Z0-9]{4,8}$/.test(wanted))fail('房间号需要 4～8 位字母或数字');
    await this.db.prepare('DELETE FROM duel_rooms WHERE expires_at < ?').bind(this.clock()).run();
    for(let attempt=0;attempt<8;attempt++){
      const code=wanted||String(Math.floor(100000+this.random()*900000)),token=id(),time=this.clock(),data={phase:'waiting',winScore:WIN_SCORE,slots:[slot(body.name,body.hero),null],score:[0,0],round:1,roundSerial:0,epoch:id(),scene:null,startAt:0,winner:null,lastWinner:null,reason:null};
      try{await this.db.batch([
        this.db.prepare('INSERT INTO duel_rooms (code, revision, data, expires_at, host_token) VALUES (?, 0, ?, ?, ?)').bind(code,JSON.stringify(data),time+86400000,token),
        this.db.prepare('INSERT INTO duel_relay (code, host_seen, guest_seen) VALUES (?, ?, 0)').bind(code,time)
      ]);return {token,room:await this.view(await this.row(code),0)};}catch(e){if(!String(e.message).includes('UNIQUE'))throw e;if(wanted)fail('这个房间号已被使用，请换一个',409);}
    }fail('暂时无法创建房间，请重试',503);
  }
  async mutate(code,token,fn,{joining=false}={}){
    for(let attempt=0;attempt<8;attempt++){
      const row=await this.row(code),seat=joining?1:this.seat(row,token),r=JSON.parse(row.data),newToken=await fn(r,seat,row);
      const result=await this.db.prepare('UPDATE duel_rooms SET data = ?, revision = revision + 1, expires_at = ?, guest_token = ? WHERE code = ? AND revision = ?').bind(JSON.stringify(r),this.clock()+86400000,newToken===undefined?row.guest_token:newToken,code,row.revision).run();
      if(result.meta.changes)return {token:joining?newToken:undefined,room:await this.view(await this.row(code),seat)};
    }fail('房间状态正在更新，请再试一次',409);
  }
  async join(body){const code=codeOf(body.code),token=id();const result=await this.mutate(code,null,async(r,seat,row)=>{if(r.phase!=='waiting')fail('这场决斗已经开始，请等待房主返回房间',409);if(r.slots[1]||row.guest_token)fail('房间已满，最多两位玩家',409);r.slots[1]=slot(body.name,body.hero);return token;},{joining:true});await this.db.prepare('UPDATE duel_relay SET guest_seen = ? WHERE code = ?').bind(this.clock(),code).run();result.room.seen[1]=this.clock();return result;}
  async action(code,token,body){
    return this.mutate(code,token,async(r,seat,row)=>{
      const s=r.slots[seat];if(!s)fail('你已离开房间',403);
      if(body.type==='leave'){
        if(['countdown','active','selecting'].includes(r.phase)){r.winner=1-seat;r.score[1-seat]=WIN_SCORE;r.phase='finished';r.reason='opponentLeft';s.returned=true;s.left=true;}
        else if(seat===0){r.phase='closed';r.reason='hostLeft';}else{r.slots[1]=null;return null;}
        return;
      }
      if(body.type==='ready'){if(r.phase!=='waiting')fail('当前不能切换房间准备状态',409);s.ready=body.ready===true;return;}
      if(body.type==='start'){
        if(seat!==0)fail('只有房主可以开始游戏',403);
        if(r.phase!=='waiting')fail('游戏已经开始',409);
        if(!r.slots[1])fail('等待另一位玩家加入房间',409);
        if(!r.slots[1].ready)fail('玩家还未准备',409);
        r.phase='selecting';r.winScore=WIN_SCORE;r.epoch=id();r.score=[0,0];r.round=1;r.roundSerial=0;r.scene=SCENES[Math.floor(this.random()*3)];r.winner=null;r.reason=null;r.slots.forEach(s=>{s.locked=false;s.returned=false;});
        await this.db.prepare('UPDATE duel_relay SET snapshot = NULL, input = NULL, offer = NULL, answer = NULL, host_seq = 0, guest_seq = 0 WHERE code = ?').bind(code).run();return;
      }
      if(body.type==='hero'){
        if(r.phase!=='selecting'||!HEROES.includes(body.hero))fail('当前不能选择这个英雄',409);
        if(s.hero!==body.hero){s.hero=body.hero;r.slots.forEach(p=>p.locked=false);}return;
      }
      if(body.type==='lock'){
        if(r.phase!=='selecting')fail('当前不在英雄选择阶段',409);
        s.locked=body.ready===true;
        if(r.slots.every(s=>s?.locked)){r.phase='countdown';r.roundSerial=1;r.startAt=this.clock()+3000;}return;
      }
      if(body.type==='round'){
        if(seat!==0)fail('只有本局主机可以提交回合结果',403);
        if(body.epoch!==r.epoch||body.roundSerial!==r.roundSerial||!['countdown','active'].includes(r.phase))return;
        if(this.clock()<r.startAt)fail('倒计时还未结束',409);
        const hp=body.hp;if(!Array.isArray(hp)||hp.length!==2||hp.some((n,i)=>!Number.isFinite(n)||n<0||n>MAX_HEALTH[r.slots[i].hero]))fail('无效的回合结果');
        const winner=hp[0]<=0&&hp[1]<=0?null:hp[0]<=0?1:hp[1]<=0?0:undefined;
        if(winner===undefined||body.winner!==winner)fail('回合尚未结束',409);
        r.lastWinner=winner;if(winner!==null)r.score[winner]++;
        if(r.score.some(n=>n>=WIN_SCORE)){r.winner=r.score[0]>=WIN_SCORE?0:1;r.phase='finished';r.reason='score';}
        else{r.round=1+r.score[0]+r.score[1];r.roundSerial++;r.phase='countdown';r.startAt=this.clock()+3000;}return;
      }
      if(body.type==='return'){
        if(r.phase!=='finished')fail('本场决斗还未结束',409);s.returned=true;
        if(r.slots.every(s=>s?.returned)){if(r.slots[0].left){r.phase='closed';r.reason='hostLeft';return;}if(r.slots[1].left){r.slots[1]=null;r.phase='waiting';r.slots[0].ready=false;return null;}r.phase='waiting';r.slots.forEach(s=>{s.ready=false;s.locked=false;s.returned=false;});}return;
      }
      if(body.type==='forfeit'){
        const relay=await this.db.prepare('SELECT host_seen, guest_seen FROM duel_relay WHERE code = ?').bind(code).first(),otherSeen=seat===0?relay.guest_seen:relay.host_seen;
        if(!['selecting','countdown','active'].includes(r.phase)||this.clock()-otherSeen<30000)fail('对方仍在线，暂不能结束对局',409);
        r.winner=seat;r.score[seat]=WIN_SCORE;r.phase='finished';r.reason='disconnect';r.slots[1-seat].left=true;r.slots[1-seat].returned=true;return;
      }
      fail('未知的房间操作');
    });
  }
  async sync(code,token,body){
    let row=await this.row(code);const seat=this.seat(row,token),r=JSON.parse(row.data),time=this.clock();
    const seen=seat===0?'host_seen':'guest_seen';await this.db.prepare('UPDATE duel_relay SET '+seen+' = ? WHERE code = ?').bind(time,code).run();
    if(body.epoch===r.epoch){
      if(body.signal){const key=seat===0?'offer':'answer';const signal=JSON.stringify(body.signal);if(signal.length>30000)fail('连接信息过大');await this.db.prepare('UPDATE duel_relay SET '+key+' = ? WHERE code = ?').bind(signal,code).run();}
      const seq=Number.isSafeInteger(body.seq)&&body.seq>=0?body.seq:0;
      if(seat===0&&body.snapshot){const snap=body.snapshot;if(snap.epoch!==r.epoch||snap.roundSerial!==r.roundSerial)fail('已进入新的回合',409);const raw=JSON.stringify(snap);if(raw.length>180000)fail('战斗数据过大');await this.db.prepare('UPDATE duel_relay SET snapshot = ?, host_seq = ? WHERE code = ? AND host_seq < ?').bind(raw,seq,code,seq).run();}
      if(seat===1&&body.input){const raw=JSON.stringify(body.input);if(raw.length>12000)fail('输入数据过大');await this.db.prepare('UPDATE duel_relay SET input = ?, guest_seq = ? WHERE code = ? AND guest_seq < ?').bind(raw,seq,code,seq).run();}
    }
    const relay=await this.db.prepare('SELECT * FROM duel_relay WHERE code = ?').bind(code).first();
    return {room:await this.view(row,seat),relaySeq:seat===0?relay.host_seq:relay.guest_seq,input:seat===0&&relay.input?JSON.parse(relay.input):null,snapshot:(seat===1||body.resume)&&relay.snapshot?JSON.parse(relay.snapshot):null,signal:(seat===0?relay.answer:relay.offer)?JSON.parse(seat===0?relay.answer:relay.offer):null};
  }
}
export async function handleDuelRequest(request,db){
  try{
    const url=new URL(request.url),origin=request.headers.get('origin');if(origin&&origin!==url.origin)fail('不接受跨站请求',403);
    if(request.method!=='POST'&&request.method!=='GET')fail('不支持的请求方法',405);
    const path=url.pathname.replace(/^\/api\/duel\/?/,'').split('/').filter(Boolean),service=new RoomService(db),token=request.headers.get('X-Duel-Token');
    let body={};if(request.method==='POST'){if(!request.headers.get('content-type')?.includes('application/json'))fail('需要 JSON 请求',415);const raw=await request.text();if(raw.length>220000)fail('请求过大',413);try{body=JSON.parse(raw);}catch{fail('无效的请求内容');}}
    if(path[0]==='rooms'&&path.length===1&&request.method==='POST')return json(await service.create(body));
    if(path[0]==='join'&&request.method==='POST')return json(await service.join(body));
    if(path[0]==='rooms'&&path[1]){const code=codeOf(path[1]);if(path[2]==='action'&&request.method==='POST')return json(await service.action(code,token,body));if(path[2]==='sync'&&request.method==='POST')return json(await service.sync(code,token,body));if(path.length===2&&request.method==='GET'){const row=await service.row(code);return json({room:await service.view(row,service.seat(row,token))});}}
    return json({error:'接口不存在'},404);
  }catch(e){if(!(e instanceof RoomError))console.error('Room service:',e.message);return json({error:e instanceof RoomError?e.message:'房间服务暂时不可用，请稍后重试'},e.status||503);}
}
