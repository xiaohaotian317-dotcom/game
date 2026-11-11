import {artifactLevel,mirrorRules} from './campaign-artifacts.mjs';
export const PETS={
 mossdeer:{id:'mossdeer',name:'苔角灵鹿',stage:5,row:2,color:'#b7d499',forms:['苔芽幼鹿','荆冠灵鹿','翠庭圣鹿'],height:[70,88,104],description:'苔叶覆身、枝角生辉的森林灵兽。野生时会蓄力顶撞，并射出荆棘灵籽。'},
 emberwing:{id:'emberwing',name:'烬羽狮鹫',stage:9,row:1,color:'#f2bd78',forms:['烬羽幼兽','赤翎狮鹫','曜焰狮鹫'],height:[72,90,102],description:'狮身鹰首、翼尖似余烬的灵兽。野生时会扑爪连击，并吐出灼热羽弹。'},
 frostfox:{id:'frostfox',name:'月霜灵狐',stage:14,row:0,color:'#add9ed',forms:['霜绒幼狐','月纹灵狐','霜月玄狐'],height:[68,84,98],description:'银蓝毛发与月纹尾羽相映的灵狐。野生时会冲咬，并发出冰晶散射。'},
 dawnlion:{id:'dawnlion',name:'镇曜灵猊',stage:17,row:3,color:'#ead39a',forms:['曜纹幼猊','金鬃灵猊','镇曜玄猊'],height:[74,92,106],description:'金鬃、玄甲与曜纹相映的镇境灵兽。以爪击破敌，以日轮驱散周围敌群。'}
};
export const PET_IDS=Object.keys(PETS);
export const PET_STAGE=Object.fromEntries(PET_IDS.map(id=>[PETS[id].stage,id]));
export const PET_BASE={mossdeer:{hp:125,mp:100,damage:8,range:350,cooldown:1.4,ranged:true,regen:1.2},emberwing:{hp:165,mp:125,damage:12,range:95,cooldown:1.35,ranged:false,regen:.75},frostfox:{hp:205,mp:155,damage:16,range:390,cooldown:1.3,ranged:true,regen:.9},dawnlion:{hp:260,mp:195,damage:21,range:115,cooldown:1.25,ranged:false,regen:1.1}};
export const PET_SKILLS={
 dawnlion:[{name:'曜爪',cost:7,cd:3,power:1.6,kind:'claw',text:'向前挥出金色爪芒，重击近身敌人。'},{name:'日轮啸',cost:22,cd:7,power:1.8,kind:'ring',text:'日轮向周围扩散，击退身旁敌群。'},{name:'镇曜天火',cost:34,cd:12,power:2.6,kind:'flame',text:'目标台面降下金焰，留下短暂镇曜火域。'}],
 frostfox:[{name:'冰晶弹',cost:6,cd:3,power:1.3,kind:'bolt',text:'冰晶追击一名敌人。'},{name:'霜环',cost:18,cd:7,power:1.5,kind:'ring',text:'寒霜环伤害并减速附近敌人。'},{name:'霜月晶暴',cost:28,cd:12,power:1,kind:'storm',text:'目标区域降下三次冰晶冲击。'}],
 emberwing:[{name:'扑爪',cost:5,cd:3,power:1.4,kind:'claw',text:'近身扑爪，对前方目标重击。'},{name:'炎羽扇射',cost:16,cd:6,power:1.2,kind:'fan',text:'射出三枚炎羽，优先分散敌群。'},{name:'烬翼坠焰',cost:25,cd:11,power:2,kind:'flame',text:'坠焰爆发后留下短暂火域。'}],
 mossdeer:[{name:'荆棘灵籽',cost:6,cd:3,power:1.3,kind:'seed',text:'灵籽追击并短暂束缚敌人。'},{name:'花息回复',cost:20,cd:10,power:0,kind:'heal',text:'回复玩家8%及自身12%生命。'},{name:'古林缚根',cost:30,cd:13,power:2,kind:'roots',text:'根系在目标脚下展开，伤害并束缚。'}]
};
const PET_XP=[40,60,80,110,140,180,230,290,360];
export function petExperience(total=0){let level=1,xp=Math.max(0,Math.floor(total));const needed=n=>PET_XP[n-1]??Math.round(420+(n-10)*90+(n-10)**2*12);while(level<30&&xp>=needed(level))xp-=needed(level++);return {level,xp,next:needed(level)};}
export const PET_SKILL_LEVELS=5;
export const PET_SKILL_POWER=[1,1.25,1.65,2.15,2.8];
// Old rank 5 is retained in the save, but reads as the new maximum skill level.
const skillRank=(record,index)=>Math.max(0,Math.min(PET_SKILL_LEVELS-1,Math.floor(Number(record?.skillRanks?.[index])||0)));
export const petSkillLevel=(record,index)=>skillRank(record,index)+1;
export const petSkillPower=(record,index)=>PET_SKILL_POWER[skillRank(record,index)];
export function petSkillBonuses(record){const ranks=[0,1,2].reduce((sum,i)=>sum+(i<=(record.form||0)?skillRank(record,i):0),0);return {healthRatio:ranks*.04,attackRatio:ranks*.025};}
export function petStats(record){const b=PET_BASE[record.kind],traits=record.traits||{hp:1,mp:1,attack:1},level=petExperience(record.exp||0).level,form=record.form||0,skills=petSkillBonuses(record);return {...b,level,maxHp:Math.round(b.hp*traits.hp*(1+.05*(level-1))*[1,1.12,1.25][form]*(1+skills.healthRatio)),maxMp:Math.round(b.mp*traits.mp*(1+.03*(level-1))*[1,1.1,1.2][form]),damage:Math.round(b.damage*traits.attack*(1+.03*(level-1))*[1,1.12,1.28][form]*(1+skills.attackRatio))};}
export function rollPetTraits(random=Math.random){return Object.fromEntries(['hp','mp','attack'].map(k=>[k,Math.round((.92+Math.max(0,Math.min(1,random()))*.16)*1000)/1000]));}
export function markPetRest(p,stage){if(p.cleared.includes(stage)||(p.petRestStages||[]).includes(stage))return false;p.petRestStages??=[];p.petRestStages.push(stage);p.petRestEpoch=(p.petRestEpoch||0)+1;p.petRestAfterStage=stage;return true;}
export function grantPetXP(p,id,amount){const record=p.pets?.find(v=>v.id===id);if(record)record.exp=Math.min(1e7,(record.exp||0)+Math.max(0,Math.floor(amount)));}
export function petEvolutionCost(record){return !record||record.form>=2?null:[300,650,1100,1700][PET_IDS.indexOf(record.kind)]*(record.form===0?1:3);}
export function evolvePet(p,id){const record=p.pets?.find(v=>v.id===id);if(!record)throw Error('请选择已捕获灵宠');if(record.form>=2)throw Error('已经是最终形态');const needed=record.form===0?5:10;if(petExperience(record.exp).level<needed)throw Error(`灵宠达到${needed}级后可进化`);const cost=petEvolutionCost(record);if(p.coins<cost)throw Error('金币不足');p.coins-=cost;record.form++;return `进化完成 · ${PETS[record.kind].forms[record.form]}，已解锁第${record.form+1}个技能`;}
export const PET_DUNGEON={health:1.35,bossHealth:1.4,damage:1.3};
export const MIRROR={range:420,cooldown:6,channel:1.15};
export function captureChance(hp,maxHp,p=null){const ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));return Math.round(Math.min(.95,.12+.78*(1-ratio)+mirrorRules(p).chanceBonus)*100)/100;}
export function petRecord(p){p.pets??=[];return p.pets;}
export function normalizePets(raw){if(!Array.isArray(raw))return [];return raw.filter(v=>v&&PET_IDS.includes(v.kind)&&typeof v.id==='string').map(v=>{const form=Math.max(0,Math.min(2,Math.floor(Number(v.form)||0))),exp=Number.isSafeInteger(v.exp)&&v.exp>=0?Math.min(1e7,v.exp):form===2?1490:form===1?290:0;const traits=Object.fromEntries(['hp','mp','attack'].map(k=>[k,Number.isFinite(v.traits?.[k])?Math.max(.92,Math.min(1.08,v.traits[k])):1])),vitals=v.vitals&&Number.isFinite(v.vitals.hp)&&Number.isFinite(v.vitals.mp)?{hp:Math.max(0,v.vitals.hp),mp:Math.max(0,v.vitals.mp),epoch:Math.max(0,Math.floor(v.vitals.epoch||0))}:null;return {id:v.id,kind:v.kind,traits,vitals,skillRanks:[0,1,2].map(i=>Math.max(0,Math.min(5,Math.floor(Number(v.skillRanks?.[i])||0)))),form:Math.min(form,petExperience(exp).level>=10?2:petExperience(exp).level>=5?1:0),exp,capturedStage:PETS[v.kind].stage};});}
export function mirrorUnlocked(p){return artifactLevel(p,'mirror')>0;}
export function petDungeonUnlocked(p,stage){return !!PET_STAGE[stage]&&mirrorUnlocked(p)&&p.cleared.includes(stage);}
export const petStageLabel=stage=>stage>11?'第二章第'+(stage-11)+'关':'第一章第'+stage+'关';
export function petSkillUpgradeRecipe(record,index){const rank=skillRank(record,index),tier=PET_IDS.indexOf(record?.kind);if(tier<0||!Number.isInteger(index)||index<0||index>2||index>(record.form||0)||rank>=PET_SKILL_LEVELS-1)return null;return {level:rank+1,nextLevel:rank+2,coins:Math.round([100,200,350,550][tier]*(index+1)*(1+.5*rank+.15*rank*rank)/10)*10,stoneCount:[0,1,2,5][rank]};}
export const petSkillUpgradeCost=(record,index)=>petSkillUpgradeRecipe(record,index)?.coins??null;
export function petSkillStoneCount(profile){return (profile.bag||[]).reduce((sum,item)=>sum+(item.type==='petSkillStone'&&Number.isSafeInteger(item.count)&&item.count>0?item.count:0),0);}
export function upgradePetSkill(profile,id,index){
 const record=profile.pets?.find(p=>p.id===id),recipe=petSkillUpgradeRecipe(record,index);
 if(!recipe)throw Error('技能尚未解锁或已满级');
 if(!Number.isFinite(profile.coins)||profile.coins<recipe.coins)throw Error('金币不足');
 if(petSkillStoneCount(profile)<recipe.stoneCount)throw Error(`需要${recipe.stoneCount}枚灵宠技能石`);
 // All requirements pass before any currency, stack or rank changes.
 profile.coins-=recipe.coins;let remaining=recipe.stoneCount;
 for(const item of profile.bag||[]){if(item.type!=='petSkillStone'||!Number.isSafeInteger(item.count)||item.count<=0)continue;const used=Math.min(remaining,item.count);item.count-=used;remaining-=used;if(!remaining)break;}
 if(recipe.stoneCount)profile.bag=profile.bag.filter(item=>item.type!=='petSkillStone'||item.count>0);
 record.skillRanks??=[0,0,0];record.skillRanks[index]=recipe.nextLevel-1;
 return PET_SKILLS[record.kind][index].name+'已升至 Lv.'+recipe.nextLevel;
}
