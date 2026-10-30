import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {handleDuelRequest} from './rooms.mjs';

const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const pages=new Set(['lobby','duel','characters','skills']);
export function gameOrigin(value){
  if(!value)return null;
  const u=new URL(value);
  if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('PUBLIC_ORIGIN 必须是完整站点来源，例如 https://game.example.com');
  return u.origin;
}
export function createGameServer({root,db,publicOrigin=null}){
  root=path.resolve(root);publicOrigin=gameOrigin(publicOrigin);
  return http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,publicOrigin||'http://'+req.headers.host);
      if(url.pathname==='/healthz'&&req.method==='GET'){
        res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}).end(JSON.stringify({status:'ok'}));return;
      }
      if(url.pathname==='/api/duel'||url.pathname.startsWith('/api/duel/')){
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>220000){res.writeHead(413).end();return;}chunks.push(chunk);}
        const body=Buffer.concat(chunks).toString('utf8');
        const request=new Request(url,{method:req.method,headers:req.headers,...(['GET','HEAD'].includes(req.method)?{}:{body})});
        const response=await handleDuelRequest(request,db);
        res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());return;
      }
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405,{'Allow':'GET, HEAD'}).end();return;}
      let pathname=decodeURIComponent(url.pathname);
      const segments=pathname.split('/').filter(Boolean);
      if(segments.some(p=>p.startsWith('.'))||['server','client'].includes(segments[0])){res.writeHead(404).end('Not found');return;}
      if(segments.length===1&&pages.has(segments[0]))pathname='/'+segments[0]+'.html';
      const target=path.resolve(root,'.'+pathname);
      if(target!==root&&!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
      const info=await stat(target),file=info.isDirectory()?path.join(target,'index.html'):target;
      const data=await readFile(file);
      res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':data.length});
      res.end(req.method==='HEAD'?undefined:data);
    }catch(e){res.writeHead(e instanceof URIError?400:404).end('Not found');}
  });
}
