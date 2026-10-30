export class DuelLink{
  constructor(hooks={}){Object.assign(this,hooks);this.session=null;this.room=null;this.running=false;this.seq=0;this.latestState=null;this.input=null;this.signal=null;this.pc=null;this.channels={};this.transport='relay';this.rtt=0;this.clockOffset=0;this.signalBusy=false;this.generation=null;this.lastStateAt=0;this.lastPacketAt=performance.now();this.retryAt=0;this.syncSoon=false;}
  async request(path,body,token=this.session?.token){
    const begin=performance.now(),wall=Date.now(),controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),6500);
    try{const response=await fetch('/api/duel/'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{'X-Duel-Token':token}:{})},body:JSON.stringify(body),signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'连接房间失败');const elapsed=performance.now()-begin;if(data.room){const offset=data.room.serverTime-(wall+elapsed/2);this.clockOffset=this.room?this.clockOffset*.8+offset*.2:offset;}if(this.transport!=='direct'){this.rtt=elapsed;this.onStatus?.();}return data;}catch(e){if(e.name==='AbortError')throw new Error('网络响应超时，正在尝试恢复连接');throw e;}finally{clearTimeout(timeout);}
  }
  accept(room){
    if(this.room&&room.revision<this.room.revision)return;
    const epoch=this.room?.epoch;this.room=room;
    if(epoch&&epoch!==room.epoch){this.closePeer();this.latestState=null;this.input=null;this.signal=null;this.retryAt=0;}
    this.onRoom?.(room);this.maybeConnect();
  }
  async enter(kind,body){const data=await this.request(kind==='create'?'rooms':'join',body,null);this.session={code:data.room.code,token:data.token,seat:data.room.seat};try{sessionStorage.setItem('arcane-duel-room-v1',JSON.stringify(this.session));}catch{}this.accept(data.room);this.start();return data.room;}
  async resume(){let saved;try{saved=JSON.parse(sessionStorage.getItem('arcane-duel-room-v1'));}catch{}if(!saved?.code||!saved?.token)return false;this.session=saved;try{const data=await this.request('rooms/'+saved.code+'/sync',{resume:true});this.seq=data.relaySeq||0;this.resumeState=data.snapshot;if(saved.seat===0)this.latestState=data.snapshot;this.accept(data.room);this.start();return true;}catch{this.session=null;try{sessionStorage.removeItem('arcane-duel-room-v1');}catch{}return false;}}
  async action(body){const data=await this.request('rooms/'+this.session.code+'/action',body);this.accept(data.room);this.send('actions',{kind:'changed'});if(this.room.seat===0)this.send('actions',{kind:'room',room:{...data.room,seat:1}});this.syncSoon=true;return data.room;}
  start(){if(this.running)return;this.running=true;this.poll();this.pingTimer=setInterval(()=>{if(this.transport==='direct')this.send('motion',{kind:'ping',time:performance.now()});},1000);}
  async poll(){
    if(!this.running||!this.session)return;const started=performance.now();
    try{const body={epoch:this.room?.epoch,seq:++this.seq};if(this.signal)body.signal=this.signal;if(this.room?.seat===0&&this.latestState)body.snapshot=this.latestState;if(this.room?.seat===1&&this.input)body.input=this.input;
      const data=await this.request('rooms/'+this.session.code+'/sync',body);this.accept(data.room);this.lastServerAt=performance.now();
      if(data.input)this.receive({kind:'input',packet:data.input},false);if(data.snapshot)this.receive({kind:'state',snapshot:data.snapshot},false);
      if(data.signal)await this.receiveSignal(data.signal);this.onError?.(null);
    }catch(e){this.onError?.(e.message);}
    if(this.running){const interval=this.transport==='direct'?900:125,delay=this.syncSoon?0:Math.max(0,interval-(performance.now()-started));this.syncSoon=false;this.timer=setTimeout(()=>this.poll(),delay);}
  }
  setInput(packet){this.input=packet;if(this.transport==='direct')this.send('motion',{kind:'input',packet});}
  sendActions(packet){if(this.transport==='direct')this.send('actions',{kind:'input',packet});}
  setState(snapshot){this.latestState=snapshot;if(this.transport==='direct')this.send('motion',{kind:'state',snapshot});}
  send(name,data){const channel=this.channels[name];if(channel?.readyState!=='open'||channel.bufferedAmount>100000)return false;const raw=JSON.stringify(data);if(raw.length>60000)return false;try{channel.send(raw);return true;}catch{return false;}}
  receive(data,direct=true){
    if(data.kind==='ping'){this.send('motion',{kind:'pong',time:data.time});return;}
    if(data.kind==='pong'){this.rtt=Math.max(0,performance.now()-data.time);this.onStatus?.();return;}
    if(data.kind==='changed'){this.syncSoon=true;return;}
    if(data.kind==='room'&&this.session?.seat===1){this.accept({...data.room,seat:1});return;}
    const payload=data.snapshot||data.packet;if(payload?.epoch!==this.room?.epoch||payload?.roundSerial!==this.room?.roundSerial)return;
    if(this.transport==='direct'&&!direct&&performance.now()-this.lastPacketAt<500)return;
    this.lastPacketAt=performance.now();
    if(data.kind==='input'&&this.session?.seat===0)this.onInput?.(data.packet);
    if(data.kind==='state'&&this.session?.seat===1){this.lastStateAt=performance.now();this.onState?.(data.snapshot);}
  }
  attach(channel){
    this.channels[channel.label]=channel;channel.onmessage=e=>{try{this.receive(JSON.parse(e.data));}catch{}};
    channel.onopen=()=>{if(this.channels.motion?.readyState==='open'&&this.channels.actions?.readyState==='open'){this.transport='direct';this.onStatus?.();}};
    channel.onclose=()=>{this.transport='relay';this.syncSoon=true;this.onStatus?.();};
  }
  peer(){const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});this.pc=pc;pc.ondatachannel=e=>this.attach(e.channel);pc.onconnectionstatechange=()=>{if(pc!==this.pc)return;if(pc.connectionState==='disconnected')setTimeout(()=>{if(this.pc===pc&&pc.connectionState==='disconnected')this.closePeer();},3000);if(['failed','closed','disconnected'].includes(pc.connectionState)){this.transport='relay';this.retryAt=performance.now()+6000;this.syncSoon=true;this.onStatus?.();if(pc.connectionState==='failed'){pc.close();if(this.pc===pc)this.pc=null;}}};return pc;}
  async gather(pc){if(pc.iceGatheringState==='complete')return;await new Promise(resolve=>{const done=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',check);resolve();},check=()=>{if(pc.iceGatheringState==='complete')done();},timer=setTimeout(done,2500);pc.addEventListener('icegatheringstatechange',check);});}
  async maybeConnect(){
    if(this.session?.seat!==0||!this.room?.slots[1]||this.pc||this.signalBusy||performance.now()<this.retryAt||!globalThis.RTCPeerConnection)return;
    this.signalBusy=true;try{const epoch=this.room.epoch,pc=this.peer();this.generation=crypto.randomUUID();this.attach(pc.createDataChannel('motion',{ordered:false,maxRetransmits:0}));this.attach(pc.createDataChannel('actions',{ordered:true}));await pc.setLocalDescription(await pc.createOffer());await this.gather(pc);if(this.room.epoch!==epoch)return;this.signal={generation:this.generation,...pc.localDescription.toJSON()};this.syncSoon=true;}catch{this.closePeer();this.retryAt=performance.now()+6000;}finally{this.signalBusy=false;}
  }
  async receiveSignal(signal){
    if(!globalThis.RTCPeerConnection)return;
    if(this.session.seat===0){if(signal.generation===this.generation&&signal.type==='answer'&&this.pc&&!this.pc.remoteDescription)try{await this.pc.setRemoteDescription({type:'answer',sdp:signal.sdp});}catch{}return;}
    if(signal.type!=='offer'||signal.generation===this.generation||this.signalBusy)return;
    this.signalBusy=true;try{this.closePeer();this.generation=signal.generation;const pc=this.peer();await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});await pc.setLocalDescription(await pc.createAnswer());await this.gather(pc);this.signal={generation:this.generation,...pc.localDescription.toJSON()};this.syncSoon=true;}catch{this.closePeer();}finally{this.signalBusy=false;}
  }
  closePeer(){try{this.pc?.close();}catch{}this.pc=null;this.channels={};this.transport='relay';this.generation=null;this.signal=null;}
  stop({forget=false}={}){this.running=false;clearTimeout(this.timer);clearInterval(this.pingTimer);this.closePeer();if(forget)try{sessionStorage.removeItem('arcane-duel-room-v1');}catch{}}
}
