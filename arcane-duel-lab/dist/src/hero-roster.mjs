import {RECAST_WINDOWS} from './controls.mjs?v=20261029-ui10';
export const EXTRA_HERO_IDS=['frost','lightning','shadow','star'];
export const EXTRA_HEROES={
  frost:{name:'霜语者',given:'凝霜',color:'#88d9ff',accent:'#e8faff',role:'精准控场 · 寒霜减速',speed:315,jump:650,maxHp:110,passive:'霜衣',passiveText:'每 8 秒获得 18 点冰盾，已有护盾时不叠加。霜针命中使敌人短暂减速。',
    comboTitle:'霜环减速，寒潮回响。',comboHelp:'F 霜缚环造成少量伤害和减速，3.5 秒内再按 F 接寒潮；E 冰镜反射普通投射物。',groundSkills:['q','r'],recast:{key:'q',variant:'frostEcho',name:'寒潮',icon:'ice',window:RECAST_WINDOWS.frost},
    skills:{attack:{name:'霜针',icon:'ice',cd:.66,duration:.4,release:.14},q:{name:'霜缚环',icon:'ice',cd:7,duration:.64,release:.28},e:{name:'霜镜',icon:'shield',cd:7.5,duration:.57,release:.23},r:{name:'寒域封界',icon:'ice',cd:12,duration:.88,release:.36}},
    descriptions:{attack:'发射冰针，碰墙停止；命中减速。',q:'在鼠标下方台面扩散霜环：10 点伤害、35% 减速 2.5 秒；3.5 秒内再按 F 在原处接寒潮，6 点伤害并续上 2 秒减速。',e:'在前方竖起冰镜，将敌方普通投射物反射回去。',r:'在鼠标下方台面升起完整冰晶雪冠，展开飘雪与寒雾；首次冻结，随后持续减速与霜伤。'}},
  lightning:{name:'雷行者',given:'霆隼',color:'#ffd469',accent:'#fff4be',role:'近战雷拳 · 突进追击',speed:365,jump:680,maxHp:120,passive:'游电',passiveText:'移动积蓄电荷；满 100 后下一次普攻强化，命中消耗电荷并迸发电弧。',
    comboTitle:'贯雷命中，再折雷。',comboHelp:'F 突进命中后，3.5 秒内再按 F 向新的瞄准方向变向追击。',groundSkills:['r'],recast:{key:'q',variant:'thunderTurn',name:'折雷',icon:'bolt',window:RECAST_WINDOWS.lightning},
    skills:{attack:{name:'雷拳',icon:'bolt',cd:.64,duration:.38,release:.13},q:{name:'贯雷刺',icon:'bolt',cd:5.2,duration:.4,release:.1},e:{name:'磁跃',icon:'jump',cd:7,duration:.5,release:.16},r:{name:'天雷贯落',icon:'bolt',cd:11.5,duration:.84,release:.28}},
    descriptions:{attack:'护臂挥出近身雷拳，只击中面前近处目标，不能隔墙命中；满电荷额外放电。',q:'化为雷光向前突进，移动期间闪避普通弹体；命中后 3.5 秒内可变向再突进一次。',e:'牵引至附近的上层台面；可见的金色锚点标出目的地。',r:'瞄准敌人时突进其身前贴身落雷；空地则突进指定台面，引发近身雷击与冲击波。'}},
  shadow:{name:'影刃',given:'朔鸦',color:'#c1a0ff',accent:'#eadcff',role:'近身刺杀 · 留影换位',speed:365,jump:675,maxHp:110,passive:'背袭',passiveText:'从敌人背面命中普攻，额外造成 7 点伤害；每 1 秒最多触发一次。',
    comboTitle:'留下影标，掌握返程。',comboHelp:'E 影步后，3.5 秒内再按 E 返影；生命与冷却不会重置。',groundSkills:['e','r'],recast:{key:'e',variant:'shadowReturn',name:'返影',icon:'portal',window:RECAST_WINDOWS.shadow},
    skills:{attack:{name:'双刃切',icon:'blade',cd:.7,duration:.41,release:.15},q:{name:'影袭',icon:'blade',cd:5.4,duration:.43,release:.12},e:{name:'影步',icon:'portal',cd:7.5,duration:.48,release:.13},r:{name:'夜幕连斩',icon:'blade',cd:12.8,duration:.88,release:.3}},
    descriptions:{attack:'双匕近身斩击，需要贴近敌人，不能隔墙普攻。',q:'低位穿影突袭，连续留下姿态完整的鸦影，沿途命中敌人并闪避普通弹体。',e:'向选中台面短距传送，在起点留下影标；3.5 秒内可返回。',r:'在选中台面展开有限范围夜幕，连续刀光攻击，保留地面与本体可见。'}},
  star:{name:'星术师',given:'宿衡',color:'#b7adff',accent:'#ffe0a1',role:'引力操控 · 空间转移',speed:325,jump:650,maxHp:115,passive:'星轨',passiveText:'每次技能首次命中积累一枚星印；三枚后下一次普攻变为追踪星砂，发射后消耗星印。',
    comboTitle:'先引力，再斥星。',comboHelp:'F 引力井持续牵引，3.5 秒内再按 F 引爆斥星；E 展开成对折跃门。',groundSkills:['q','e','r'],recast:{key:'q',variant:'starRepulse',name:'斥星',icon:'orbit',window:RECAST_WINDOWS.star},
    skills:{attack:{name:'星砂',icon:'orbit',cd:.68,duration:.42,release:.16},q:{name:'引力井',icon:'orbit',cd:6.5,duration:.68,release:.26},e:{name:'折跃门',icon:'portal',cd:8,duration:.56,release:.2},r:{name:'星环坍缩',icon:'orbit',cd:12.9,duration:.94,release:.32}},
    descriptions:{attack:'发射星砂，碰墙停止；三枚星印强化为追踪星砂。',q:'在选中台面上方形成引力井；3.5 秒内再次按 F 改为向外推开的斥星。',e:'在原地与选中台面建立成对折跃门，角色和召唤物均可穿行。',r:'星环先收缩牵引，再向外爆发，范围与落点有清晰预警。'}}
};
export const VARIANT_LABELS={frostEcho:'寒潮',thunderTurn:'折雷',shadowReturn:'返影',starRepulse:'斥星'};
export function roleMeter(w){
  if(w.hero==='frost')return '霜衣  '+Math.round(w.player.shield||0)+' / 18 · '+Math.max(0,(w.roleState?.nextShield||0)-w.time).toFixed(1)+'s';
  if(w.hero==='lightning')return '游电  '+Math.round(w.player.charge||0)+' / 100'+(w.player.charge>=100?' · 下次命中强化':'');
  if(w.hero==='star')return '星轨  '+(w.player.stars||0)+' / 3'+(w.player.stars>=3?' · 追踪星砂就绪':'');
  if(w.hero==='shadow')return w.roleState?.shadowMark&&w.roleState.shadowMark.until>w.time?'返影标记  '+(w.roleState.shadowMark.until-w.time).toFixed(1)+'s':'背袭  '+(w.time>=(w.roleState?.backstabAt||0)?'就绪':((w.roleState.backstabAt-w.time).toFixed(1)+'s'));
  return '';
}
