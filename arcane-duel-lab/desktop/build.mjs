import {packager} from '@electron/packager';
import {readFile,writeFile,mkdir,cp,rm,readdir} from 'node:fs/promises';
import path from 'node:path';

const enemyPreview=process.argv.includes('--enemy-preview');
const campaignPreview=process.argv.includes('--campaign-preview');
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
if(campaignPreview)await writeFile(path.join(output[0],'使用说明.txt'),`秘境决斗 · 秘境征途 campaign14

完整解压后双击 ArcaneDuelCampaign.exe，无需GPT、插件、Node或网络。请保留整个文件夹。
正常入口：主页面→开始游戏→大厅→单机闯关→世界图选关→选择1～2名已拥有角色→进入挑战。
AD移动、空格二段跳、鼠标普攻、FER技能、Shift冲刺、1/2切换、C拾取、传送门前X结算、P/Esc暂停、F11全屏。
本版沿用旧进度，不清档；新档仅焰术师，300金币、0券、2中金币箱与3中经验瓶。

本版变化：
• 双人决斗选定英雄后进入独立技能搭配页，六技能全部免费开放；F/E/R每行二选一，双方确认准备后开战。改选会取消双方准备，整场回合和重连保留搭配。
• 双人模式的雷行者和影刃同样近远兼备；复用单机18个扩展招式及原图特效，不带入单机成长/装备/经济。双方须使用campaign14（LAN构建campaign14-skill6）。

保留上版变化：
• 单机全关首领攻击降低15%，英雄最终生命提高15%（取整）、攻击提高20%，法力上限不变。每级仍生命5%/法力4%/攻击2%线性成长。
• 每只小怪7经验，分关金币6/8/9/11/14/16/20/24/29/35/43。前期升级更快，后期仍需回刷成长。
• 六职业36技能耗蓝在campaign12基础减少10%：F8.91/E14.85/R28.215，界面适度取整显示，衍生免费。基础自动回蓝为0，共享被动可以金币升级。
• 恢复掉率相对提高15%至4.025%，每关最多2件。附近按C直接恢复，不进背包；其他物品C拾取入包。
• 雷行者/影刃近战距离150/165，同时发射电弧拳弹/月弧双刃，近远两段不重复打同一目标。普通攻击挡墙，技能按技能规则穿地形。
• 每日任务：每天随机5个简单目标，任选3个完成领取100、100、300金币，共500。三个宝箱领取后打开。本机日期每日零点刷新，当天重启保留。
• 小/中/大宠物经验药水40/100/300经验，第5/7/9关起分别掉落对应档位。在背包选择已拥有灵宠喂养，5级/10级仍手动进化。
• 瞬移实际生效短窗口可躲直接伤害、持续伤害与附带控制；返回/切人不刷新无敌时限。
• 十一首领独立精制主题血条，敌人火池/牛魔领域/环境落火重新校准贴地与真实材质。
• 双人模式视野约拉远12%，镜头不随朝向突然甩动，修正客机同步回拉；关闭双人模式平移震屏，保留命中音效与停顿。

六人动作保留campaign12改进：职业待机/发力/收势、独立二段跳、连续头颈与发梢斗篷随动。
动作回退：退出当前游戏，再双击同目录“回退人物动作.cmd”，用原campaign11动作玩本版；关闭后正常双击exe恢复新动作。只改变动画，不改存档。

世界图左下可收缩侧栏和局内右上入口可打开角色、背包、技能、法器、灵宠、锻造炉与每日任务；面板打开暂停。
每人6技能，每行二选一到FER，学习/强化消耗金币。武器只加输出、盔甲只加生存。锻造一/二/三品各10枚对应灵石，3枚同阶灵石合成高一级。
第4关实物掉收妖镜，第6关掉御天剑；C拾取后装备。V捕捉，按住Q御剑。法器用金币升级，一次只装备一件。
第5/7/9关有更难的灵宠副本；三波和首领后出现野宠，压低生命后用镜捕捉。每次捕获资质略有不同，越后关卡总体越强。
最多一宠出战，同次关卡收放保留血蓝/CD；重进或重试关卡恢复满。幼体1技能，5/10级手动进化解锁下一技能，最终仍低于人物。

局域网：两台Windows连接同Wi-Fi/局域网并使用同版。大厅→双人决斗，房主创建后分享房主地址和房号，访客填写加入。访客准备→房主开始→双方选角→F/E/R每行二选一→双方准备→3秒倒计时，先3分获胜。
若系统询问，请自行按需允许专用网络通信；游戏不自动改防火墙。访客网络可能隔离设备，异地穿透/手机/云存档未完成。
原Sites网页、旧发行包和正式存档保留；本版未重新部署网站。自动逻辑与隔离UI验证不能替代真人难度、美术手感和真实双设备长局验收。
`,'utf8');
if(campaignPreview)await writeFile(path.join(output[0],'回退人物动作.cmd'),'@echo off\r\nstart "" "%~dp0ArcaneDuelCampaign.exe" --legacy-motion\r\n','utf8');
await writeFile(path.join(output[0],'版本信息.json'),JSON.stringify({version:pkg.version,build:campaignPreview?'campaign14':enemyPreview?'enemies1':'desktop1',motion:'v2',motionRollback:'--legacy-motion',electron:pkg.devDependencies.electron,platform:'win32-x64',includesOfflineAssets:true,requiresSites:false,enemies:enemyPreview||campaignPreview?21:undefined,stages:campaignPreview?11:undefined,bestiary:campaignPreview?{normal:10,boss:11}:undefined},null,2),'utf8');
console.log(JSON.stringify({directory:output[0],exe:path.join(output[0],executable+'.exe'),version:pkg.version}));


