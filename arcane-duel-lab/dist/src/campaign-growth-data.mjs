export const SOLO_HEROES=['fire','nature','frost','lightning','shadow','star'];
export const SOLO_NAMES={fire:'焰术师',nature:'森灵',frost:'霜语者',lightning:'雷行者',shadow:'影刃',star:'星术师'};
export const SOLO_KEY='arcane-solo-growth-v1';
export const BASE_STATS={fire:[180,105],nature:[180,110],frost:[165,115],lightning:[180,95],shadow:[165,95],star:[173,120]};
export const XP_STEPS=[80,100,140,180,240,320,420,550,700,900,1150,1450];
export const xpNeeded=level=>XP_STEPS[level-1]??Math.round(1450+(level-12)*350+(level-12)**2*65);
export function experience(total=0){let level=1,xp=Math.max(0,Math.floor(total));while(level<50&&xp>=xpNeeded(level)){xp-=xpNeeded(level++);}return {level,xp,next:xpNeeded(level),total:Math.max(0,Math.floor(total))};}
export const QUALITY=[{name:'普通',color:'#dce2e7',power:.1},{name:'一般',color:'#8fc896',power:.18},{name:'高级',color:'#7bb8f5',power:.27},{name:'史诗',color:'#c397f1',power:.4},{name:'传说',color:'#f28383',power:.6},{name:'无敌',color:'#ffbb70',power:.85}];
export const equipmentClass=hero=>['lightning','shadow'].includes(hero)?'melee':'staff';
const baseNames={fire:['爆燃印','烬星火球','陨火天坠'],nature:['缚根','灵鹿召唤','古树庇护'],frost:['霜缚环','霜镜','寒域封界'],lightning:['贯雷刺','磁跃','天雷贯落'],shadow:['影袭','影步','夜幕连斩'],star:['引力井','折跃门','星环坍缩']};
const newNames={fire:['火焰龙卷','熔核穿刺','炼狱炎龙'],nature:['荆棘扇刃','花语治愈','荆棘王庭'],frost:['寒锋扇刃','冰晶追猎','极夜冰凰'],lightning:['裂雷重拳','雷链回旋','雷神战躯'],shadow:['月弧飞刃','鸦影伏杀','千鸦寂灭'],star:['星陨散射','星辉回溯','星海审判']};
const newDescriptions={fire:['在指定台面卷起火焰旋涡，持续灼烧附近敌人。','朝瞄准方向射出熔岩长枪，贯穿多个目标。','炎龙掠过指定区域，爆裂火焰分次冲击。'],nature:['向前展开三枚荆棘叶刃，命中短暂缠绕。','绽放花环，回复少量生命并清除一次毒火持续伤害。','荆棘王庭在台面生长，连续伤害并束缚敌人。'],frost:['扇形射出三枚寒锋，减速命中的敌人。','冰晶沿瞄准方向追猎，命中后扩散寒霜。','冰凰降临指定台面，多段冰雪攻击并延长减速。'],lightning:['向正前方打出近战裂雷重拳，短暂击退。','雷链向前穿刺，在敌群中产生连锁雷击。','进入雷神战躯，近身雷场持续攻击，获得短暂减伤。'],shadow:['投出三道月弧飞刃，削弱敌群。','向指定方向疾袭，留下鸦影并在终点斩击。','群鸦围绕目标区域交替斩落，连续打击。'],star:['三枚星核呈扇形散射，命中绽开星屑。','星辉回流，少量回复生命并获得临时小护盾。','星海法阵分次坠落星芒，覆盖指定台面。']};
const baseDescriptions={fire:['指定台面延迟爆燃，附加持续灼烧。','高速定向火球，离屏前再按同键原位引爆。','岩质陨石穿过上层平台，砸向光标下方台面。'],nature:['沿地面蔓生荆棘并缠绕敌人。','召唤自动追敌的木灵鹿，再按同键发出角跃令。','从指定台面长出古树，治疗附近玩家并提供枝台。'],frost:['寒霜环低伤减速，再按同键激起寒潮。','放置可以折射弹体的霜镜。','冰雪领域在指定台面持续压制敌人。'],lightning:['贯雷突刺穿过普通敌弹，命中可衍生折雷。','磁跃快速移动并留下雷电反馈。','突至目标身前，以重雷完成贴身爆发。'],shadow:['向前突刺，留下一串完整鸦影。','闪现后可在窗口内返影，不恢复损失生命。','追击斩击并释放近身暗影连击。'],star:['引力井牵制敌人，可再按同键斥星。','打开折跃通道，利用位移改变交战位置。','星环在指定区域坍缩，多段引力伤害。']};
export const SOLO_SKILLS=Object.fromEntries(SOLO_HEROES.map(hero=>[hero,[0,1,2].flatMap(row=>[0,1].map(column=>({id:`${hero}-${row}-${column}`,hero,row,column,key:['q','e','r'][row],name:(column?newNames:baseNames)[hero][row],description:(column?newDescriptions:baseDescriptions)[hero][row],cost:column?[500,1000,2000][row]:[0,500,1000][row],mana:[12,20,38][row],cd:column?[5.2,7.2,14][row]:null})))]));
export const skillById=id=>SOLO_SKILLS[String(id).split('-')[0]]?.find(s=>s.id===id);
export const upgradeCosts=[[150,250,400,600,900],[200,350,550,800,1100],[300,500,800,1200,1800]];
export const ITEMS={
 chestSmall:{name:'小金币宝箱',description:'开启后获得100金币。可用于学习、强化技能。',kind:'coins',value:100,sell:15,icon:0},
 chestMedium:{name:'中金币宝箱',description:'开启后获得200金币。旅途中攒下的实用补给。',kind:'coins',value:200,sell:30,icon:1},
 chestLarge:{name:'大金币宝箱',description:'开启后获得600金币。来自高难秘境的战利品。',kind:'coins',value:600,sell:80,icon:2},
 xpSmall:{name:'小经验药水',description:'出战角色获得40经验。不会直接恢复生命。',kind:'xp',value:40,sell:8,icon:3},
 xpMedium:{name:'中经验药水',description:'出战角色获得100经验。适合培养新获得的英雄。',kind:'xp',value:100,sell:18,icon:4},
 xpLarge:{name:'大经验药水',description:'出战角色获得300经验。高等级仍需更多战斗积累。',kind:'xp',value:300,sell:45,icon:5},
 ticket:{name:'角色抽奖券',description:'用于定向英雄召唤；每20抽内必得指定未拥有英雄。',kind:'ticket',value:1,sell:0,icon:6},
 stoneSmall:{name:'小灵石',description:'初阶锻造材料。3枚可合成1枚中等灵石。',kind:'stone',sell:3,icon:7},
 stoneMedium:{name:'中等灵石',description:'中阶锻造材料。3枚可合成1枚高阶灵石。',kind:'stone',sell:8,icon:8},
 stoneHigh:{name:'高阶灵石',description:'高阶锻造材料，用于三品强化。',kind:'stone',sell:20,icon:9},
 health:{name:'赤露血晶',description:'使用回复最大生命的18%，不超过当前上限。',kind:'health',value:.18,sell:3,icon:10},
 mana:{name:'湛蓝灵露',description:'使用回复最大法力的22%，不超过当前上限。',kind:'mana',value:.22,sell:3,icon:11},
 heroChoice:{name:'启程·英雄自选宝箱',description:'首通第一关仅此一次，选择一位尚未拥有的英雄。',kind:'heroChoice',sell:0,icon:12},
};
export function stageLoot(id,random=Math.random){const tier=id<=3?'Small':id<=7?'Medium':'Large',stone=id<=3?'Small':id<=7?'Medium':'High';const items=[{type:'xp'+tier,count:1},{type:'chest'+tier,count:1},{type:'stone'+stone,count:id>=10?5:id>=8?3:2}];if(id>1){const role=random()<.5?'melee':'staff',quality=id>=10?5:id>=8?4:id>=5?3:id===4?(random()<.2?2:1):0;items.push({type:'equipment',slot:'weapon',role,quality,stage:id,count:1},{type:'equipment',slot:'armor',role,quality,stage:id,count:1});}return items;}
export function lootPreview(id){return {guaranteed:stageLoot(id,()=>.6).filter(i=>i.type!=='equipment'),equipment:id===1?'首通英雄自选宝箱一次；本关不掉装备':`${QUALITY[id>=10?5:id>=8?4:id>=5?3:id===4?1:0].name}装备：50%拳套与近战甲 / 50%法杖与法袍${id===4?'，有20%概率升为蓝色高级':''}`};}
export function itemInfo(item){if(item.type!=='equipment')return ITEMS[item.type];const q=QUALITY[item.quality]||QUALITY[0],names=['','霜牙','熔炉','千鳞','织梦','荆冠','断钟','赤尾','血月','白骨','雷骨','星渊'],name=(names[item.stage]||'秘境')+(item.slot==='weapon'?(item.role==='melee'?'拳套':'法杖'):(item.role==='melee'?'战甲':'法袍'));return {name,kind:'equipment',description:`${q.name}品质 · ${item.role==='melee'?'近战职业':'法杖职业'}专用 · ${item.rank||0}品 / 强化${item.level||0}级。可装备、金币升级或灵石升品，颜色品质不会因升品改变。`,sell:Math.round(12*(1+(item.quality||0)*1.5)),quality:item.quality,color:q.color,icon:(item.role==='melee'?0:6)+(item.quality||0),sheet:item.slot==='weapon'?'equipment':'armors'};}

