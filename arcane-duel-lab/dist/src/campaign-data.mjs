import {BOSS_TUNING} from './enemy-tuning.mjs';
// Numbers are tuning defaults, not a character progression/economy system.
const rows=[
 ['霜牙雪岭','B08','M06','M09','ice','#a7d7eb',12,66,[],'霜门堡垒','普通武器 · 普通铠甲','先看地面蓝光，再躲开坠落冰刺。'],
 ['熔炉火境','B05','M04','M08','lava','#e7a064',22,43,[1],'熔炉城塞','普通武器 · 普通铠甲','火球落地后留下五秒岩浆，跳跃穿越。'],
 ['千鳞毒沼','B04','M01','M07','venom','#b6cf88',31,70,[2],'蛇冠圣坛','蛇鳞护甲 · 毒牙法器（规划）','毒液持续扣血，避免停在毒池。'],
 ['织梦蛛巢','B02','M02','M08','web','#bc9dcc',40,39,[3],'织网穹顶','蛛丝护腕 · 织梦武器','及时打破蛛卵，阻止幼蛛孵化。'],
 ['荆冠密林','B07','M05','M09','root','#a8c189',46,76,[3],'荆冠树殿','古木铠甲 · 荆棘武器','古树回血时集中攻击，打出失衡。'],
 ['断钟石庭','B06','M10','M07','stone','#b7bfb4',55,51,[4,5],'断钟修院','石翼护甲 · 钟鸣武器','观察石化积累，解除后利用抗性反击。'],
 ['赤尾沙陵','B01','M01','M08','sand','#d6ae7b',63,25,[6],'赤尾王陵','赤尾武器 · 沙陵甲胄','尾刺会点名落点，不要原地站立。'],
 ['血月回廊','B03','M03','M09','sonic','#c49db8',68,70,[6],'血月尖塔','夜翼武器 · 血月护甲','留意收翼前摇，侧移躲避俯冲。'],
 ['白骨王城','B11','M06','M07','bone','#c3c9ac',77,48,[7,8],'白骨王座','王剑碎片 · 亡者铠甲','先清护卫再抓住王剑连招的收招。'],
 ['雷骨天脊','B09','M04','M08','lightning','#d8d2a0',84,22,[9],'雷骨祭峰','雷骨武器 · 风暴护甲','落雷连续点名，留好下一次位移。'],
 ['无面星渊','B10','M05','M09','star','#bcb1e2',92,66,[10],'星渊神庭','星核武器 · 星使铠甲','引力井拉扯时从外缘跳跃脱离。']
];
const buildingPositions=[[7,51],[20,30],[30,56],[37,24],[48,48],[56,29],[68,66],[73,17],[81,40],[89,20],[94,65]];
export const STAGES=rows.map((r,i)=>({id:i+1,name:r[0],boss:r[1],melee:r[2],ranged:r[3],theme:r[4],color:r[5],mapX:buildingPositions[i][0],mapY:buildingPositions[i][1],requires:r[8],building:r[9],drops:r[10],tip:r[11],art:`stage${String(i+1).padStart(2,'0')}-v1.png`,minionHp:24+i*9,bossHp:Math.round((380+i*110)*BOSS_TUNING.health),damageFactor:.24+i*.07,attackBudget:Math.min(5,2+Math.floor(i/3)),perSide:Math.min(10,6+Math.floor(i/2)),hazardDamage:6+i*2}));
export const STAGE_BY_ID=Object.fromEntries(STAGES.map(s=>[s.id,s]));
// Preserve readable tutorial damage after increasing boss reach and frequency.
for(const s of STAGES)s.bossDamageFactor=s.damageFactor*(s.id<=2?.85:1);
export const SAVE_KEY='arcane-campaign-progress-v1';
export function normalizeProgress(data){return {version:1,cleared:[...new Set((Array.isArray(data?.cleared)?data.cleared:[]).filter(id=>Number.isInteger(id)&&STAGE_BY_ID[id]))]};}
export function stageUnlocked(stage,progress){const p=normalizeProgress(progress);return stage.requires.every(id=>p.cleared.includes(id));}
export function completeStage(progress,id){if(!STAGE_BY_ID[id])throw new Error('未知关卡');const p=normalizeProgress(progress);if(!stageUnlocked(STAGE_BY_ID[id],p))throw new Error('前置关卡未完成');return normalizeProgress({cleared:[...p.cleared,id]});}
export function waveComposition(stage,wave=1){const perSide=Math.min(10,stage.perSide+(wave===3?1:0)),ranged=Math.max(1,Math.round(perSide*.3));return {perSide,melee:perSide-ranged,ranged,total:perSide*2};}


