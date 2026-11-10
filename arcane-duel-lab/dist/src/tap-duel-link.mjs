import {DUEL_RULESET,defaultDuelLoadout,validateDuelLoadout,duelSnapshotMatches} from './duel-skill-data.mjs';
import {WIN_SCORE,MAX_HEALTH} from './match-rules.mjs';
import {encodeTapInput,decodeTapInput,encodeTapSnapshot,TapSnapshotAssembler,LatestTapSnapshots,utf8Bytes,TAP_FRAME_MESSAGES} from './tap-frame-codec.mjs';

const HEROES=Object.keys(MAX_HEALTH),SCENES=['moon','lava','garden'],PROTOCOL='arcane-tap-v1',SESSION='arcane-tap-room-v1';
// Input uses real SDK frame credits; this number is a target, never a JS timer gate.
export const TAP_INPUT_INTERVAL_MS=1000/30;
const MAINTENANCE_INTERVAL_MS=50;
const clone=value=>JSON.parse(JSON.stringify(value));
const nameOf=value=>String(value||'冒险者').replace(/[<>\x00-\x1f]/g,'').trim().slice(0,16)||'冒险者';
const uuid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
function error(message,code='tapProtocol'){const e=new Error(message);e.code=code;return e;}
function json(value){try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}}
function slot(body){const hero=HEROES.includes(body?.hero)?body.hero:'fire';return {name:nameOf(body?.name),hero,loadout:defaultDuelLoadout(hero),ready:false,locked:false,returned:false};}
function validRoom(r,build){
  if(!r||r.protocol!==PROTOCOL||r.build!==build||r.ruleset!==DUEL_RULESET||r.winScore!==WIN_SCORE||!['waiting','selecting','countdown','active','finished','closed'].includes(r.phase)||typeof r.code!=='string'||!r.hostId||typeof r.epoch!=='string'||!r.epoch.length||r.epoch.length>128||!Number.isSafeInteger(r.revision)||r.revision<0||!Number.isSafeInteger(r.roundSerial)||r.roundSerial<0||!Number.isInteger(r.round)||r.round<1||!Number.isFinite(r.startAt)||!Number.isFinite(r.serverTime)||!Array.isArray(r.seen)||r.seen.length!==2||r.seen.some(n=>!Number.isFinite(n))||!Array.isArray(r.score)||r.score.length!==2||r.score.some(n=>!Number.isInteger(n)||n<0||n>WIN_SCORE)||!Array.isArray(r.slots)||r.slots.length!==2||!r.slots[0])return false;
  try{for(const s of r.slots)if(s){if(!HEROES.includes(s.hero)||typeof s.name!=='string')return false;validateDuelLoadout(s.hero,s.loadout);}return true;}catch{return false;}
}

// Same public surface as DuelLink. Native SDK access stays in window.arcaneMobile.tap.
export class TapDuelLink{
  constructor(hooks={},options={}){
    Object.assign(this,hooks);this.tap=options.bridge||hooks.tapBridge||globalThis.window?.arcaneMobile?.tap;
    this.build=options.build||hooks.build||'android1-crossplay-v3';try{this.storage=options.storage||globalThis.sessionStorage;}catch{this.storage=null;}this.wall=options.clock||(()=>Date.now());this.now=options.now||(()=>performance.now());this.random=options.random||Math.random;this.manualTick=options.manualTick===true;
    this.session=null;this.room=null;this.hostRoom=null;this.running=false;this.connected=false;this.frameReady=false;this.transport='tap';this.rtt=0;this.clockOffset=0;this.seq=0;this.latestState=null;this.input=null;this.lastPacketAt=this.now();this.lastStateAt=0;
    this.assembler=new TapSnapshotAssembler({now:this.now});this.snapshots=new LatestTapSnapshots();this.pending=new Map();this.requestAcks=new Map();this.receivedControls=new Map();this.controlQueue=[];this.sentControls=[];this.lastHeartbeat=-Infinity;this.lastSnapshot=-Infinity;this.lastFrame=-Infinity;this.generation=0;this.frameBusy=false;this.controlBusy=false;this.encodeBusy=false;this.mutations=Promise.resolve();this.listener=null;this.disconnectAt=null;
    this.sdkFrameId=-1;this.claimedFrameId=-1;this.frameSyncId=null;this.frameInFlight=0;this.frameGeneration=0;
  }
  async _prepare(){
    if(!this.tap?.status)throw error('此设备没有安装 TapTap 联机组件','notConfigured');
    const status=await this.tap.status();this.nativeStatus=status;if(!status.configured)throw error('TapTap 联机尚未配置应用信息，当前可以使用离线与局域网模式','notConfigured');
    if(!status.privacyAccepted)throw error('请先阅读并同意 TapTap 联机隐私说明','privacyRequired');
    if(!this.listener)this.listener=await this.tap.addListener('battle',event=>{Promise.resolve(this._event(event)).catch(e=>this.onError?.(e.message));});
    if(!status.loggedIn)await this.tap.login({privacyAccepted:true});
    const connected=await this.tap.connect();this.playerId=String(connected.playerId||status.playerId||'');if(!this.playerId)throw error('TapTap 没有返回有效玩家身份');this.connected=true;this.disconnectAt=null;
  }
  _player(body){return {status:0,properties:JSON.stringify({protocol:PROTOCOL,build:this.build,ruleset:DUEL_RULESET,name:nameOf(body?.name),hero:HEROES.includes(body?.hero)?body.hero:'fire'})};}
  _save(){try{this.storage?.setItem(SESSION,JSON.stringify(this.session));}catch{}}
  _forget(){try{this.storage?.removeItem(SESSION);}catch{}}
  _start(){
    if(this.running)return;this.running=true;
    if(!this.manualTick){const loop=()=>this.tick().catch(e=>this.onError?.(e.message)).finally(()=>{if(this.running)this.timer=setTimeout(loop,MAINTENANCE_INTERVAL_MS);});this.timer=setTimeout(loop,MAINTENANCE_INTERVAL_MS);}
  }
  async enter(kind,body={}){
    if(!['create','join'].includes(kind))throw error('未知的房间操作');
    if(this.session)await this.tap?.leave?.().catch(()=>{});this.stop();this.session=null;this.room=null;this.hostRoom=null;await this._prepare();this._start();
    try{
      if(kind==='create'){
        const time=this.wall(),state={protocol:PROTOCOL,build:this.build,ruleset:DUEL_RULESET,code:'',hostId:this.playerId,guestId:null,phase:'waiting',winScore:WIN_SCORE,slots:[slot(body),null],score:[0,0],round:1,roundSerial:0,epoch:uuid(),scene:null,startAt:0,winner:null,lastWinner:null,reason:null,revision:0,serverTime:time,seen:[time,0]};
        const result=await this.tap.create({name:nameOf(body.name)+'的秘境',properties:JSON.stringify(state),player:this._player(body)}),native=result.room;
        if(!native?.id||String(native.ownerId)!==this.playerId)throw error('TapTap 房间身份不匹配');state.code=String(native.id);this.nativeRoom=native;this.session={code:state.code,seat:0,playerId:this.playerId,hostId:this.playerId,build:this.build};
        await this._commit(state);this._save();return this.room;
      }
      const roomId=String(body.code||'').trim();if(!roomId||roomId.length>128)throw error('请输入有效的 TapTap 房间号');
      const result=await this.tap.join({roomId,player:this._player(body)}),native=result.room;this.nativeRoom=native;const state=json(native?.properties);
      if(!validRoom(state,this.build))throw error('双方战斗版本不一致，请使用同一版客户端','versionMismatch');
      if(String(native.ownerId)!==state.hostId)throw error('原房主已断线，此房间不能转移正在进行的战斗');
      this.session={code:String(native.id),seat:1,playerId:this.playerId,hostId:state.hostId,build:this.build};this._save();
      const admitted=this._waitAdmission();this._accept(state);await this._sendControl({k:'hello',profile:this._player(body).properties});await admitted;return this.room;
    }catch(e){this.stop({forget:true});throw e;}
  }
  async resume(){
    let saved;try{saved=JSON.parse(this.storage?.getItem(SESSION));}catch{}if(!saved?.code||!saved?.playerId||!saved?.hostId||saved.build!==this.build)return false;
    try{
      await this._prepare();if(this.playerId!==saved.playerId)throw error('联机账号已变化，请重新加入房间');this.session=saved;this._start();
      const result=this.nativeStatus?.room?.id===saved.code?{room:this.nativeStatus.room}:await this.tap.join({roomId:saved.code,player:this._player({name:'冒险者',hero:'fire'})}),native=result.room;this.nativeRoom=native;const state=json(native?.properties);
      if(!validRoom(state,this.build)||String(native.ownerId)!==saved.hostId||state.hostId!==saved.hostId)throw error('原房主已离线，请重新创建房间');
      // A restarted host has lost its Worker authority. Never restart an active match from full HP.
      if(saved.seat===0&&['countdown','active'].includes(state.phase)){state.phase='closed';state.reason='authorityLost';state.revision++;await this._commit(state);this.onError?.('原主机的战斗状态已丢失，请重新创建房间');return true;}
      this._accept(state);if(saved.seat===0){this.hostRoom=clone(state);await this._publish();}else await this._sendControl({k:'resync'});return true;
    }catch(e){this.onError?.(e.message);this.stop({forget:true});return false;}
  }
  _waitAdmission(){return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.admission=null;reject(error('房主未响应，请确认房主仍在线'));},6000);this.admission={resolve:()=>{clearTimeout(timer);this.admission=null;resolve();},reject:e=>{clearTimeout(timer);this.admission=null;reject(e);}};});}
  _accept(state){
    if(!validRoom(state,this.build)||!this.session||state.code!==this.session.code||state.hostId!==this.session.hostId)return false;
    if(this.room&&(state.revision<this.room.revision||(state.revision===this.room.revision&&state.epoch!==this.room.epoch)))return false;
    const seat=this.playerId===state.hostId?0:this.playerId===state.guestId?1:-1;if(seat<0)return false;
    const changed=!this.room||state.epoch!==this.room.epoch||state.roundSerial!==this.room.roundSerial;
    this.session.seat=seat;const offset=state.serverTime+this.rtt/2-this.wall();this.clockOffset=this.room?this.clockOffset*.8+offset*.2:offset;this.room={...clone(state),seat};
    if(changed){this.generation++;this.input=null;this.latestState=null;this.snapshots.clear();this.assembler.reset(state.epoch,state.roundSerial);this.lastSnapshot=-Infinity;}
    if(seat===0)this.hostRoom=clone(state);this.onRoom?.(this.room);this.onStatus?.();this.admission?.resolve();return true;
  }
  async _commit(state){
    const newCountdown=state.phase==='countdown'&&(state.epoch!==this.hostRoom?.epoch||state.roundSerial!==this.hostRoom?.roundSerial);
    await this._enqueueControl('properties',()=>{state.serverTime=this.wall();if(newCountdown)state.startAt=state.serverTime+3000;const properties=JSON.stringify(state);if(utf8Bytes(properties)>1536)throw error('房间信息过长');return {scope:'room',properties};});
    const sent=this._sendControl({k:'room',room:state});if(state.phase==='closed'){await sent;this._accept(state);}else{this._accept(state);await sent;}
  }
  async _publish(){if(!this.hostRoom)return;const state=clone(this.hostRoom);state.serverTime=this.wall();await this._sendControl({k:'room',room:state});this._accept(state);}
  _touch(seat){if(this.hostRoom)this.hostRoom.seen[seat]=this.wall();if(this.room)this.room.seen[seat]=this.wall()+this.clockOffset;}
  async action(body){
    if(!this.session||!this.room)throw error('请先加入房间');if(!this.connected)throw error('连接已中断，正在等待原房主恢复');
    let result;if(this.session.seat===0)result=await this._hostAction(0,body);else{
      const id=uuid();result=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(error('房主响应超时，请稍后重试'));},6500);this.pending.set(id,{resolve,reject,timer});this._sendControl({k:'request',id,epoch:this.room.epoch,body}).catch(e=>{clearTimeout(timer);this.pending.delete(id);reject(e);});});
    }
    if(body.type==='leave')await this.tap.leave();return result;
  }
  _hostAction(seat,body){const run=()=>this._mutate(seat,body);const result=this.mutations.then(run,run);this.mutations=result.catch(()=>{});return result;}
  async _mutate(seat,body){
    const r=clone(this.hostRoom),s=r.slots[seat];if(!s)throw error('你已离开房间');const fail=message=>{throw error(message);};
    if(body?.type==='leave'){
      if(['countdown','active','selecting'].includes(r.phase)){r.winner=1-seat;r.score[1-seat]=WIN_SCORE;r.phase='finished';r.reason='opponentLeft';s.returned=true;s.left=true;}
      else if(seat===0){r.phase='closed';r.reason='hostLeft';}else{r.slots[1]=null;r.guestId=null;}
    }else if(body?.type==='ready'){if(r.phase!=='waiting')fail('当前不能切换房间准备状态');s.ready=body.ready===true;
    }else if(body?.type==='start'){
      if(seat!==0)fail('只有房主可以开始游戏');if(r.phase!=='waiting')fail('游戏已经开始');if(!r.slots[1])fail('等待另一位玩家加入房间');if(!r.slots[1].ready)fail('玩家还未准备');
      Object.assign(r,{phase:'selecting',epoch:uuid(),score:[0,0],round:1,roundSerial:0,scene:SCENES[Math.floor(this.random()*3)],winner:null,lastWinner:null,reason:null});r.slots.forEach(p=>{p.locked=false;p.returned=false;});
    }else if(body?.type==='hero'){
      if(r.phase!=='selecting'||!HEROES.includes(body.hero))fail('当前不能选择这个英雄');if(s.hero!==body.hero){s.hero=body.hero;s.loadout=defaultDuelLoadout(body.hero);r.slots.forEach(p=>p.locked=false);}
    }else if(body?.type==='loadout'){
      if(r.phase!=='selecting')fail('只能在开战前选择技能');const chosen=validateDuelLoadout(s.hero,body.loadout);if(JSON.stringify(chosen)!==JSON.stringify(s.loadout)){s.loadout=chosen;r.slots.forEach(p=>p.locked=false);}
    }else if(body?.type==='lock'){
      if(r.phase!=='selecting')fail('当前不在英雄选择阶段');if(body.ready===true){const chosen=validateDuelLoadout(s.hero,body.loadout??s.loadout);if(JSON.stringify(chosen)!==JSON.stringify(s.loadout)){s.loadout=chosen;r.slots.forEach(p=>p.locked=false);}}s.locked=body.ready===true;
      if(r.slots.every(p=>p?.locked)){await this.tap.startFrame();r.phase='countdown';r.roundSerial=1;r.startAt=this.wall()+3000;}
    }else if(body?.type==='round'){
      if(seat!==0)fail('只有本局主机可以提交回合结果');if(body.epoch!==r.epoch||body.roundSerial!==r.roundSerial||!['countdown','active'].includes(r.phase))return this.room;if(this.wall()<r.startAt)fail('倒计时还未结束');
      const hp=body.hp;if(!Array.isArray(hp)||hp.length!==2||hp.some((n,i)=>!Number.isFinite(n)||n<0||n>MAX_HEALTH[r.slots[i].hero]))fail('无效的回合结果');const winner=hp[0]<=0&&hp[1]<=0?null:hp[0]<=0?1:hp[1]<=0?0:undefined;if(winner===undefined||winner!==body.winner)fail('回合尚未结束');
      r.lastWinner=winner;if(winner!==null)r.score[winner]++;if(r.score.some(n=>n>=WIN_SCORE)){r.winner=r.score[0]>=WIN_SCORE?0:1;r.phase='finished';r.reason='score';}else{r.round=1+r.score[0]+r.score[1];r.roundSerial++;r.phase='countdown';r.startAt=this.wall()+3000;}
    }else if(body?.type==='return'){
      if(r.phase!=='finished')fail('本场决斗还未结束');s.returned=true;if(r.slots.every(p=>p?.returned)){if(r.slots[0].left){r.phase='closed';r.reason='hostLeft';}else{if(r.slots[1].left){r.slots[1]=null;r.guestId=null;}r.phase='waiting';r.slots.forEach(p=>{if(p){p.ready=false;p.locked=false;p.returned=false;}});}}
    }else if(body?.type==='forfeit'){
      if(!['selecting','countdown','active'].includes(r.phase)||this.wall()-(r.seen[1-seat]||0)<30000)fail('对方仍在线，暂不能结束对局');r.winner=seat;r.score[seat]=WIN_SCORE;r.phase='finished';r.reason='disconnect';r.slots[1-seat].left=true;r.slots[1-seat].returned=true;
    }else fail('未知的房间操作');
    r.revision++;await this._commit(r);if(['finished','waiting','closed'].includes(r.phase)&&this.frameReady){await this.tap.stopFrame();this.frameReady=false;}return this.room;
  }
  setInput(packet){if(packet?.epoch===this.room?.epoch&&packet?.roundSerial===this.room?.roundSerial)this.input=packet;}
  sendActions(packet){this.setInput(packet);}
  setState(snapshot){if(this.session?.seat===0&&snapshot?.epoch===this.room?.epoch&&snapshot?.roundSerial===this.room?.roundSerial&&snapshot.ruleset===DUEL_RULESET&&duelSnapshotMatches(snapshot,this.room.slots))this.latestState=snapshot;}
  _sendControl(message){
    if(!this.connected)return Promise.reject(error('联机连接已断开'));
    const raw=JSON.stringify({v:1,protocol:PROTOCOL,build:this.build,ruleset:DUEL_RULESET,...message});if(utf8Bytes(raw)>2048)return Promise.reject(error('房间控制信息过长'));return this._enqueueControl('sendCustom',{data:raw});
  }
  _enqueueControl(method,payload){
    if(!this.connected)return Promise.reject(error('联机连接已断开'));if(this.controlQueue.length>=32)return Promise.reject(error('房间操作过于频繁，请稍候'));
    return new Promise((resolve,reject)=>{this.controlQueue.push({method,payload,resolve,reject});this._flushControls();});
  }
  async _flushControls(){
    if(this.controlBusy||!this.connected)return;this.controlBusy=true;try{while(this.controlQueue.length){const now=this.now();this.sentControls=this.sentControls.filter(t=>now-t<1000);if(this.sentControls.length>=12)break;const task=this.controlQueue.shift();this.sentControls.push(now);try{await this.tap[task.method](typeof task.payload==='function'?task.payload():task.payload);task.resolve();}catch(e){task.reject(e);}}}finally{this.controlBusy=false;}
  }
  async tick(){
    if(!this.running)return;this._flushControls();this.assembler.expire();const now=this.now();
    if(!this.connected){if(this.disconnectAt!==null&&now-this.disconnectAt>=30000&&this.room&&this.room.phase!=='closed'){this.room={...this.room,phase:'closed',reason:'hostUnavailable'};this.onRoom?.(this.room);}return;}
    if(now-this.lastHeartbeat>=1000&&this.session){this.lastHeartbeat=now;if(this.session.seat===0){this._touch(0);this._publish().catch(e=>this.onError?.(e.message));}else this._sendControl({k:'ping',time:this.wall()}).catch(e=>this.onError?.(e.message));}
    if(this.session?.seat===0&&this.room?.phase==='countdown'&&this.wall()>=this.room.startAt&&!this.activationBusy){this.activationBusy=true;const activate=async()=>{if(this.hostRoom?.phase!=='countdown'||this.wall()<this.hostRoom.startAt)return;const r=clone(this.hostRoom);r.phase='active';r.revision++;await this._commit(r);};this.mutations=this.mutations.then(activate,activate).catch(e=>this.onError?.(e.message)).finally(()=>{this.activationBusy=false;});}
    if(!this.frameReady||!['countdown','active'].includes(this.room?.phase))return;
    if(this.session.seat===0&&this.latestState&&!this.encodeBusy&&now-this.lastSnapshot>=100){this.lastSnapshot=Number.isFinite(this.lastSnapshot)?this.lastSnapshot+100*Math.floor((now-this.lastSnapshot)/100):now;this.encodeBusy=true;const state=this.latestState,generation=this.generation;encodeTapSnapshot(state).then(parts=>{if(this.running&&generation===this.generation)this.snapshots.offer(parts);}).catch(e=>this.onError?.(e.message)).finally(()=>{this.encodeBusy=false;});}
  }
  _clearFrameCredit(){this.sdkFrameId=-1;this.claimedFrameId=-1;this.frameSyncId=null;this.frameInFlight=0;this.frameGeneration++;}
  _sendFrameCredit(){
    if(!this.running||!this.connected||!this.frameReady||!['countdown','active'].includes(this.room?.phase)||this.sdkFrameId<0||this.sdkFrameId<=this.claimedFrameId||this.frameInFlight>=TAP_FRAME_MESSAGES)return;
    const available=TAP_FRAME_MESSAGES-this.frameInFlight,messages=[];
    try{if(this.input)messages.push(encodeTapInput(this.input));if(this.session.seat===0)messages.push(...this.snapshots.take(available-messages.length));}catch(e){this.onError?.(e.message);return;}
    if(!messages.length)return;
    const frameId=this.sdkFrameId,frameSyncId=this.frameSyncId,generation=this.frameGeneration,roundGeneration=this.generation;this.claimedFrameId=frameId;this.lastFrame=this.now();
    for(const data of messages){
      this.frameInFlight++;
      Promise.resolve().then(()=>{if(!this.running||!this.frameReady||generation!==this.frameGeneration||roundGeneration!==this.generation)return;return this.tap.sendFrame({data,frameId,frameSyncId});})
        .catch(e=>{if(generation===this.frameGeneration&&roundGeneration===this.generation&&this.session?.seat===0)this.snapshots.requeue([data]);if(!['staleFrame','backpressure'].includes(e?.code))this.onError?.(e.message);})
        .finally(()=>{if(generation===this.frameGeneration){this.frameInFlight=Math.max(0,this.frameInFlight-1);if(this.sdkFrameId>this.claimedFrameId)this._sendFrameCredit();}});
    }
  }
  async _event(event){
    if(!event||!this.running)return;
    if(event.type==='custom')return this._control(String(event.playerId),event.data);
    if(event.type==='frame'){
      if(!this.frameReady||!this.connected||!Number.isSafeInteger(event.id)||event.id<0||event.frameSyncId!==this.frameSyncId||event.id<=this.sdkFrameId||(event.roomId&&String(event.roomId)!==this.session?.code))return;
      this.sdkFrameId=event.id;this._sendFrameCredit();
      for(const input of (Array.isArray(event.inputs)?event.inputs:[]).slice(0,10)){
        const sender=String(input.playerId),data=input.data;if(sender===this.playerId)continue;
        if(this.session?.seat===0&&sender===this.hostRoom?.guestId){const packet=decodeTapInput(data);if(packet?.epoch===this.room.epoch&&packet.roundSerial===this.room.roundSerial){this.lastPacketAt=this.now();this._touch(1);this.onInput?.(packet);}}
        else if(this.session?.seat===1&&sender===this.session.hostId){const snapshot=await this.assembler.push(data);if(snapshot&&snapshot.ruleset===DUEL_RULESET&&duelSnapshotMatches(snapshot,this.room.slots)){this.lastStateAt=this.now();this.lastPacketAt=this.now();this._touch(0);this.resumeState=snapshot;this.onState?.(snapshot);}}
      }return;
    }
    if(event.roomId&&String(event.roomId)!==this.session?.code)return;
    if(event.type==='roomProperties'){const state=json(event.properties);if(this.session?.seat===1)this._accept(state);return;}
    if(event.type==='frameStart'){if(event.room?.id&&String(event.room.id)!==this.session?.code)return;if(event.room?.ownerId&&String(event.room.ownerId)!==this.session?.hostId){this._disconnected('原房主已变化，请重新创建房间');return;}if(event.frameSyncId===undefined||event.frameSyncId===null)return;if(this.frameReady&&event.frameSyncId===this.frameSyncId)return;this._clearFrameCredit();this.frameSyncId=event.frameSyncId;this.frameReady=true;this.connected=true;this.disconnectAt=null;this.transport='direct';this.onStatus?.();return;}
    if(event.type==='frameStop'){if(event.frameSyncId!==this.frameSyncId)return;this.frameReady=false;this._clearFrameCredit();this.snapshots.clear();if(['active','countdown'].includes(this.room?.phase))this.onError?.('帧同步已停止，请返回房间后重新开始');return;}
    if(event.type==='entered'&&this.session?.seat===0){const profile=json(event.player?.properties);if(profile)return this._admit(String(event.player.id),profile);}
    if(['offline','left','kicked'].includes(event.type)){
      const id=String(event.playerId||'');if(id===this.session?.hostId||id===this.playerId||(event.ownerId&&String(event.ownerId)!==this.session?.hostId)){this._disconnected('原房主已断线，等待恢复；不会将战斗权威交给其他玩家');return;}
      if(id===this.hostRoom?.guestId){if(this.room.phase==='waiting'){const r=clone(this.hostRoom);r.slots[1]=null;r.guestId=null;r.revision++;await this._commit(r);}else this.onError?.('对手已断线，等待恢复后继续');}return;
    }
    if(event.type==='disconnected')this._disconnected(event.message||'联机连接已断开，正在等待原连接恢复');
    if(event.type==='serviceError')this.onError?.(event.message||'TapTap 联机服务暂时不可用');
  }
  _disconnected(message){this.connected=false;this.frameReady=false;this._clearFrameCredit();this.input=null;this.snapshots.clear();this.disconnectAt??=this.now();this.transport='tap';this.onError?.(message);this.onStatus?.();}
  async _admit(playerId,profile){
    if(playerId===this.playerId)return;if(profile.protocol!==PROTOCOL||profile.build!==this.build||profile.ruleset!==DUEL_RULESET){await this._sendControl({k:'reject',target:playerId,message:'双方战斗版本不一致，请使用同一版客户端'});return;}
    const run=async()=>{const r=clone(this.hostRoom);if(r.guestId===playerId){await this._publish();return;}if(r.phase!=='waiting'||r.guestId){await this._sendControl({k:'reject',target:playerId,message:'房间已满或对局已开始'});return;}r.guestId=playerId;r.slots[1]=slot(profile);r.seen[1]=this.wall();r.revision++;await this._commit(r);};const result=this.mutations.then(run,run);this.mutations=result.catch(()=>{});return result;
  }
  async _control(sender,raw){
    if(typeof raw!=='string'||utf8Bytes(raw)>2048)return;const data=json(raw);if(data?.v!==1||data.protocol!==PROTOCOL||data.build!==this.build||data.ruleset!==DUEL_RULESET||sender===this.playerId)return;
    const received=(this.receivedControls.get(sender)||[]).filter(t=>this.now()-t<1000);if(received.length>=12)return;received.push(this.now());this.receivedControls.set(sender,received);while(this.receivedControls.size>4)this.receivedControls.delete(this.receivedControls.keys().next().value);
    if(this.session?.seat===0){
      if(data.k==='hello')return this._admit(sender,json(data.profile)||{});
      if(sender!==this.hostRoom?.guestId)return;this.lastPacketAt=this.now();this._touch(1);
      if(data.k==='request'){
        if(typeof data.id!=='string'||data.id.length>128)return;
        const key=sender+':'+data.id;let response=this.requestAcks.get(key);
        if(!response){response=(async()=>{try{if(data.epoch!==this.room.epoch)throw error('房间已经进入新的阶段');await this._hostAction(1,data.body);return {k:'ack',id:data.id,room:clone(this.hostRoom)};}catch(e){return {k:'ack',id:data.id,error:e.message};}})();this.requestAcks.set(key,response);while(this.requestAcks.size>64)this.requestAcks.delete(this.requestAcks.keys().next().value);}
        await this._sendControl(await response);return;
      }
      if(data.k==='ping'){await this._sendControl({k:'pong',time:data.time,serverTime:this.wall()});return;}if(data.k==='resync')return this._publish();
    }else if(sender===this.session?.hostId){
      if(data.k==='room')this._accept(data.room);
      if(data.k==='reject'&&data.target===this.playerId)this.admission?.reject(error(data.message||'无法加入房间'));
      if(data.k==='ack'){const pending=this.pending.get(data.id);if(!pending)return;clearTimeout(pending.timer);this.pending.delete(data.id);if(data.error)pending.reject(error(data.error));else{this._accept(data.room);pending.resolve(this.room);}}
      if(data.k==='pong'&&Number.isFinite(data.time)&&Number.isFinite(data.serverTime)){this.rtt=Math.max(0,this.wall()-data.time);this.clockOffset=data.serverTime-(data.time+this.rtt/2);this._touch(0);this.onStatus?.();}
    }
  }
  stop({forget=false}={}){
    this.running=false;this.connected=false;this.frameReady=false;this._clearFrameCredit();clearTimeout(this.timer);this.timer=null;this.generation++;this.input=null;this.latestState=null;this.snapshots.clear();this.listener?.remove?.();this.listener=null;
    const stopped=error('房间连接已停止');for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(stopped);}this.pending.clear();for(const p of this.controlQueue)p.reject(stopped);this.controlQueue=[];this.admission?.reject(stopped);this.sentControls=[];this.receivedControls.clear();this.requestAcks.clear();
    if(forget){this._forget();if(this.session)this.tap?.leave?.().catch(()=>{});this.session=null;this.room=null;this.hostRoom=null;}this.transport='tap';
  }
}
