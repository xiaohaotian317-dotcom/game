import {STAGE_GOLD} from './campaign-economy-data.mjs';
import {CHAPTER_TWO_STAGES,CHALLENGE_STAGES,CHAPTERS} from './chapter-two-data.mjs';
export {CHAPTER_TWO_STAGES,CHALLENGE_STAGES,CHAPTERS};
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
for(const [i,s] of STAGES.entries()){s.chapter=1;s.chapterIndex=i+1;}
export const CAMPAIGN_STAGES=[...STAGES,...CHAPTER_TWO_STAGES];
// The optional tutorial is a separate entrance, never a numbered story prerequisite.
export const TUTORIAL_STAGE={id:23,mode:'tutorial',chapter:1,chapterIndex:0,name:'启程试炼',building:'启程试炼',boss:null,melee:'M06',ranged:null,theme:'ice',color:'#a7d7eb',mapX:18,mapY:70,requires:[],art:'stage01-v1.png',artStageId:1,tip:'先熟悉移动、普攻和技能，清理两小波妖兽后靠近传送门结算。',recommendedLevel:1,minionHp:12,bossHp:0,damageFactor:.08,bossDamageFactor:0,attackBudget:1,perSide:2,killCoins:1,killXp:5,bossCoins:0,bossXp:0,hazardDamage:0,environmentHazards:false,waveCount:2,mapWidth:3000,triggers:[500,1900]};
export const ALL_STAGES=[...CAMPAIGN_STAGES,...CHALLENGE_STAGES,TUTORIAL_STAGE];
export const STAGE_BY_ID=Object.fromEntries(ALL_STAGES.map(s=>[s.id,s]));
// Preserve readable tutorial damage after increasing boss reach and frequency.
for(const [i,s] of STAGES.entries()){s.bossDamageFactor=s.damageFactor*(s.id<=2?.85:1);if(i>=3){s.minionHp=[62,84,105,136,178,222,280,340][i-3];s.bossHp=[990,1350,1700,2180,2800,3550,4500,5600][i-3];s.damageFactor=[.46,.54,.63,.73,.85,.99,1.14,1.3][i-3];s.bossDamageFactor=s.damageFactor;} }
export const SAVE_KEY='arcane-campaign-progress-v1';
export function normalizeProgress(data){return {version:1,cleared:[...new Set((Array.isArray(data?.cleared)?data.cleared:[]).filter(id=>Number.isInteger(id)&&STAGE_BY_ID[id]))]};}
export function stageUnlocked(stage,progress){const p=normalizeProgress(progress);return stage.requires.every(id=>p.cleared.includes(id));}
export function completeStage(progress,id){if(!STAGE_BY_ID[id])throw new Error('未知关卡');const p=normalizeProgress(progress);if(!stageUnlocked(STAGE_BY_ID[id],p))throw new Error('前置关卡未完成');return normalizeProgress({cleared:[...p.cleared,id]});}
export function waveComposition(stage,wave=1){if(stage.mode==='tutorial')return {perSide:2,melee:2,ranged:0,total:3,sides:[1,2]};const perSide=stage.chapter===1&&stage.id<=2?3:Math.min(10,stage.perSide+(wave===3?1:0)),ranged=Math.max(1,Math.round(perSide*.3));return {perSide,melee:perSide-ranged,ranged,total:perSide*2};}



// Solo difficulty revision: final incoming coefficients, not multipliers on older tuning.
const minionDamage=[.8,.9,1.02,1.15,1.29,1.44,1.6,1.78,1.98,2.2,2.44],bossDamage=[1.15,1.3,1.47,1.66,1.88,2.12,2.4,2.71,3.05,3.43,3.85];
for(const [i,s]of STAGES.entries()){s.damageFactor=minionDamage[i];s.bossDamageFactor=bossDamage[i]*.85;s.minionHp=Math.round(s.minionHp*1.25);s.bossHp=Math.round(s.bossHp*1.12);s.attackBudget=Math.min(6,3+Math.floor(i/3));}

// Gold scales with difficult stages; replaying cleared stages is an intended way to grow.
for(const [i,s]of STAGES.entries())s.killCoins=[8,10,12,14,18,20,25,30,36,44,54][i];

// T41: wider late-stage threat steps; minion HP remains unchanged by explicit request.
export const STAGE_THREAT=[1,1.08,1.18,1.32,1.48,1.67,1.90,2.16,2.46,2.80,3.18];
for(const [i,s]of STAGES.entries()){s.damageFactor*=STAGE_THREAT[i];s.bossDamageFactor*=STAGE_THREAT[i];}

for(const stage of CAMPAIGN_STAGES)stage.killCoins=STAGE_GOLD[stage.id-1];

// T45 final twenty-stage curve supersedes the older cumulative threat defaults above.
const finalMinionHp=[30,41,53,65,82,97,113,132,154,176,198],finalBossHp=[418,600,820,1100,1450,1850,2350,3000,3800,4700,5800],finalMinionDamage=[.8,.97,1.12,1.3,1.5,1.7,1.95,2.2,2.5,2.8,3.05],finalBossDamage=[.98,1.1,1.26,1.5,1.8,2.15,2.6,3.1,3.7,4.5,5.4],finalKillXp=[9,9,10,12,15,18,22,28,35,45,60],finalBossXp=[0,0,20,40,70,100,150,220,320,450,650];
for(const [i,s]of STAGES.entries())Object.assign(s,{minionHp:finalMinionHp[i],bossHp:finalBossHp[i],damageFactor:finalMinionDamage[i],bossDamageFactor:finalBossDamage[i],killXp:finalKillXp[i],bossXp:finalBossXp[i]});

// T60: soften only the first two story stages, after the final main-story curve.
for(const s of STAGES.slice(0,2)){
 s.minionHp=Math.round(s.minionHp*.9);s.bossHp=Math.round(s.bossHp*.9);
 s.damageFactor*=.9;s.bossDamageFactor*=.9;s.hazardDamage=Math.round(s.hazardDamage*.9);
}
