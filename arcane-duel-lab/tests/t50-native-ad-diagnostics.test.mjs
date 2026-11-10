import test,{before} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url)),native=path.join(root,'mobile/native'),cache=path.join(native,'.cache/ads-diagnostics-classes'),jdkRoot=path.resolve(root,'../.runtime-tools/android/jdk'),jdk=process.env.JAVA_HOME||(existsSync(jdkRoot)?path.join(jdkRoot,readdirSync(jdkRoot).find(n=>n.startsWith('jdk-'))||''):''),java=path.join(jdk,'bin/java.exe'),available=existsSync(java);
before(()=>{if(!available)return;mkdirSync(cache,{recursive:true});const r=spawnSync(path.join(jdk,'bin/javac.exe'),['-encoding','UTF-8','-d',cache,path.join(native,'src/com/xiaohaotian/arcaneduel/AdReceiptGate.java'),path.join(native,'testing/NativeAdDiagnosticsHarness.java')],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);});
const nativeTest=(name,fn)=>test(name,{skip:available?false:'Requires existing local JDK'},fn),encode=s=>Buffer.from(s).toString('base64');
function diagnostic(message,{code=400,phase='load',secrets=[]}={}){const r=spawnSync(java,['-cp',cache,'com.xiaohaotian.arcaneduel.NativeAdDiagnosticsHarness',phase,code===null?'none':String(code),encode(message),...secrets.map(encode)],{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}

nativeTest('SDK HTTP and business codes and useful explanations survive without inventing a diagnosis',()=>{
 for(const code of [0,400,10008,-7]){const d=diagnostic('HTTP 400 Server error code: 10008. Placement does not belong to media',{code});assert.equal(d.code,code);assert.equal(d.phase,'load');assert.match(d.message,/HTTP 400 Server error code: 10008/);assert.match(d.message,/Placement does not belong to media/);assert.equal(d.completedAfterFailure,false);assert.equal(d.receiptAfterFailure,'');}
 const noCode=diagnostic('Playback callback supplied no error code',{code:null,phase:'video'});assert.equal(noCode.code,null);assert.equal(noCode.phase,'video');
});
nativeTest('public diagnostics remove known credentials, full URLs, IPs and opaque request identifiers',()=>{
 const secret='Sensitive-Media-Key-Without-Digits',uuid='f47ac10b-58cc-4372-a567-0e02b2c3d479',hex='aa1234bb5678cc90dd1234ee5678ff90',longId='Rj9fE12lkS3hQ89dfTr65W21',message=`HTTP 400 invalid media key ${secret}; endpoint=https://user:pass@ads.example.cn/v1/load?token=keep-private&request_id=abc; peer=203.0.113.42 IPv6=2001:db8::99; request_id=short-id trace_id='with spaces'; ${uuid} ${hex} ${longId} number=987654321012345`;
 const d=diagnostic(message,{secrets:[secret]});for(const privateValue of [secret,'https://','user:pass','ads.example.cn','keep-private','203.0.113.42','2001:db8::99','short-id','with spaces',uuid,hex,longId,'987654321012345'])assert.ok(!d.message.includes(privateValue),privateValue);assert.match(d.message,/HTTP 400 invalid media key/);assert.ok([...d.message].length<=320);
});
nativeTest('quoted JSON identity fields, control characters and oversized Unicode messages are bounded and safe',()=>{
 const d=diagnostic('{"mediaKey":"secret-value", "requestId":"short", "ip":"127.0.0.1", "oaid":"device"}\n\u0000\u202e '+ '验证失败🔥'.repeat(300));for(const privateValue of ['secret-value','short','127.0.0.1','device','\n','\u0000','\u202e'])assert.ok(!d.message.includes(privateValue),privateValue);assert.ok([...d.message].length<=320);assert.match(d.message,/…$/);assert.equal(d.phase,'load');assert.equal(diagnostic('useful text',{phase:'\nraw-phase-token'}).phase,'unknown');
});
test('both SDK load callbacks retain message, status is inert, foreground precedes init and native copies match',()=>{
 const plugin=readFileSync(path.join(native,'src/com/xiaohaotian/arcaneduel/AdsPlugin.java'),'utf8');assert.equal((plugin.match(/fail\(a,"loadFailed",code,message\)/g)||[]).length,2);assert.match(plugin,/value\.put\("lastFailure",diagnosticJson\(lastFailure\)\)/);assert.match(plugin,/appendError\(out,a\.failure\)/);assert.ok(plugin.indexOf('if(!initialized&&!usableActivity())')<plugin.indexOf('TapAdSdk.init('));assert.ok(!plugin.slice(plugin.indexOf('private JSObject statusJson()'),plugin.indexOf('@PluginMethod public void consent')).includes('TapAdSdk.init'));assert.doesNotMatch(plugin,/Log\.|System\.out|printStackTrace/);for(const name of ['AdsPlugin','AdReceiptGate'])assert.equal(readFileSync(path.join(native,`src/com/xiaohaotian/arcaneduel/${name}.java`),'utf8'),readFileSync(path.join(root,`mobile/android/app/src/main/java/com/xiaohaotian/arcaneduel/${name}.java`),'utf8'));
});
