import {cp,mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),host=path.join(root,'network-host');
await mkdir(path.join(host,'public'),{recursive:true});
// dist's native game sources remain authored files. Only client/server are generated.
for(const e of await readdir(path.join(root,'dist'),{withFileTypes:true}))if(!['client','server','.openai'].includes(e.name))await cp(path.join(root,'dist',e.name),path.join(host,'public',e.name),{recursive:true});
const result=spawnSync(process.execPath,[path.join(host,'scripts/run-framework.mjs'),'build'],{cwd:host,stdio:'inherit',env:process.env});if(result.status!==0)process.exit(result.status||1);
for(const dir of ['client','server'])await cp(path.join(host,'dist',dir),path.join(root,'dist',dir),{recursive:true});
await cp(path.join(host,'drizzle'),path.join(root,'drizzle'),{recursive:true});
const config=JSON.parse(await readFile(path.join(host,'.openai/hosting.json'),'utf8'));await mkdir(path.join(root,'dist/.openai'),{recursive:true});await writeFile(path.join(root,'dist/.openai/hosting.json'),JSON.stringify(config,null,2)+'\n');
console.log('Native game and room service built successfully.');
