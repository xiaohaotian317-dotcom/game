import {readFile,writeFile,mkdir,readdir,cp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {build} from '../mobile/node_modules/esbuild/lib/main.js';
const root=path.resolve(import.meta.dirname,'..'),dist=path.join(root,'dist'),out=path.join(root,'mobile/web');
if(!out.startsWith(path.join(root,'mobile')+path.sep))throw Error('Invalid output');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
async function walk(dir){const all=[];for(const f of await readdir(dir,{withFileTypes:true})){if(['client','server','.openai'].includes(f.name))continue;const full=path.join(dir,f.name);if(f.isDirectory())all.push(...await walk(full));else all.push(full);}return all;}
const files=await walk(dist),textFiles=files.filter(f=>/\.(mjs|css|html|json)$/.test(f)),texts=await Promise.all(textFiles.map(f=>readFile(f,'utf8'))),allText=texts.join('\n'),excluded=[],manifest=[],entries={};
for(let i=0;i<files.length;i++){
 const f=files[i],rel=path.relative(dist,f).replaceAll('\\','/'),name=path.basename(f);
 if(/\.(py|ps1|txt|md|map)$/.test(f)||rel.includes('/__qa/')||rel.startsWith('__qa/')){excluded.push(rel);continue;}
 if(rel.startsWith('src/'))continue;
 // Dynamic atlas paths are covered by metadata and loader families. Only remove
 // demonstrably obsolete image revisions; never delete original source artwork.
 const legacy=/^assets\/(?:heroes|refined-skills|pets|campaign-growth)\/.+-v[12]\.png$/.test(rel)&&!allText.includes(name);
 if(legacy&&!/\/heroes\/(?:frost|lightning|shadow|star)-(?:rig|fx)-v[12]\.png$/.test(rel)){excluded.push(rel);continue;}
 await mkdir(path.dirname(path.join(out,rel)),{recursive:true});
 if(f.endsWith('.html')){
  let html=await readFile(f,'utf8');
  for(const match of html.matchAll(/<script\b[^>]*\bsrc="([^"?]+)(?:\?[^\"]*)?"/g)){const src=match[1];if(src.endsWith('.mjs'))entries[src.replace(/\.mjs$/,'')]=path.join(dist,src);}
  html=html.replace(/(<script\b[^>]*\bsrc="[^"?]+)\?[^\"]*(")/g,'$1$2').replace('</head>','<link rel="stylesheet" href="mobile-layout.css"><link rel="stylesheet" href="mobile-controls.css"><link rel="stylesheet" href="mobile-controls-art.css"><script type="module" src="src/mobile-bootstrap.mjs"></script></head>');
  html=html.replace(/content="width=device-width,initial-scale=1"/,'content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"');
  await writeFile(path.join(out,rel),html);
 }else await cp(f,path.join(out,rel));
}
entries['src/duel-worker']=path.join(dist,'src/duel-worker.mjs');
entries['src/mobile-bootstrap']=path.join(root,'mobile/bootstrap.mjs');
const result=await build({entryPoints:entries,outdir:out,bundle:true,splitting:true,format:'esm',platform:'browser',target:'chrome100',entryNames:'[dir]/[name]',chunkNames:'chunks/[name]-[hash]',outExtension:{'.js':'.mjs'},metafile:true,logLevel:'warning',plugins:[{name:'strip-source-cache-queries',setup(b){b.onResolve({filter:/\?v=/},args=>({path:path.resolve(args.resolveDir,args.path.split('?')[0])}));}}]});
await cp(path.join(root,'mobile/unsupported.html'),path.join(out,'mobile-unsupported.html'));
for(const file of await walk(out)){const bytes=await readFile(file);manifest.push({path:path.relative(out,file).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
await writeFile(path.join(root,'validation/android1-web-manifest.json'),JSON.stringify({build:'android1-crossplay-v3',createdAt:new Date().toISOString(),bytes:manifest.reduce((s,f)=>s+f.bytes,0),files:manifest,excluded,inputs:Object.keys(result.metafile.inputs)},null,2));
console.log(JSON.stringify({files:manifest.length,bytes:manifest.reduce((s,f)=>s+f.bytes,0),excluded:excluded.length,out}));
