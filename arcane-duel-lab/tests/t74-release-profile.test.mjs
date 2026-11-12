import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readdirSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url)),workspace=path.resolve(root,'..');
function groovyRuntime(){
 const jdkBase=path.join(workspace,'.runtime-tools/android/jdk');
 const portable=existsSync(jdkBase)?path.join(jdkBase,readdirSync(jdkBase).find(n=>n.startsWith('jdk-'))||''):'';
 const java=path.join(process.env.JAVA_HOME||portable,'bin',process.platform==='win32'?'java.exe':'java');
 const distributions=path.join(workspace,'.runtime-tools/android/gradle-cache/wrapper/dists/gradle-8.14.3-all');
 if(!existsSync(java)||!existsSync(distributions))return null;
 for(const entry of readdirSync(distributions)){
  const jar=path.join(distributions,entry,'gradle-8.14.3/lib/groovy-3.0.24.jar');
  if(existsSync(jar))return {java,jar};
 }
 return null;
}

test('actual Gradle profile defaults to enforced TapTap and rejects ambiguous profiles without reading private credentials',t=>{
 const runtime=groovyRuntime();if(!runtime){t.skip('Bundled JDK and Gradle Groovy are required for policy execution');return;}
 const scratch=mkdtempSync(path.join(tmpdir(),'arcane-t74-profile-'));
 try{
  const harness=path.join(scratch,'ReleaseProfileHarness.groovy');
  writeFileSync(harness,`class GradleException extends RuntimeException { GradleException(String message){super(message)} }
def policyFile=new File(args[0]), appFile=new File(args[1]), scratch=new File(args[2])
def policy={ Object input ->
 def extra=[:], binding=new Binding([project:[findProperty:{String key->key=='arcaneReleaseProfile'?input:null}],ext:extra])
 new GroovyShell(this.class.classLoader,binding).evaluate(policyFile)
 extra.arcaneReleaseProfile
}
assert policy(null)==[name:'taptap',complianceRequired:true]
assert policy('TapTap')==[name:'taptap',complianceRequired:true]
assert policy(' preview ')==[name:'preview',complianceRequired:false]
['',false,'false','production','taptapp'].each { value ->
 boolean rejected=false
 try { policy(value) } catch(IllegalArgumentException expected){rejected=true}
 assert rejected:'Ambiguous profile must stop configuration'
}
// Execute the app's real pre-Android configuration and its real safety fields.
// rootProject.file is mapped to fresh fixture files, never mobile/.private.
def app=appFile.getText('UTF-8'), prefix=app.substring(0,app.indexOf('\\nandroid {'))
def fieldLines=app.readLines().findAll{it.contains('buildConfigField')&&(it.contains('"RELEASE_PROFILE"')||it.contains('"COMPLIANCE_REQUIRED"'))}.join('\\n')
assert fieldLines.readLines().size()==2
def configure={ Object input, boolean credentials, String legacy ->
 def tapFile=new File(scratch,'tap.properties')
 tapFile.setText((credentials?'clientId=fixture-client\\nclientToken=fixture-token\\n':'')+'complianceRequired='+legacy+'\\n','UTF-8')
 def extra=[:], fields=[:], project=[ext:extra,findProperty:{String key->key=='arcaneReleaseProfile'?input:null}]
 def binding=new Binding([project:project,ext:extra,buildConfigField:{String type,String key,Object value->fields[key]=[type,value]}])
 binding.setVariable('rootProject',[file:{String name->
  if(name=='../release-profile.gradle')return policyFile
  if(name=='../.private/taptap.properties')return tapFile
  new File(scratch,'unused-'+new File(name).name)
 }])
 binding.setVariable('apply',{Map request->if(request.from)new GroovyShell(this.class.classLoader,binding).evaluate(request.from)})
 new GroovyShell(this.class.classLoader,binding).evaluate(prefix+'\\n'+fieldLines)
 fields
}
assert configure(null,true,'false').COMPLIANCE_REQUIRED==['boolean','true']
assert configure('taptap',true,'false').RELEASE_PROFILE==['String','"taptap"']
assert configure('preview',true,'true').COMPLIANCE_REQUIRED==['boolean','false']
assert configure('preview',false,'false').RELEASE_PROFILE==['String','"preview"']
boolean missingRejected=false
try { configure('taptap',false,'false') } catch(GradleException expected){missingRejected=true;assert !expected.message.contains('fixture-token')}
assert missingRejected:'A TapTap build must stop if official app credentials are missing'
println 'Real Gradle policy/default, invalid profile, legacy override, credential isolation and BuildConfig checks passed'
`,'utf8');
  const run=spawnSync(runtime.java,['-cp',runtime.jar,'groovy.ui.GroovyMain',harness,path.join(root,'mobile/release-profile.gradle'),path.join(root,'mobile/android/app/build.gradle'),scratch],{encoding:'utf8',windowsHide:true,timeout:30000});
  assert.equal(run.status,0,run.stderr||run.error?.message);assert.match(run.stdout,/Real Gradle policy\/default/);
 }finally{
  assert.ok(path.resolve(scratch).startsWith(path.resolve(tmpdir())+path.sep+'arcane-t74-profile-'));rmSync(scratch,{recursive:true,force:true});
 }
});

test('the documented build entry explicitly passes its selected profile while preserving application identity and signing source',()=>{
 const build=readFileSync(path.join(root,'mobile/build-android.ps1'),'utf8'),app=readFileSync(path.join(root,'mobile/android/app/build.gradle'),'utf8');
 assert.match(build,/\[ValidateSet\('TapTap','Preview'\)\]\[string\]\$Profile='TapTap'/);
 assert.ok(build.includes('"-ParcaneReleaseProfile=$($Profile.ToLowerInvariant())"'));
 assert.ok(app.includes('applicationId "com.xiaohaotian.arcaneduel"'));
 assert.ok(app.includes("storeFile rootProject.file('../.private/arcane-duel-release.jks')"));
 assert.ok(!app.includes('getProperty("complianceRequired"'));
});
