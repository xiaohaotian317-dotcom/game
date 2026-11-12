import {packager} from '@electron/packager';
import {readFile,writeFile,mkdir,cp,rm,readdir} from 'node:fs/promises';
import path from 'node:path';

const enemyPreview=process.argv.includes('--enemy-preview');
const campaignPreview=process.argv.includes('--campaign-preview');
const campaignVersion='campaign35';
if(enemyPreview&&campaignPreview)throw new Error('Choose one preview');
const desktop=import.meta.dirname,root=path.resolve(desktop,'..'),stage=path.join(desktop,'.build',campaignPreview?'campaign-app':enemyPreview?'enemy-app':'app');
const executable=campaignPreview?'ArcaneDuelCampaign':enemyPreview?'ArcaneDuelEnemies':'ArcaneDuel';
const buildRoot=path.join(desktop,'.build');
if(!stage.startsWith(buildRoot+path.sep))throw new Error('Invalid staging directory');
await rm(stage,{recursive:true,force:true});await mkdir(path.join(stage,'desktop'),{recursive:true});
const pkg=JSON.parse(await readFile(path.join(desktop,'package.json'),'utf8'));
await writeFile(path.join(stage,'package.json'),JSON.stringify({name:campaignPreview?'arcane-duel-campaign-preview':enemyPreview?'arcane-duel-enemy-preview':pkg.name,version:pkg.version,description:pkg.description,type:'module',main:'desktop/main.mjs',private:true},null,2));
for(const file of ['main.mjs','preload.cjs','lan-runtime.mjs'])await cp(path.join(desktop,file),path.join(stage,'desktop',file));
for(const folder of ['server','drizzle']){
 await mkdir(path.join(stage,folder),{recursive:true});
 for(const name of await readdir(path.join(root,folder)))if(name.endsWith(folder==='server'?'.mjs':'.sql'))await cp(path.join(root,folder,name),path.join(stage,folder,name));
}
const dist=path.join(root,'dist');
const lanBuild=(await readFile(path.join(desktop,'lan-runtime.mjs'),'utf8')).match(/\bLAN_BUILD=['"]([^'"]+)['"]/)?.[1];
const duelRuleset=(await readFile(path.join(dist,'src/duel-skill-data.mjs'),'utf8')).match(/\bDUEL_RULESET=['"]([^'"]+)['"]/)?.[1];
if(campaignPreview&&(!lanBuild||!duelRuleset))throw new Error('Missing shared LAN build / duel ruleset');
await cp(dist,path.join(stage,'dist'),{recursive:true,filter:source=>!['client','server','.openai'].includes(path.relative(dist,source).split(path.sep)[0])});
const output=await packager({dir:stage,out:path.join(buildRoot,campaignPreview?'campaign-out':enemyPreview?'enemy-out':'out'),name:executable,executableName:executable,platform:'win32',arch:'x64',electronVersion:pkg.devDependencies.electron,overwrite:true,asar:false,prune:false,appVersion:pkg.version,buildVersion:pkg.version,appCopyright:'秘境决斗',win32metadata:{CompanyName:'Arcane Duel',FileDescription:campaignPreview?'秘境决斗 · 秘境征途':enemyPreview?'秘境决斗 · 敌人交互试炼':'秘境决斗 · 单机与局域网',ProductName:'秘境决斗'}});
const notes=`秘境决斗 · Windows 单机与局域网版 v${pkg.version}

请先解压整个文件夹，再双击 ArcaneDuel.exe。不要只复制一个exe，旁边的resources等文件也必须保留。
不需要安装Node、GPT或浏览器插件；启动页、大厅、召唤、图鉴、角色检视和三境训练资源均在本地。
现有“单机闯关”入口仍进入训练/机关试炼，正式关卡目标与奖励尚未完成。

局域网联机：
1. 两台Windows电脑连接同一个Wi-Fi或有线局域网，使用相同版本。
2. 房主进入大厅→双人决斗→创建局域网房间。
3. 把房间内显示的“房主地址”和“房间号”告诉好友。
4. 好友在大厅→双人决斗→加入好友，填地址与房间号。
5. 挑战者准备，房主开始；双方选择英雄、搭配F/E/R技能并准备，倒计时3秒后开始，先到3分获胜。

若Windows弹出网络访问询问，请你确认允许游戏在专用网络通信。游戏不会自动修改系统防火墙。
访客Wi-Fi/校园网可能隔离设备；只在同一Wi-Fi下仍不保证设备互通，需要实际双机验收。
这版不提供异地网络打洞、手机端或正式账号；单机UI进度保存于本机。
F11切换全屏，Alt显示菜单；菜单中的“局域网连接”可以更换房主。

原网页版保持不变，本应用不通过原Sites地址加载资源或创建房间。
`;
await writeFile(path.join(output[0],'使用说明.txt'),enemyPreview?`秘境决斗 · 敌人交互试炼 enemies1\n\n解压整个文件夹后双击 ${executable}.exe，无需GPT、插件或Node。\n这版供你验收10种小怪与11位BOSS（新增骷髅王）的动画、血条、AI、主动连招与被动。\n选择英雄/地图/敌人，点击“与当前敌人交手”。AD移动、空格二段跳、鼠标攻击、FER技能、Shift冲刺。\n本版本启动直接进入敌人试炼，保留返回原大厅与原UI的入口；原网页版和旧Windows包没有覆盖。\n这是交互试炼，不是正式三波闯关；视觉、手感和平衡等待你的体验反馈。\n\nF11切换全屏，Alt显示菜单。完整资源已打包，单机试炼无需联网。\n局域网原流程保留，双设备验收尚未完成。` : notes,'utf8');
if(campaignPreview)await writeFile(path.join(output[0],'使用说明.txt'),await readFile(path.join(desktop,'campaign-release-notes.txt'),'utf8'),'utf8');
if(campaignPreview)await writeFile(path.join(output[0],'回退人物动作.cmd'),'@echo off\r\nstart "" "%~dp0ArcaneDuelCampaign.exe" --legacy-motion\r\n','utf8');
await writeFile(path.join(output[0],'版本信息.json'),JSON.stringify({version:pkg.version,build:campaignPreview?campaignVersion:enemyPreview?'enemies1':'desktop1',lanBuild,duelRuleset,motion:'v2',motionRollback:'--legacy-motion',electron:pkg.devDependencies.electron,platform:'win32-x64',includesOfflineAssets:true,requiresSites:false,enemies:campaignPreview?40:enemyPreview?21:undefined,stages:campaignPreview?20:undefined,challenges:campaignPreview?2:undefined,tutorials:campaignPreview?1:undefined,totalStageEntries:campaignPreview?23:undefined,bestiary:campaignPreview?{normal:20,boss:20}:undefined,crossplay:campaignPreview?{lan:['android','win32-x64'],requiresMatchedBuild:true,internetWindows:false,realDeviceQA:false}:undefined,saveTransfer:campaignPreview?{manualWholeSave:true,backupBeforeImport:true,cloudSave:false}:undefined},null,2),'utf8');
console.log(JSON.stringify({directory:output[0],exe:path.join(output[0],executable+'.exe'),version:pkg.version}));


