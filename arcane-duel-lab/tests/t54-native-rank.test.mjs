import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),native=path.join(root,'mobile/native'),cache=path.join(native,'.cache/t54-rank-classes'),jdkRoot=path.resolve(root,'../.runtime-tools/android/jdk'),jdk=process.env.JAVA_HOME||(existsSync(jdkRoot)?path.join(jdkRoot,readdirSync(jdkRoot).find(n=>n.startsWith('jdk-'))||''):''),java=path.join(jdk,'bin/java.exe'),available=existsSync(java),json=path.join(native,'.cache/json.jar');
before(()=>{if(!available)return;mkdirSync(cache,{recursive:true});const r=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-cp',json,'-d',cache,path.join(native,'src/com/xiaohaotian/arcaneduel/TowerRankContract.java'),path.join(native,'testing/NativeTowerRankHarness.java')],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr||r.error?.message);});
const rankTest=(name,fn)=>test(name,{skip:available?false:'Requires existing local JDK'},fn);
function verify(cases){const r=spawnSync(java,['-cp',cache+path.delimiter+json,'com.xiaohaotian.arcaneduel.NativeTowerRankHarness'],{input:JSON.stringify(cases.map(([raw,display])=>[raw==null?null:String(raw),display]))+'\n',encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr||r.error?.message);return JSON.parse(r.stdout);}
rankTest('service numeric display verifies prize boundaries with either raw rank base',()=>{
 const cases=[];for(const rank of [1,2,10,11,50,51])cases.push([rank,String(rank)],[rank-1,String(rank)]);
 assert.deepEqual(verify(cases),[1,1,2,2,10,10,11,11,50,50,51,51]);
});
rankTest('missing, unranked, truncated or inconsistent service ranks cannot authorize prizes',()=>{
 const cases=[[null,null],[null,'1'],[0,null],[0,'0'],[-1,'1'],[0,'2'],[2,'1'],[1,'3'],[1,''],[1,' 1'],[1,'1 '],[1,'01'],[1,'+1'],[1,'1.0'],[1,'1e0'],[1,'1\n'],[999,'1000+'],[1,'第1名'],[1,'１']];
 assert.deepEqual(verify(cases),cases.map(()=>null));
});
rankTest('rank verification does not wrap signed long bounds or accept overflowing display numbers',()=>{
 assert.deepEqual(verify([['9223372036854775807','1'],['9223372036854775807','9223372036854775808'],[0,'10000000000000000000'],['9223372036854775806','9223372036854775807']]),[null,null,null,Number('9223372036854775807')]);
});
test('rank contract is shipped with identical canonical and Android bridge copies',()=>{
 for(const name of ['TapLeaderboardPlugin','TowerRankContract'])assert.equal(readFileSync(path.join(native,`src/com/xiaohaotian/arcaneduel/${name}.java`),'utf8'),readFileSync(path.join(root,`mobile/android/app/src/main/java/com/xiaohaotian/arcaneduel/${name}.java`),'utf8'));
 const build=readFileSync(path.join(root,'mobile/build-android.ps1'),'utf8');assert.ok(build.includes("'TowerRankContract'"));
});
