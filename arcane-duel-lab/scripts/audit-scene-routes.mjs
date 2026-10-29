import {auditRoutes} from '../tests/route-audit.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const results=[];
for(const scene of ['moon','lava','garden'])for(const hero of ['fire','nature','frost','lightning','shadow','star']){
  const options=scene==='moon'?{brokenBridge:true}:scene==='garden'?{noVine:true}:{};
  const report=auditRoutes(hero,scene,options);results.push(report);console.log(scene,hero,'reachable',report.reachable.length,'unreachable',JSON.stringify(report.unreachable));
}
await mkdir(new URL('../validation/',import.meta.url),{recursive:true});
await writeFile(new URL('../validation/scene-route-audit.json',import.meta.url),JSON.stringify({notes:'Actual fixed-step physics; basic jumps only, no dash, skills, wind, spring or moving-lift assistance. Moon bridge removed; garden vine bridge removed.',results},null,2));
if(results.some(r=>r.unreachable.length))process.exitCode=1;
