// Tap frame messages are UTF-8 limited. No Node APIs: this also runs in Android WebView.
export const TAP_FRAME_BYTES=1000;
export const TAP_FRAME_MESSAGES=5;
export const TAP_SNAPSHOT_BYTES=180000;
export const TAP_MAX_PARTS=256;
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
const types=['attack','jump','dash','interact','q','e','r'];
export const utf8Bytes=value=>encoder.encode(value).byteLength;
const integer=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
const epochOK=e=>typeof e==='string'&&e.length>0&&utf8Bytes(e)<=128;
const contextOK=v=>epochOK(v?.epoch)&&integer(v?.roundSerial,0,1e6);
function parse(raw){if(typeof raw!=='string'||utf8Bytes(raw)>TAP_FRAME_BYTES)return null;try{const v=JSON.parse(raw);return v&&v.v===1&&epochOK(v.e)&&integer(v.r,0,1e6)?v:null;}catch{return null;}}
function bounded(n,min,max){return Math.max(min,Math.min(max,Number(n)||0));}
export function encodeTapInput(packet){
  if(!contextOK(packet)||!integer(packet.seq))throw Error('无效的联机输入');
  const p=packet.input||{},aim=p.aim||{},view=p.view;
  const held=[p.move>0?1:p.move<0?-1:0,p.attack===true?1:0,p.down===true?1:0,p.drop===true?1:0,Math.round(bounded(aim.x,0,2304)*10)/10,Math.round(bounded(aim.y,0,800)*10)/10];
  if(view&&['x','y','width','height'].every(k=>Number.isFinite(view[k])))held.push([bounded(view.x,0,2304),bounded(view.y,-720,800),bounded(view.width,400,1680),bounded(view.height,300,1400)].map(n=>Math.round(n*10)/10));
  const actions=(Array.isArray(packet.actions)?packet.actions:[]).filter(a=>integer(a?.id)&&types.includes(a.type)).slice(-24).map(a=>[a.id,types.indexOf(a.type)]);
  const raw=JSON.stringify({v:1,k:'i',e:packet.epoch,r:packet.roundSerial,q:packet.seq,p:held,a:actions});
  if(utf8Bytes(raw)>TAP_FRAME_BYTES)throw Error('输入数据超过帧通道上限');return raw;
}
export function decodeTapInput(raw){
  const v=parse(raw);if(!v||v.k!=='i'||!integer(v.q)||!Array.isArray(v.p)||v.p.length<6||v.p.length>7||!Array.isArray(v.a)||v.a.length>24)return null;
  const [move,attack,down,drop,x,y,view]=v.p;
  if(![-1,0,1].includes(move)||![attack,down,drop].every(n=>n===0||n===1)||![x,y].every(Number.isFinite)||x<0||x>2304||y<0||y>800)return null;
  if(v.a.some(a=>!Array.isArray(a)||a.length!==2||!integer(a[0])||!integer(a[1],0,types.length-1)))return null;
  const input={move,attack:!!attack,down:!!down,drop:!!drop,aim:{x,y}};
  if(view!==undefined){if(!Array.isArray(view)||view.length!==4||!view.every(Number.isFinite))return null;input.view={x:bounded(view[0],0,2304),y:bounded(view[1],-720,800),width:bounded(view[2],400,1680),height:bounded(view[3],300,1400)};}
  return {epoch:v.e,roundSerial:v.r,seq:v.q,input,actions:v.a.map(([id,type])=>({id,type:types[type]}))};
}
function toBase64(bytes){let raw='';for(let i=0;i<bytes.length;i+=8192)raw+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(raw);}
function fromBase64(raw){if(typeof raw!=='string'||!raw.length||raw.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error('无效的快照编码');const bin=atob(raw),bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);return bytes;}
async function transform(bytes,compress,limit){
  const Class=compress?globalThis.CompressionStream:globalThis.DecompressionStream;
  if(typeof Class!=='function')throw Error('当前设备缺少战斗压缩支持，请更新 Android System WebView');
  const stream=new Blob([bytes]).stream().pipeThrough(new Class('deflate')),reader=stream.getReader(),chunks=[];let length=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>limit){await reader.cancel();throw Error('战斗快照超过安全上限');}chunks.push(value);}}finally{reader.releaseLock();}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export async function encodeTapSnapshot(snapshot,{sequence=snapshot?.seq}={}){
  if(!contextOK(snapshot)||!integer(sequence))throw Error('无效的权威快照');
  const bytes=encoder.encode(JSON.stringify(snapshot));if(bytes.length>TAP_SNAPSHOT_BYTES)throw Error('战斗快照超过安全上限');
  const compressed=await transform(bytes,true,TAP_SNAPSHOT_BYTES),base64=toBase64(compressed);
  const common={v:1,k:'s',e:snapshot.epoch,r:snapshot.roundSerial,q:sequence,n:256,i:255,c:'d',z:bytes.length};
  // Base64 is ASCII. The envelope is measured in UTF-8, including a possible non-ASCII epoch.
  const room=TAP_FRAME_BYTES-utf8Bytes(JSON.stringify({...common,b:''})),chunkSize=Math.floor(room/4)*4;
  if(chunkSize<128)throw Error('快照标识过长');const count=Math.ceil(base64.length/chunkSize);if(count>TAP_MAX_PARTS)throw Error('快照分包过多');
  return Array.from({length:count},(_,i)=>JSON.stringify({...common,n:count,i,b:base64.slice(i*chunkSize,(i+1)*chunkSize)}));
}
export class TapSnapshotAssembler{
  constructor({ttl=2500,maxPending=2,now=()=>performance.now()}={}){this.ttl=ttl;this.maxPending=Math.min(4,Math.max(1,maxPending));this.now=now;this.context=null;this.pending=new Map();this.lastSequence=-1;}
  reset(epoch,roundSerial){this.context={epoch,roundSerial};this.pending.clear();this.lastSequence=-1;}
  expire(){const now=this.now();for(const [key,p] of this.pending)if(now-p.at>this.ttl)this.pending.delete(key);}
  async push(raw){
    this.expire();const v=parse(raw),context=this.context;
    if(!v||v.k!=='s'||!context||v.e!==context.epoch||v.r!==context.roundSerial||!integer(v.q)||v.q<=this.lastSequence||!integer(v.n,1,TAP_MAX_PARTS)||!integer(v.i,0,v.n-1)||v.c!=='d'||!integer(v.z,1,TAP_SNAPSHOT_BYTES)||typeof v.b!=='string'||!v.b.length||! /^[A-Za-z0-9+/]*={0,2}$/.test(v.b))return null;
    let p=this.pending.get(v.q);
    if(!p){while(this.pending.size>=this.maxPending)this.pending.delete(this.pending.keys().next().value);p={at:this.now(),n:v.n,z:v.z,parts:new Map(),bytes:0,decoding:false};this.pending.set(v.q,p);}
    if(p.n!==v.n||p.z!==v.z){this.pending.delete(v.q);return null;}
    if(p.parts.has(v.i)){if(p.parts.get(v.i)!==v.b)this.pending.delete(v.q);return null;}
    p.bytes+=v.b.length;if(p.bytes>TAP_SNAPSHOT_BYTES*1.4+4096){this.pending.delete(v.q);return null;}p.parts.set(v.i,v.b);
    if(p.parts.size!==p.n||p.decoding)return null;p.decoding=true;
    try{
      const base64=Array.from({length:p.n},(_,i)=>p.parts.get(i)).join(''),bytes=await transform(fromBase64(base64),false,TAP_SNAPSHOT_BYTES);
      if(bytes.length!==p.z||this.context!==context||this.now()-p.at>this.ttl||v.q<=this.lastSequence)return null;
      const snapshot=JSON.parse(decoder.decode(bytes));
      if(snapshot?.epoch!==context.epoch||snapshot?.roundSerial!==context.roundSerial||!integer(snapshot.seq)||snapshot.seq!==v.q)return null;
      this.lastSequence=v.q;for(const seq of this.pending.keys())if(seq<=v.q)this.pending.delete(seq);return snapshot;
    }catch{return null;}finally{this.pending.delete(v.q);}
  }
}
export class LatestTapSnapshots{
  constructor(){this.active=null;this.latest=null;this.newestKey=null;this.retryCounts=new Map();}
  key(raw){try{const p=JSON.parse(raw);return p.k==='s'?JSON.stringify([p.e,p.r,p.q]):null;}catch{return null;}}
  offer(parts){if(!Array.isArray(parts)||!parts.length||parts.some(p=>typeof p!=='string'||utf8Bytes(p)>TAP_FRAME_BYTES))throw Error('无效的快照帧');const key=this.key(parts[0]);if(key!==this.newestKey){this.newestKey=key;this.retryCounts.clear();}if(!this.active)this.active={parts,index:0};else this.latest=parts;}
  take(max=TAP_FRAME_MESSAGES){const result=[];while(result.length<max&&this.active){result.push(this.active.parts[this.active.index++]);if(this.active.index===this.active.parts.length){this.active=this.latest?{parts:this.latest,index:0}:null;this.latest=null;}}return result;}
  requeue(parts){
    // Retry only fragments of the newest offered state, at most twice per fragment.
    // A newer authority snapshot supersedes failed old fragments instead of growing a replay backlog.
    const retry=[];for(const raw of parts){if(typeof raw!=='string'||utf8Bytes(raw)>TAP_FRAME_BYTES||!this.newestKey||this.key(raw)!==this.newestKey)continue;const p=JSON.parse(raw),key=String(p.i),attempts=this.retryCounts.get(key)||0;if(attempts>=2)continue;this.retryCounts.set(key,attempts+1);retry.push(raw);}
    if(!retry.length)return false;
    const remaining=this.active&&this.key(this.active.parts[0])===this.newestKey?this.active.parts.slice(this.active.index):this.latest&&this.key(this.latest[0])===this.newestKey?this.latest:[];
    this.active={parts:[...new Set([...retry,...remaining])].slice(0,TAP_MAX_PARTS),index:0};if(this.latest&&this.key(this.latest[0])===this.newestKey)this.latest=null;return true;
  }
  clear(){this.active=null;this.latest=null;this.newestKey=null;this.retryCounts.clear();}
  get pendingSnapshots(){return Number(!!this.active)+Number(!!this.latest);}
}
