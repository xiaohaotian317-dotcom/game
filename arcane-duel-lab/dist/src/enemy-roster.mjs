import {CHAPTER_TWO_ENEMIES} from './chapter-two-enemies.mjs';
import {BOSS_TUNING} from './enemy-tuning.mjs';
// Enemy definitions are independent of the encounter used to place them.
const strike=(name,style,damage=12,reach=100,extra={})=>({name,type:'melee',style,damage,reach,windup:.48,active:.16,recover:.32,...extra});
const bolt=(name,style,damage=10,extra={})=>({name,type:'projectile',style,damage,windup:.65,active:.12,recover:.42,speed:360,shots:1,spread:.18,...extra});
const zone=(name,style,damage=10,extra={})=>({name,type:'zone',style,damage,windup:.85,active:.12,recover:.5,radius:76,life:3,...extra});
const pattern=(id,name,kind,steps,cd=2)=>({id,name,kind,steps,cd});
const m=(id,name,form,hp,speed,w,h,color,patterns,extra={})=>({id,name,form,hp,speed,w,h,color,patterns,boss:false,visual:136,...extra});
const b=(id,name,form,hp,speed,w,h,color,patterns,trait,extra={})=>({id,name,form,hp:Math.round(hp*BOSS_TUNING.health),speed:speed*BOSS_TUNING.movement,w,h,color,patterns,boss:true,visual:285,trait,...extra});
const double=(style,damage=13,reach=155)=>[strike('前击',style,damage,reach),strike('连击',style,damage,reach,{windup:.32}),strike('终结',style,damage+5,reach+25,{windup:.62,recover:.68})];
export const ENEMIES={
 M01:m('M01','毒蝎人','scorpion',85,116,24,93,'#c5a25b',[pattern('tail','钳击接尾刺','melee',[strike('钳击','claw',9,85),strike('毒尾刺','venom',12,128,{status:'poison',windup:.6})],2)]),
 M02:m('M02','蜘蛛人','spider',72,146,35,78,'#c5a2de',[pattern('pounce','突扑双刃','melee',[strike('压低突扑','web',9,100,{type:'dash',speed:325,active:.27}),strike('前足刺击','slash',8,88,{windup:.36})],2.1)]),
 M03:m('M03','夜翼蝙蝠','bat',44,168,22,56,'#c8b4db',[pattern('dive','收翼俯冲','melee',[strike('俯冲撕咬','sonic',10,82,{type:'dash',speed:350,active:.32,windup:.62})],2)],{flying:true,visual:125}),
 M04:m('M04','铁角蛮牛','bull',145,85,32,112,'#bba38b',[pattern('hammer','重锤砸击','melee',[strike('举锤重砸','rock',18,130,{windup:.9,recover:.75})],2.5)] ,{visual:158}),
 M05:m('M05','螳刃妖','mantis',62,185,23,101,'#b9cf83',[pattern('blades','双镰连斩','melee',[strike('第一镰','slash',7,100,{windup:.48}),strike('回身镰','slash',9,112,{windup:.3})],1.8)]),
 M06:m('M06','墓甲骷卫','skeleton',110,96,25,91,'#d3c6a9',[pattern('bash','盾击接刺','melee',[strike('盾击','bone',9,90),strike('短剑刺','slash',11,105,{windup:.36})],2.2)]),
 M07:m('M07','毒液蛇女','serpent',76,108,28,95,'#b8d47c',[pattern('spit','口喷毒液','range',[bolt('毒液喷吐','venom',7,{status:'poison',pool:true,speed:330})],2.8)],{ranged:true,visual:150}),
 M08:m('M08','蛛囊投手','sac',68,82,32,65,'#d3ce73',[pattern('lob','毒囊抛射','range',[bolt('毒囊弹','venom',7,{lob:true,pool:true,status:'poison',windup:.9})],3.2)],{ranged:true,visual:130}),
 M09:m('M09','枯枝鸦巫','raven',68,103,22,101,'#bb9de3',[pattern('feather','暗羽投射','range',[bolt('三片暗羽','feather',8,{shots:3,spread:.13,speed:310})],2.8)],{ranged:true}),
 M10:m('M10','锁链蜥卫','lizard',170,122,30,112,'#91b7cc',[pattern('axe','钩斧连击','melee',double('slash',9,105).slice(0,2),2.3),pattern('hook','掷钩','range',[bolt('锁链钩','chain',9,{status:'snare',speed:410,windup:.8})],3.8)],{visual:155}),
 B01:b('B01','赤尾蝎王','scorpion',1050,106,64,165,'#e58270',[pattern('claws','双钳接尾刺','melee',double('claw',14,180),2.4),pattern('toxic','毒尾散射','range',[bolt('尾刺毒雨','venom',9,{shots:5,spread:.2,status:'poison',pool:true})],3.8),pattern('sting','追踪尾刺','special',[zone('抬尾点名','venom',18,{life:.45,radius:95,status:'poison'})],7)],'双钳连击与毒尾点名，毒区封锁路线'),
 B02:b('B02','织梦蛛后','spider',980,128,65,160,'#d5abea',[pattern('legs','前足三连刺','melee',double('web',12,170),2.4),pattern('spit','蛛毒喷吐','range',[bolt('口喷毒液','venom',8,{shots:3,status:'poison',pool:true,speed:390})],3.4),pattern('brood','产卵孵化','special',[{name:'产下蛛卵',type:'egg',style:'web',windup:1.1,active:.2,recover:.6}],11)],'近战、口喷毒、产下可打破的卵；孵化三只追击幼蛛'),
 B03:b('B03','血月蝠爵','bat',920,170,48,160,'#dd9dad',[pattern('fang','翼扫撕咬','melee',double('sonic',12,160),2.5),pattern('sonic','血月声波','range',[bolt('口部声波','sonic',12,{shots:3,speed:320,spread:.27})],3.7),pattern('dive','收翼俯冲','special',[strike('俯冲','sonic',19,155,{type:'dash',speed:460,windup:.9,active:.42,recover:.9})],7)],'空中盘旋、俯冲后恢复，声波从口部扩散',{flying:true,visual:300}),
 B04:b('B04','千鳞毒后','serpent',1100,104,55,178,'#b4d67b',[pattern('tail','蛇尾三连扫','melee',double('venom',12,175),2.6),pattern('fan','扇形毒息','range',[bolt('三重毒息','venom',9,{shots:5,status:'poison',pool:true,speed:350})],3.6),pattern('pillars','连环毒柱','special',[zone('毒柱一','venom',10,{status:'poison',radius:72,life:3}),zone('毒柱二','venom',10,{status:'poison',radius:72,life:3})],7)],'持续毒伤与毒区封路，尾扫逼迫跳跃'),
 B05:b('B05','熔炉牛魔','bull',1450,89,52,210,'#f6a665',[pattern('hammer','炉锤三连','melee',[...double('lava',15,190).slice(0,2),strike('熔炉重砸','lava',22,215,{windup:.85,recover:.9,lava:true})],2.8),pattern('fissure','熔星陨落','range',[zone('定点陨火','lava',13,{radius:105,life:5,status:'burn',falling:true})],4.2),pattern('charge','踏火冲撞','special',[strike('牛角冲锋','lava',20,140,{type:'dash',speed:390,active:.6,windup:.95,recover:.8,lava:true})],8)],'重砸和冲锋留下真实岩浆，踩入后持续灼烧',{visual:315}),
 B06:b('B06','断钟石像鬼','gargoyle',1250,115,49,195,'#c6c5b7',[pattern('wings','石翼连击','melee',double('rock',14,180),2.8),pattern('gaze','石化凝视','range',[bolt('石化魔印','stone',9,{status:'petrify',speed:350,windup:1.05})],5.5),pattern('stones','碎石轰击','special',[bolt('碎石散射','rock',12,{shots:5,spread:.22,speed:330,windup:.9})],7)],'石化弹命中短暂石化；石翼格挡姿态与碎石齐射'),
 B07:b('B07','荆冠古树','tree',1350,76,65,215,'#b6d78d',[pattern('branches','枝臂三连扫','melee',double('root',14,200),2.7),pattern('roots','追踪根刺','range',[zone('第一根刺','root',12,{radius:80,life:.5}),zone('第二根刺','root',12,{radius:80,life:.5}),zone('第三根刺','root',16,{radius:90,life:.5})],4.7),pattern('bloom','花核回春','special',[{name:'开花汲取',type:'heal',style:'heal',windup:.85,active:2.2,recover:.6}],12)],'胸花展开引导回血；重击打满失衡可打断',{visual:325}),
 B08:b('B08','霜牙狼王','wolf',1050,186,65,118,'#b2e5ff',[pattern('fang','扑咬爪击','melee',[strike('前爪','ice',12,155),strike('冻牙扑咬','ice',15,170,{type:'dash',speed:330,active:.26,status:'freeze',windup:.55})],2.5),pattern('breath','寒息冰冻','range',[bolt('口吐寒息','ice',9,{shots:3,status:'freeze',speed:360,windup:.8})],4.2),pattern('spikes','追地冰锥','special',[zone('前段冰锥','ice',14,{radius:80,life:.6,status:'freeze'}),zone('后段冰锥','ice',14,{radius:80,life:.6,status:'freeze'})],7)],'寒息和冻牙可冰冻；冰锥逐段预警，可跳跃避开',{visual:300}),
 B09:b('B09','雷骨翼龙','dragon',1280,140,60,185,'#f7df91',[pattern('wings','雷翼撕裂','melee',double('lightning',14,190),2.8),pattern('bolts','雷矢散射','range',[bolt('雷翼电弧','lightning',12,{shots:3,speed:450,windup:.7})],3.8),pattern('storm','三段落雷','special',[zone('落雷一','lightning',15,{radius:68,life:.25}),zone('落雷二','lightning',15,{radius:68,life:.25}),zone('落雷三','lightning',19,{radius:84,life:.25})],8)],'翼击连招、雷矢与三次有预兆的点名落雷',{visual:320}),
 B10:b('B10','无面星使','astral',1200,125,43,195,'#c2b4ff',[pattern('hands','六臂星切','melee',double('star',13,180),2.6),pattern('stars','追星三连','range',[bolt('星砂一','star',10),bolt('星砂二','star',10,{windup:.3}),bolt('星砂三','star',13,{windup:.45,shots:3})],4.2),pattern('gravity','引力坍缩','special',[zone('引力井','star',9,{radius:115,life:3,gravity:true})],8)],'六臂近战、连续星砂、会拉拽角色的引力领域',{flying:true,visual:300}),
 B11:b('B11','骷髅王','skeleton',1300,99,44,200,'#c8d9bf',[pattern('sword','王剑三连','melee',double('bone',15,185),2.8),pattern('skulls','亡魂骨弹','range',[bolt('亡魂骨弹','bone',11,{shots:3,speed:355})],4),pattern('army','亡者敕令','special',[{name:'召唤骷卫',type:'summon',style:'bone',windup:1.1,active:.15,recover:.65}],12)],'王剑连击、亡魂弹与召唤骷卫；召唤数量有上限',{visual:300})
};
ENEMIES.S01=m('S01','幼蛛','spiderling',72,175,22,48,'#c9acd9',[pattern('fang','幼蛛扑咬','melee',[strike('短扑咬','venom',5,80,{windup:.4,active:.15,recover:.3})],1.5)],{visual:96,summonOnly:true});
// Traits trigger automatically; they are not a substitute for active moves.
Object.assign(ENEMIES.B02,{passive:'育巢毒性',passiveText:'毒液命中附加持续毒伤；周期产卵，孵化三只可击杀幼蛛。'});
ENEMIES.B02.patterns=ENEMIES.B02.patterns.filter(p=>p.id!=='brood').concat(pattern('webfall','织网封路','special',[zone('落网束缚','web',12,{status:'snare',radius:100,life:2.5})],7));
ENEMIES.B02.patterns.push(pattern('leap','蛛影坠击','special',[{name:'跃起压落',type:'leap',style:'web',damage:19,reach:130,windup:.8,active:.85,recover:.8}],8));
Object.assign(ENEMIES.B06,{passive:'诅咒石质',passiveText:'攻击命中会积累石化，三次积累后短暂石化；解除后有抗性时间。'});
ENEMIES.B06.patterns.find(p=>p.id==='gaze').steps[0].status=null;
ENEMIES.B06.patterns.find(p=>p.id==='gaze').name='断钟震击';
ENEMIES.B06.patterns.find(p=>p.id==='gaze').steps[0].name='断钟魔印';
Object.assign(ENEMIES.B05,{passive:'熔炉余热',passiveText:'重砸与冲锋自然遗留岩浆，踩入附加灼烧。'});
Object.assign(ENEMIES.B07,{passive:'不息生长',passiveText:'受伤后周期绽开花核回血，可用重击打断本次恢复。'});
ENEMIES.B07.patterns=ENEMIES.B07.patterns.filter(p=>p.id!=='bloom').concat(pattern('seeds','荆棘播种','special',[bolt('荆棘种弹','root',13,{shots:5,spread:.23,speed:335})],6.5));
Object.assign(ENEMIES.B08,{passive:'霜牙寒意',passiveText:'攻击命中积累寒意并减速，三层触发冰冻；解冻后有抗性时间。'});
Object.assign(ENEMIES.B11,{passive:'亡者敕令',passiveText:'周期召唤骷髅护卫，场上护卫数量受限。'});
ENEMIES.B11.patterns=ENEMIES.B11.patterns.filter(p=>p.id!=='army').concat(pattern('prison','白骨牢笼','special',[zone('骨刺封锁','bone',14,{radius:100,life:1,status:'snare'})],7.5));
for(const d of Object.values(ENEMIES))if(d.boss&&!d.passive){
 const [name,copy]=({B01:['毒甲反应','尾毒命中附加持续毒伤。'],B03:['血月渴望','伤害命中时恢复少量生命，有触发间隔。'],B04:['万毒之躯','毒液命中附加持续毒伤，毒区留存。'],B09:['游雷骨纹','命中积累电荷，第三次命中迸发雷光附伤。'],B10:['星核引力','附近的玩家受到轻微引力牵引，施法时增强。']})[d.id];
 d.passive=name;d.passiveText=copy;
}
// Body bounds cover the visible head/torso; decorative stingers and wings do not
// turn into a giant invisible hitbox. These values are shared by all encounters.
const bodyHeights={M01:125,M02:145,M03:95,M04:164,M05:151,M06:140,M07:153,M08:107,M09:154,M10:146,
 B01:215,B02:300,B03:230,B04:295,B05:308,B06:310,B07:315,B08:205,B09:235,B10:295,B11:290,S01:48};
Object.assign(ENEMIES,CHAPTER_TWO_ENEMIES);
for(const d of Object.values(ENEMIES)){d.chapter??=1;d.h=bodyHeights[d.id]??d.h;if(d.form==='wolf')d.w=102;if(d.form==='spider')d.w=d.boss?85:40;}
export const ENEMY_IDS=Object.keys(ENEMIES).filter(id=>!ENEMIES[id].summonOnly);
export function enemyDefinition(id){if(!ENEMIES[id])throw new Error('Unknown enemy '+id);return ENEMIES[id];}
export const ENEMY_ANIMATION={columns:4,rows:4,walk:[0,1,2,3,4,5],idle:6,windup:7,melee:8,recover:9,ranged:10,summon:11,hurt:12,stagger:13,dying:14,dead:15};
