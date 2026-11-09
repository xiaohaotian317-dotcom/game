// Chapter 1 IDs and saves remain stable. These are adjustable progression defaults.
const rows=[
 ['暮潮沉港','深潮锚王','B12','M11','M17','tide','#8ebdc0',18,'潮汐先推后退，避开锚击落点。'],
 ['赤晶矿窟','裂晶巨蜥','B13','M12','M18','crystal','#c69caa',22,'晶甲裂开后反击，留意折射晶刃。'],
 ['腐钟苔渠','孢冠沼母','B14','M13','M19','spore','#a9b98b',27,'离开孢雾，再清理被唤醒的菌卫。'],
 ['烬羽焚城','烬翼审判官','B15','M14','M17','ash','#cf9f7f',33,'羽雨会分次落下，别把位移一次用完。'],
 ['镜渊回廊','千面镜姬','B16','M15','M18','mirror','#b6b9d7',40,'镜姬闪位后才出刃，观察真实落点。'],
 ['沙漏王陵','时砂圣甲','B17','M16','M17','chrono','#c9b17b',48,'迟滞沙域限制移动，利用高低平台躲开贯穿。'],
 ['噬月巢穴','噬月螳皇','B18','M12','M19','moon','#b9c8da',56,'月刃会回旋，越过第一道后仍要留神。'],
 ['苍雷机城','雷铸巨像','B19','M20','M18','machine','#b7bba7',64,'雷核蓄能后连续轰击，找准收招窗口。'],
 ['蚀日王座','蚀日双相王','B20','M15','M17','eclipse','#c7a98c',70,'双相交替，先离开引力领域再接近王座。']
];
export const CHAPTER_TWO_STAGES=rows.map((r,i)=>({id:12+i,chapter:2,chapterIndex:i+1,name:r[0],bossName:r[1],boss:r[2],melee:r[3],ranged:r[4],theme:r[5],color:r[6],recommendedLevel:r[7],tip:r[8],art:`chapter2/chapter2-stage${i+12}-v1.png`,requires:i?[11+i]:[11],mapX:[9.3,20,29.6,40.2,49.4,61.6,71.7,81.8,91.1][i],mapY:[61.8,36.8,59.3,27.8,51,26.2,58.3,39.6,19.1][i],building:r[0],minionHp:[210,230,255,280,310,340,370,405,440][i],bossHp:[6500,7100,7800,8600,9500,10500,11600,12800,14200][i],damageFactor:[3.2,3.5,3.9,4.3,4.8,5.3,5.9,6.5,7.2][i],bossDamageFactor:[6.4,7.2,7.8,8.2,8.8,10.2,10.4,11.2,12][i],attackBudget:6,perSide:i<3?8:i<6?9:10,hazardDamage:28+i*5,killCoins:[70,85,100,120,145,175,210,250,300][i],killXp:[120,320,700,1300,2400,3600,4800,5600,6800][i],bossCoins:900+i*250,bossXp:[3500,5500,10000,18000,30000,44000,60000,76000,92000][i],hazardStyle:['tide','crystal','spore','ash','mirror','chrono','moon','machine','eclipse'][i]}));
export const CHALLENGE_STAGES=[
 {...CHAPTER_TWO_STAGES[0],id:21,chapterIndex:null,name:'轮回裂隙',building:'轮回裂隙',mode:'endless',boss:'B08',melee:'M06',ranged:'M09',theme:'eclipse',color:'#b0a3c8',art:'chapter2/chapter2-stage20-v1.png',mapX:25,mapY:78.4,requires:[11],recommendedLevel:null,tip:'三波妖兽与一位首领构成一轮，循环变强。只获得金币和角色经验。',minionHp:32,bossHp:450,damageFactor:.65,bossDamageFactor:.9,perSide:6,hazardDamage:4},
 {...CHAPTER_TWO_STAGES[8],id:22,chapterIndex:null,name:'双王绝境',building:'双王试炼',mode:'twin',boss:'B15',bosses:['B15','B19'],mapX:88.7,mapY:77.7,requires:[11],recommendedLevel:70,tip:'左右双首领同时降临，须击败双方。建议70级并完成装备与技能养成。',minionHp:650,bossHp:12500,damageFactor:8.8,bossDamageFactor:13.5,killCoins:360,killXp:650,bossCoins:3500,bossXp:10000}
];
export const CHAPTERS=[{id:1,name:'第一章 · 月痕征途',image:'world-map-v1.png',requires:[]},{id:2,name:'第二章 · 蚀日裂境',image:'chapter2/chapter2-world-v1.png',requires:[11]}];
