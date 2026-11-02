export const PETS={
 mossdeer:{id:'mossdeer',name:'苔角灵鹿',stage:5,row:2,color:'#b7d499',forms:['苔芽幼鹿','荆冠灵鹿','翠庭圣鹿'],height:[38,52,65],description:'苔叶覆身、枝角生辉的森林灵兽。野生时会蓄力顶撞，并射出荆棘灵籽。'},
 emberwing:{id:'emberwing',name:'烬羽狮鹫',stage:7,row:1,color:'#f2bd78',forms:['烬羽幼兽','赤翎狮鹫','曜焰狮鹫'],height:[41,56,68],description:'狮身鹰首、翼尖似余烬的灵兽。野生时会扑爪连击，并吐出灼热羽弹。'},
 frostfox:{id:'frostfox',name:'月霜灵狐',stage:9,row:0,color:'#add9ed',forms:['霜绒幼狐','月纹灵狐','霜月玄狐'],height:[36,48,62],description:'银蓝毛发与月纹尾羽相映的灵狐。野生时会冲咬，并发出冰晶散射。'}
};
export const PET_IDS=Object.keys(PETS);
export const PET_STAGE=Object.fromEntries(PET_IDS.map(id=>[PETS[id].stage,id]));
export const PET_DUNGEON={health:1.35,bossHealth:1.4,damage:1.3};
export const MIRROR={range:420,cooldown:6,channel:1.15};
export function captureChance(hp,maxHp){const ratio=Math.max(0,Math.min(1,hp/Math.max(1,maxHp)));return Math.round((.12+.78*(1-ratio))*100)/100;}
export function petRecord(p){p.pets??=[];return p.pets;}
export function normalizePets(raw){if(!Array.isArray(raw))return [];return raw.filter(v=>v&&PET_IDS.includes(v.kind)&&typeof v.id==='string').map(v=>({id:v.id,kind:v.kind,form:Math.max(0,Math.min(2,Math.floor(Number(v.form)||0))),capturedStage:PETS[v.kind].stage}));}
export function mirrorUnlocked(p){return p?.cleared?.includes(4)||false;}
export function petDungeonUnlocked(p,stage){return !!PET_STAGE[stage]&&mirrorUnlocked(p)&&p.cleared.includes(stage);}
