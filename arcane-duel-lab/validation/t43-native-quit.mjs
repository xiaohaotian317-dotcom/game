import {_electron} from 'file:///C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {fileURLToPath} from 'node:url';import path from 'node:path';import {writeFile,rm,stat} from 'node:fs/promises';import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),release=path.join(root,'发行/秘境决斗-秘境征途-campaign17'),exe=path.join(release,'ArcaneDuelCampaign.exe'),qa='campaign17-quit',parent=path.join(release,'resources/app/desktop/.qa-profiles'),profile=path.join(parent,qa),report={version:'campaign17',qaInstance:qa,formalSavesTouched:false,nativeWindowVisualQA:false};
try{await stat(profile);throw Error('Refusing to replace an existing QA profile');}catch(e){if(e.code!=='ENOENT')throw e;}
let app;
try{
 app=await _electron.launch({executablePath:exe,args:['--qa-instance='+qa],timeout:30000});const page=await app.firstWindow();await page.waitForLoadState('networkidle');await page.locator('#title-screen [data-exit-app]').waitFor();
 report.bridge=await page.evaluate(()=>({quit:typeof window.arcaneDesktop?.quit,motion:window.arcaneDesktop?.motionVersion}));assert.equal(report.bridge.quit,'function');
 report.hiddenWindow=await app.evaluate(({BrowserWindow})=>!BrowserWindow.getAllWindows()[0].isVisible());assert.ok(report.hiddenWindow);
 const closed=app.waitForEvent('close');await page.locator('#title-screen [data-exit-app]').click();await closed;report.exitButtonClosedNativeApp=true;app=null;report.passed=true;console.log(JSON.stringify(report));
}finally{
 if(app)await app.close();assert.equal(path.dirname(path.resolve(profile)),path.resolve(parent));await rm(profile,{recursive:true,force:true});await writeFile(new URL('campaign17-native-quit.json',import.meta.url),JSON.stringify(report,null,2));
}

