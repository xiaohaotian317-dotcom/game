import {BOSS_TUNING} from './enemy-tuning.mjs';
const hit=(name,style,damage,reach,extra={})=>({name,type:'melee',style,damage,reach,windup:.55,active:.18,recover:.38,...extra});
const shot=(name,style,damage,extra={})=>({name,type:'projectile',style,damage,windup:.75,active:.14,recover:.45,speed:360,...extra});
const field=(name,style,damage,extra={})=>({name,type:'zone',style,damage,windup:.9,active:.15,recover:.45,radius:80,life:1,...extra});
const plan=(id,name,kind,steps,cd)=>({id,name,kind,steps,cd});
const minion=(id,name,form,color,patterns,extra={})=>({id,name,chapter:2,form,color,hp:220,speed:125,w:27,h:140,visual:152,boss:false,patterns,...extra});
const boss=(id,name,form,color,patterns,passive,passiveText,extra={})=>({id,name,chapter:2,form,color,hp:Math.round(4500*BOSS_TUNING.health),speed:115*BOSS_TUNING.movement,w:65,h:250,visual:300,boss:true,patterns,passive,passiveText,trait:passiveText,...extra});
const blink=(name,style)=>({name,type:'teleport',style,windup:.8,warningTime:.45,active:.1,recover:.2,damage:0,offset:140});
const veil=(name,style,duration=1.8)=>({name,type:'veil',style,windup:.6,active:.12,recover:.16,damage:0,duration});
const wave=(name,style,damage,extra={})=>({name,type:'wave',style,damage,windup:.9,warningTime:.65,active:.15,recover:.65,speed:340,waveRadius:52,distance:600,...extra});
export const CHAPTER_TWO_ENEMIES={
 M11:minion('M11','锚甲蟹卫','crab','#8daeb1',[plan('anchor','锚钳重砸','melee',[hit('提钳','tide',11,110,{windup:.8}),hit('锚刃拖击','tide',10,140,{status:'snare',windup:.4})],2.8)],{w:39,h:100,visual:152,speed:90,trait:'锚钳重击后接拖刃，蓄力时离开正面。'}),
 M12:minion('M12','赤晶镰蛛','crystal','#d8a0a0',[plan('sickle','晶镰突袭','melee',[hit('贴地突扑','crystal',8,105,{type:'dash',speed:300,active:.25}),hit('晶镰上挑','crystal',12,118,{windup:.32})],2.4)],{w:35,h:105,visual:150,speed:165,trait:'贴地扑近后上挑，避开晶镰的第二段。'}),
 M13:minion('M13','菌铠尸卫','fungal','#adba8b',[plan('maul','菌斧震击','melee',[hit('举斧蓄力','spore',14,135,{windup:.9,status:'poison',recover:.65})],3.1)],{h:150,speed:83,visual:158,trait:'沉重菌铠下挥斧，命中附加孢毒。'}),
 M14:minion('M14','烬羽刃侍','bird','#c6a38b',[plan('feathers','双翼切入','melee',[hit('前羽刃','ash',9,110),hit('掠步斩','ash',10,125,{type:'dash',active:.22,speed:220,windup:.3})],2.3)],{h:150,speed:155,trait:'双羽刃分段追身，侧移躲过掠步斩。'}),
 M15:minion('M15','镜壳双刀卫','mirror','#c3c3df',[plan('mirrorblades','镜刃交错','melee',[hit('横刃','mirror',9,115),hit('交错斩','mirror',13,135,{windup:.38})],2.5)],{h:147,speed:148,trait:'两把镜刃先后斩落，第二击范围更长。'}),
 M16:minion('M16','时砂戟卫','scarab','#cbb47f',[plan('lance','沙戟贯穿','melee',[hit('架戟','chrono',10,170,{windup:.85,status:'snare'}),hit('回钩','chrono',12,130,{windup:.35})],2.9)],{w:32,h:155,speed:100,visual:165,trait:'长戟有较长前摇，贯穿附加短暂迟滞。'}),
 M17:minion('M17','契印咒师','cultist','#8db8b5',[plan('seal','迟发契印','range',[shot('追索契印','tide',9,{seeking:true,speed:280})],3.5),plan('glyph','脚下咒阵','special',[field('契印显现','tide',10,{radius:55,life:.6,delay:.9})],7)],{ranged:true,w:24,h:151,trait:'慢速契印短暂追踪，脚下咒阵有独立预警。'}),
 M18:minion('M18','棱镜晶巫','crystal','#b2badf',[plan('prism','折射晶矢','range',[shot('棱镜双矢','crystal',8,{shots:2,spread:.24,ricochet:1,speed:350})],3.2)],{ranged:true,h:153,trait:'晶矢可折射一次，借平台阻挡后仍需留意反向弹道。'}),
 M19:minion('M19','孢囊浮灯','spore','#b6bf8c',[plan('spore','孢囊抛洒','range',[shot('缓坠孢囊','spore',8,{lob:true,pool:true,status:'poison',windup:.9})],3.5)],{ranged:true,w:30,h:105,visual:137,speed:80,trait:'发出缓坠孢囊，落地留下短暂孢毒。'}),
 M20:minion('M20','雷铸钩卫','machine','#c4bca2',[plan('hookblade','钩刃连锁','melee',[hit('机关钩击','machine',11,125),hit('蓄电压击','machine',14,140,{windup:.4})],2.6),plan('cable','磁钩弹','range',[shot('磁钩穿刺','machine',10,{status:'snare',speed:440,windup:.8})],4.2)],{h:160,visual:165,speed:118,trait:'远程磁钩迟滞，靠近后接机关钩刃。'}),
 B12:boss('B12','深潮锚王','nautilus','#94c1c1',[
  plan('anchor','深潮锚刑','melee',[hit('横锚','tide',13,180),hit('回拖','tide',14,205,{windup:.32,status:'snare'}),hit('沉锚重判','tide',18,225,{windup:.75,recover:.85})],3),
  plan('undertow','裂潮推波','range',[wave('锚落裂潮','tide',12,{push:180})],4.4),
  plan('twinwake','双潮拍岸','special',[field('左潮起伏','tide',13,{offsetX:-140,push:180,radius:90,life:1.2}),field('右潮反涌','tide',15,{offsetX:140,push:-180,radius:90,life:1.2,windup:.4})],8)
 ],'潮压甲壳','抬冠巨锚暴君，锚击命中附加短暂迟滞；左右潮波向不同方向推开玩家。',{w:90,h:290,visual:350}),
 B13:boss('B13','裂晶巨蜥','crystal','#d5a4b5',[
  plan('crystalclaws','裂晶爪链','melee',[hit('前爪破晶','crystal',13,180),hit('尾晶扫击','crystal',17,235,{windup:.42})],2.9),
  plan('refract','棱晶折雨','range',[shot('折射晶束','crystal',12,{shots:4,spread:.19,ricochet:1,speed:410})],4.5),
  plan('burrow','潜晶突袭','special',[veil('遁入晶脉','crystal',1.7),blink('潜晶换位','crystal'),hit('破土挑击','crystal',20,190,{windup:.6,warningTime:.5,recover:.85})],8.5)
 ],'棱晶护甲','周期晶甲减伤20%；潜隐换位后破土挑击，留意锁定落点并在现身时反击。',{mechanic:'crystalArmor',w:90,h:180,visual:320}),
 B14:boss('B14','孢冠沼母','fungal','#b7c495',[
  plan('tendrils','腐藤双鞭','melee',[hit('菌鞭横扫','spore',13,200,{status:'poison'}),hit('冠须重击','spore',17,225,{windup:.4})],3.1),
  plan('miasma','游孢毒雾','range',[field('孢雾绽放','spore',10,{radius:110,life:3,status:'poison'})],5),
  plan('brood','菌群苏醒','special',[{name:'唤醒菌卫',type:'summon',spawnKind:'M13',style:'spore',windup:1.1,warningTime:.7,active:.2,recover:.7}],11),
  {...plan('renewal','菌根汲养','special',[{name:'扎根汲养',type:'heal',style:'spore',windup:.9,warningTime:.7,active:2.5,recover:.9,healFraction:.015}],15),healthBelow:.9}
 ],'孢冠寄生','攻击附加持续孢毒；菌根汲养缓慢回复6%生命，可趁引导打断；菌卫召唤有数量上限。',{w:65,h:265,visual:315}),
 B15:boss('B15','烬翼审判官','bird','#d2a481',[
  plan('judgment','烬翼三裁','melee',[hit('羽剑斜裁','ash',14,190),hit('踏翼追斩','ash',16,175,{type:'dash',speed:340,active:.26,windup:.38}),hit('焚城落刃','ash',21,230,{windup:.75,lava:true,recover:.9})],3.2),
  plan('featherrain','审判羽雨','range',[field('初裁羽雨','ash',13,{falling:true,radius:88,life:.4}),field('终裁羽雨','ash',16,{falling:true,radius:100,life:.5,windup:.45})],5),
  plan('pyre','烬途疾刑','special',[hit('焚痕冲裁','ash',19,145,{type:'dash',speed:430,active:.55,windup:.9,lava:true,recover:.8})],8.2)
 ],'余烬烙印','重击留下五秒焚痕；半血后移动间歇留下灼烧地带。',{mechanic:'cinders',h:265}),
 B16:boss('B16','千面镜姬','mirror','#c8c4de',[
  plan('shatterdance','千镜刃舞','melee',[hit('左镜刃','mirror',13,180),hit('右镜刃','mirror',14,195,{windup:.3}),hit('碎镜终舞','mirror',20,225,{windup:.62,recover:.8})],3),
  plan('moonmirror','对镜飞轮','range',[shot('对向镜轮','mirror',13,{shots:2,spread:.32,returning:true,speed:380})],4.6),
  plan('reflections','镜移幻刃','special',[veil('藏身镜幕','mirror',2),blink('镜中易位','mirror'),{name:'双面镜影',type:'clone',style:'mirror',windup:.85,warningTime:.7,active:.15,recover:.2},hit('现身斩','mirror',18,175,{windup:.65,warningTime:.5,recover:.8})],12)
 ],'千面回光','镜移时短暂隐身，攻击前显形；制造两具低血镜像，镜像可击破且八秒消散，不掉战利品。',{h:260,w:50,visual:305}),
 B17:boss('B17','时砂圣甲','scarab','#d2bb86',[
  plan('chronolance','王陵贯戟','melee',[hit('沙戟横拦','chrono',14,200),hit('停砂穿刺','chrono',18,245,{windup:.5,status:'snare'})],3),
  plan('hourglass','流砂四刻','range',[field('初刻','chrono',12,{offsetX:-120,status:'snare',life:2}),field('末刻','chrono',15,{offsetX:120,status:'snare',life:2,windup:.42})],5),
  plan('sandstep','时砂换步','special',[blink('沙漏倒转','chrono'),shot('贯日砂矛','chrono',18,{speed:510,windup:.7})],8)
 ],'迟滞沙域','沙阵命中限制移动；迟滞结束后仍可利用冲刺越过第二阵。',{w:85,h:225,visual:315}),
 B18:boss('B18','噬月螳皇','mantis','#c6d3e3',[
  plan('eclipseclaw','断月双镰','melee',[hit('下镰切入','moon',14,190,{type:'dash',speed:350,active:.2}),hit('上镰追斩','moon',17,220,{windup:.32}),hit('断月合镰','moon',21,240,{windup:.7,recover:.85})],3),
  plan('crescent','回轮月刃','range',[shot('噬月飞镰','moon',14,{returning:true,speed:420}),shot('逆月飞镰','moon',14,{returning:true,speed:360,windup:.35})],4.7),
  plan('moonfall','月蚀跃杀','special',[{name:'跃至月影',type:'leap',style:'moon',damage:22,reach:160,windup:.95,active:.9,recover:.9}],8.5)
 ],'月影猎势','半血后连招更快，回旋月刃在折返前有减速停顿。',{h:265,visual:320,speed:145*BOSS_TUNING.movement}),
 B19:boss('B19','雷铸巨像','machine','#c9c3a1',[
  plan('pistons','三段重压','melee',[hit('左臂压击','machine',15,195),hit('右臂压击','machine',17,215,{windup:.35}),hit('雷核重轰','machine',23,245,{windup:.85,recover:.95})],3.3),
  plan('beam','雷束连射','range',[shot('雷核直束','machine',15,{speed:620,windup:.9}),shot('续流直束','machine',13,{speed:620,windup:.32})],4.6),
  plan('conductors','雷柱连锁','special',[field('第一导雷柱','machine',14,{offsetX:-140,radius:70,life:.35}),field('第二导雷柱','machine',16,{offsetX:0,radius:70,life:.35,windup:.35}),field('第三导雷柱','machine',20,{offsetX:140,radius:80,life:.4,windup:.45})],8.5)
 ],'雷核过载','每三次命中迸发一次短促雷震；重拳前留有明显蓄力。',{mechanic:'overload',h:275,w:80,visual:325,speed:93*BOSS_TUNING.movement}),
 B20:boss('B20','蚀日双相王','astral','#d0ad8b',[
  plan('dualblades','双相王裁','melee',[hit('日刃','eclipse',15,195),hit('月裁','mirror',18,215,{windup:.35}),hit('蚀日重判','eclipse',24,250,{windup:.8,recover:.95})],3.1),
  plan('orbit','坠日轨轮','range',[shot('日轨飞轮','eclipse',15,{returning:true,shots:2,spread:.25,speed:390})],4.8),
  plan('blackcrown','蚀日王庭','special',[field('王庭引力','eclipse',12,{gravity:true,radius:120,life:2.8}),blink('双相易位','eclipse'),{name:'王陵援军',type:'summon',spawnKind:'M16',style:'eclipse',windup:1,active:.2,recover:.8}],11)
 ],'蚀日双相','半血后引力与双刃交替压制；召援不掉战利品。',{mechanic:'gravity',h:275,w:55,visual:325})
};
