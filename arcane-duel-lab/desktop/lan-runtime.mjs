import os from 'node:os';
import {createGameServer} from '../server/http-server.mjs';
import {localDatabase} from '../server/local-db.mjs';

export const LAN_PROTOCOL='arcane-duel-lan-v1',LAN_BUILD='campaign16-combat',LAN_PORT=44174;
export function privateIPv4(ip){
  const p=String(ip).split('.');if(p.length!==4||p.some(v=>!/^\d{1,3}$/.test(v)||Number(v)>255))return false;
  const [a,b]=p.map(Number);return a===10||a===127||(a===172&&b>=16&&b<=31)||(a===192&&b===168)||(a===169&&b===254);
}
export function hostAddress(value){
  const text=String(value||'').trim();let u;
  try{u=new URL(text.includes('://')?text:'http://'+text);}catch{throw new Error('请输入房主显示的IP地址，例如 192.168.1.8:44174');}
  if(u.protocol!=='http:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('请只填写房主的局域网IP和端口');
  const ip=u.hostname==='localhost'?'127.0.0.1':u.hostname;
  if(!privateIPv4(ip))throw new Error('此版本用于同一Wi-Fi或局域网，请填写局域网IPv4地址');
  const port=Number(u.port||LAN_PORT);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('端口需要在1～65535之间');
  return 'http://'+ip+':'+port;
}
export function lanAddresses(interfaces=os.networkInterfaces()){
  const found=[];
  for(const [name,items] of Object.entries(interfaces))for(const i of items||[])if((i.family==='IPv4'||i.family===4)&&!i.internal&&privateIPv4(i.address)&&!i.address.startsWith('127.')&&!found.some(a=>a.ip===i.address))found.push({name,ip:i.address});
  return found.sort((a,b)=>Number(/virtual|vmware|vethernet|docker|loopback/i.test(a.name))-Number(/virtual|vmware|vethernet|docker|loopback/i.test(b.name)));
}
const listen=(server,port,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve();});});
async function closeServer(server){if(!server)return;const done=new Promise(resolve=>server.close(resolve));server.closeAllConnections?.();await done;}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify(data));}
export class LanRuntime{
  constructor({root,uiPort=44173,hostBind='0.0.0.0',testMode=false}={}){Object.assign(this,{root,uiPort,hostBind,testMode});this.target=null;this.hostServer=null;this.controllers=new Set();}
  async start(){
    this.uiServer=createGameServer({root:this.root,db:null,handleRequest:(req,res,url)=>this.route(req,res,url)});
    await listen(this.uiServer,this.uiPort,'127.0.0.1');this.uiOrigin='http://127.0.0.1:'+this.uiServer.address().port;return this.uiOrigin;
  }
  async route(req,res,url){
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; media-src 'self' blob:; object-src 'none'; base-uri 'self'");
    if(url.pathname!=='/api/duel'&&!url.pathname.startsWith('/api/duel/'))return false;
    if(req.headers.origin&&req.headers.origin!==url.origin){json(res,{error:'不接受跨站请求'},403);return true;}
    if(!['GET','POST'].includes(req.method)){json(res,{error:'不支持的请求方法'},405);return true;}
    if(!this.target){json(res,{error:'请先在局域网联机页面创建或连接房主'},503);return true;}
    const controller=new AbortController();this.controllers.add(controller);const timer=setTimeout(()=>controller.abort(),5000);
    try{
      const chunks=[];let bytes=0;for await(const c of req){bytes+=c.length;if(bytes>220000){json(res,{error:'请求过大'},413);return true;}chunks.push(c);}
      const headers={'Content-Type':'application/json'};if(req.headers['x-duel-token'])headers['X-Duel-Token']=req.headers['x-duel-token'];
      const r=await fetch(this.target+url.pathname+url.search,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{}),signal:controller.signal,redirect:'error'});
      const text=await r.text();if(text.length>250000)throw new Error('Invalid host response');
      res.writeHead(r.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(text);
    }catch{if(!res.writableEnded)json(res,{error:'连接不到房主。请确认房主仍在运行、双方在同一网络，并允许游戏通过专用网络防火墙。'},503);}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
    return true;
  }
  state(){
    const hosting=!!this.hostServer,port=hosting?this.hostServer.address().port:null;
    const addresses=hosting?(this.testMode?[{name:'本机测试',ip:'127.0.0.1'}]:lanAddresses()).map(a=>({...a,address:a.ip+':'+port})):[];
    return {mode:hosting?'host':this.target?'guest':'offline',target:this.target,port,addresses,testMode:this.testMode,build:LAN_BUILD};
  }
  async stopHost(){const s=this.hostServer,db=this.hostDb;this.hostServer=null;this.hostDb=null;await closeServer(s);db?.close();}
  async host({port=LAN_PORT}={}){
    port=Number(port);if(!Number.isInteger(port)||(!(this.testMode&&port===0)&&port<1024)||port>65535)throw new Error('主机端口需要在1024～65535之间');
    await this.stopHost();this.target=null;
    const db=localDatabase(':memory:');
    const server=createGameServer({root:this.root,db,handleRequest:(req,res,url)=>{
      if(url.pathname!=='/lan-info')return false;
      if(req.method!=='GET'){json(res,{error:'不支持的请求方法'},405);return true;}
      json(res,{protocol:LAN_PROTOCOL,build:LAN_BUILD,name:'秘境决斗局域网主机'});return true;
    }});
    try{await listen(server,port,this.hostBind);}catch(e){db.close();throw new Error(e.code==='EADDRINUSE'?'主机端口已被占用，请在高级设置中换一个端口。':'无法启动主机：'+e.message);}
    this.hostServer=server;this.hostDb=db;this.target='http://127.0.0.1:'+server.address().port;return this.state();
  }
  async connect({address}={}){
    const target=hostAddress(address);
    if(this.hostServer&&Number(new URL(target).port)===this.hostServer.address().port&&['127.0.0.1',...lanAddresses().map(a=>a.ip)].includes(new URL(target).hostname))throw new Error('这是你自己的房主地址，请让另一台电脑加入。');
    let r,data;try{r=await fetch(target+'/lan-info',{signal:AbortSignal.timeout(4000),redirect:'error'});data=await r.json();}catch{throw new Error('连接不到房主。请核对地址、同一网络和房主的专用网络防火墙提示。');}
    if(!r.ok||data.protocol!==LAN_PROTOCOL||data.build!==LAN_BUILD)throw new Error('房主客户端版本不一致，请双方使用同一份游戏包。');
    await this.stopHost();this.target=target;return this.state();
  }
  async reset(){for(const c of this.controllers)c.abort();this.target=null;await this.stopHost();return this.state();}
  async close(){await this.reset();await closeServer(this.uiServer);this.uiServer=null;}
}
