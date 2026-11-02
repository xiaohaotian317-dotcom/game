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
5. 挑战者准备，房主开始；双方选择英雄并准备，倒计时3秒后开始，先到3分获胜。

若Windows弹出网络访问询问，请你确认允许游戏在专用网络通信。游戏不会自动修改系统防火墙。
访客Wi-Fi/校园网可能隔离设备；只在同一Wi-Fi下仍不保证设备互通，需要实际双机验收。
这版不提供异地网络打洞、手机端或正式账号；单机UI进度保存于本机。
F11切换全屏，Alt显示菜单；菜单中的“局域网连接”可以更换房主。

原网页版保持不变，本应用不通过原Sites地址加载资源或创建房间。
`;
await writeFile(path.join(output[0],'使用说明.txt'),enemyPreview?`秘境决斗 · 敌人交互试炼 enemies1\n\n解压整个文件夹后双击 ${executable}.exe，无需GPT、插件或Node。\n这版供你验收10种小怪与11位BOSS（新增骷髅王）的动画、血条、AI、主动连招与被动。\n选择英雄/地图/敌人，点击“与当前敌人交手”。AD移动、空格二段跳、鼠标攻击、FER技能、Shift冲刺。\n本版本启动直接进入敌人试炼，保留返回原大厅与原UI的入口；原网页版和旧Windows包没有覆盖。\n这是交互试炼，不是正式三波闯关；视觉、手感和平衡等待你的体验反馈。\n\nF11切换全屏，Alt显示菜单。完整资源已打包，单机试炼无需联网。\n局域网原流程保留，双设备验收尚未完成。` : notes,'utf8');
if(campaignPreview)await writeFile(path.join(output[0],'使用说明.txt'),`秘境决斗 · 秘境征途 campaign6

先退出旧客户端，完整解压后双击 ArcaneDuelCampaign.exe，无需GPT、插件、Node或网络。
启动页→开始游戏→大厅→单机闯关→世界选关；战前底部图标显示实际掉落，悬停看用途。
初始仅焰术师，300金币、0抽奖券、2中金币箱与3中经验瓶；单机独立新存档。
右上角色/背包/技能/法器/灵宠/锻造炉，打开全部暂停。第4关首领掉落收妖镜，靠近按C拾取；第5/7/9关各有更难的独立宠物副本。
AD移动，空格二段跳，鼠标普攻，FER技能，Shift冲刺，C拾取，传送门前X结算，P暂停，F11全屏。
小怪每只5经验/5金币。等级较快增加，每级生命3%/法力2.5%/攻击2%线性加成，后期所需经验变大。
初始只学F；每人六技能、每行二选一到FER，学习/强化用金币，可强化5次。技能耗蓝，二段共冷却不重复耗蓝。
首领战利品需附近按C放入背包；宝箱与药水在背包使用。首关自选未拥有英雄宝箱仅一次。
新关首通必给抽奖券，重刷50%；选择未拥有目标，20抽内必得，未中的为补给，十连命中即停止并保留未花券。
武器只加输出，盔甲只加生存，分近战与法杖职业。锻造炉：点空位选择背包武器或盔甲，再选择对应灵石并确认升品（一/二/三品分别10小/10中/10高阶灵石）。旁边合成炉放3枚同阶灵石，预览后合成。
BOSS当前体型为原版79.2%，在campaign2基础伤害+50%、技能范围+30%；前次移速/频率/落速保留。
宠物副本先清三波与首领，再出现高攻击灵宠；削弱生命后装备收妖镜，初级420距离内按V，1.15秒摄取，6秒冷却。收妖镜装备生命+20，每级生命+5、捕捉率+1个百分点、范围+10、冷却−0.15秒。法宝最高10级，用金币升级。
初级镜满血12%，低血接近90%成功率；失败可重试，击败灵宠当次无法捕捉。成功收入独立灵宠背包。\n第6关首领掉落御天剑，按C拾取；装备攻击+3，按住Q鼠标引导落剑，松开停止；每级装备攻击+1/单剑伤害+3。\n御剑启动8法力/持续每秒6法力，最长3.6秒，结束后冷却8秒。切换法宝不会补血，一个法器槽一次装备一件。
三只幼宠改用简洁轮廓、大块色面，减少碎毛、饰品与碎光；局内和背包共用新版初形动作素材。
在灵宠面板选择一只出战；一次最多一只，可在本关回收或切换，自动跟随、跳台和攻击敌人。每种形态8帧走路，脚底锚点固定。
每次捕获会独立随机生命/法力/攻击（小幅±8%）；相同等级与形态，第9关灵狐强于第7关狮鹫，狮鹫强于第5关灵鹿。\n宠物独立生命/法力、自动使用已解锁技能；幼年1招，达到5级/10级在世界地图手动进化，各解锁一招，最终形态小于角色。\n同关回收、切换及重试保留生命与法力；首次打通新普通关卡、进入下一关时刷新，重刷旧关不刷新。捕捉野宠时同伴停手。
六英雄各新增3技能/独立华丽特效；随机平台疏密与形状、真实地面和无跳变锁镜。
原网站、旧发行包与PvP战斗数值保留。真人难度、主观美术与两设备联机仍待验收。
`,'utf8');
await writeFile(path.join(output[0],'版本信息.json'),JSON.stringify({version:pkg.version,build:campaignPreview?'campaign6':enemyPreview?'enemies1':'desktop1',electron:pkg.devDependencies.electron,platform:'win32-x64',includesOfflineAssets:true,requiresSites:false,enemies:enemyPreview||campaignPreview?21:undefined,stages:campaignPreview?11:undefined,bestiary:campaignPreview?{normal:10,boss:11}:undefined},null,2),'utf8');
console.log(JSON.stringify({directory:output[0],exe:path.join(output[0],executable+'.exe'),version:pkg.version}));


