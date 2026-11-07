import test from 'node:test';
import assert from 'node:assert/strict';
import {equipmentAttributeRows,equipmentBonuses,normalizeEquipmentRolls,rollEquipment} from '../dist/src/equipment-stats.mjs';

const neutral={attack:1,health:1,armor:1,crit:1,lifesteal:1};
const zero={attack:0,healthRatio:0,armor:0,crit:0,lifesteal:0,attackSpeed:0,regen:0};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`${actual} != ${expected}`);
const equipment=(slot,overrides={})=>({type:'equipment',slot,quality:0,level:0,rank:0,...overrides});

test('missing and invalid rolls use neutral values while finite rolls stay within ten percent',()=>{
 for(const value of [undefined,null,{},0,'invalid',[]])assert.deepEqual(normalizeEquipmentRolls(value),neutral);
 assert.deepEqual(normalizeEquipmentRolls({attack:NaN,health:Infinity,armor:-Infinity,crit:'1.05',lifesteal:null}),neutral);
 assert.deepEqual(normalizeEquipmentRolls({attack:-100,health:100,armor:.9,crit:1.1,lifesteal:1.025,other:1}),{attack:.9,health:1.1,armor:.9,crit:1.1,lifesteal:1.025});
});

test('new rolls sample each attribute once and can be saved without later changes',()=>{
 const values=[0,.25,.5,.75,1];let calls=0;
 const rolls=rollEquipment(()=>values[calls++]);
 assert.equal(calls,5);
 for(const [key,value]of Object.entries({attack:.9,health:.95,armor:1,crit:1.05,lifesteal:1.1}))close(rolls[key],value);
 assert.deepEqual(normalizeEquipmentRolls(JSON.parse(JSON.stringify(rolls))),rolls);
 const invalid=[NaN,Infinity,-Infinity,-2,2];let i=0;
 assert.deepEqual(rollEquipment(()=>invalid[i++]),{attack:1,health:1,armor:1,crit:.9,lifesteal:1.1});
});

test('legacy equipment keeps the original quality, level and rank bonuses',()=>{
 const weapon=equipmentBonuses(equipment('weapon',{quality:3,level:4,rank:2}));
 close(weapon.attack,8.5);close(weapon.crit,.036);close(weapon.lifesteal,.012);close(weapon.attackSpeed,.04);
 assert.equal(weapon.healthRatio,0);assert.equal(weapon.armor,0);assert.equal(weapon.regen,0);
 const armor=equipmentBonuses(equipment('armor',{quality:3,level:4,rank:2}));
 close(armor.healthRatio,.4675);close(armor.armor,.119);close(armor.regen,.54);
 assert.equal(armor.attack,0);assert.equal(armor.crit,0);assert.equal(armor.lifesteal,0);assert.equal(armor.attackSpeed,0);
 const highest=equipmentBonuses(equipment('armor',{quality:5,level:10,rank:3}));
 close(highest.healthRatio,.9625);close(highest.armor,.245);close(highest.regen,.8);
});

test('every legacy quality retains its attack, critical and lifesteal tier',()=>{
 const expected=[[1,0,0],[1.8,.012,.002],[2.7,.024,.005],[4,.036,.012],[6,.048,.022],[8.5,.06,.035]];
 for(const [quality,[attack,crit,lifesteal]]of expected.entries()){
  const actual=equipmentBonuses(equipment('weapon',{quality}));
  close(actual.attack,attack);close(actual.crit,crit);close(actual.lifesteal,lifesteal);
 }
});

test('small persistent rolls change only the relevant output or survival bonuses',()=>{
 const low={attack:.9,health:.9,armor:.9,crit:.9,lifesteal:.9},high={attack:1.1,health:1.1,armor:1.1,crit:1.1,lifesteal:1.1};
 const weapon=equipment('weapon',{quality:4,level:5,rank:1});
 const weaponLow=equipmentBonuses({...weapon,rolls:low}),weaponHigh=equipmentBonuses({...weapon,rolls:high});
 for(const key of ['attack','crit','lifesteal']){
  close(weaponLow[key],equipmentBonuses(weapon)[key]*.9);
  close(weaponHigh[key],equipmentBonuses(weapon)[key]*1.1);
 }
 assert.equal(weaponLow.attackSpeed,weaponHigh.attackSpeed);
 for(const key of ['healthRatio','armor','regen'])assert.equal(weaponHigh[key],0);
 const armor=equipment('armor',{quality:4,level:5,rank:1});
 const armorLow=equipmentBonuses({...armor,rolls:low}),armorHigh=equipmentBonuses({...armor,rolls:high});
 for(const key of ['healthRatio','armor']){
  close(armorLow[key],equipmentBonuses(armor)[key]*.9);
  close(armorHigh[key],equipmentBonuses(armor)[key]*1.1);
 }
 assert.equal(armorLow.regen,armorHigh.regen);
 for(const key of ['attack','crit','lifesteal','attackSpeed'])assert.equal(armorHigh[key],0);
 close(equipmentBonuses(equipment('armor',{quality:5,level:10,rank:3,rolls:high})).armor,.25);
});

test('non-equipment and malformed levels still return finite numeric bonuses',()=>{
 for(const item of [undefined,null,{},false,{type:'chestSmall'},{type:'equipment',slot:'artifact'}]){
  assert.deepEqual(equipmentBonuses(item),zero);assert.deepEqual(equipmentAttributeRows(item),[]);
 }
 for(const invalid of [NaN,Infinity,-Infinity,'bad',{},Symbol('invalid')]){
  const bonuses=equipmentBonuses(equipment('weapon',{quality:invalid,level:invalid,rank:invalid}));
  assert.ok(Object.values(bonuses).every(Number.isFinite));close(bonuses.attack,1);
 }
 assert.deepEqual(equipmentBonuses(equipment('weapon',{quality:-2,level:-1,rank:-3})),equipmentBonuses(equipment('weapon')));
 assert.deepEqual(equipmentBonuses(equipment('weapon',{quality:100,level:100,rank:100})),equipmentBonuses(equipment('weapon',{quality:5,level:10,rank:3})));
});

test('white unenhanced weapons show only real attack with the solo multiplier',()=>{
 assert.deepEqual(equipmentAttributeRows(equipment('weapon')),[{key:'attack',label:'攻击力',value:'+1.2'}]);
 assert.deepEqual(equipmentAttributeRows(equipment('weapon',{rolls:{attack:1.034}})),[{key:'attack',label:'攻击力',value:'+1.24'}]);
 const rows=equipmentAttributeRows(equipment('weapon',{quality:3,level:4,rank:2}));
 assert.deepEqual(rows.map(row=>row.label),['攻击力','暴击率','吸血','攻击速度']);
 assert.deepEqual(rows.map(row=>row.value),['+10.2','+3.6%','+1.2%','+4%']);
});

test('armor rows use the selected hero base health and contain only survival values',()=>{
 const armor=equipment('armor');
 assert.deepEqual(equipmentAttributeRows(armor),[
  {key:'health',label:'生命值',value:'+7.59'},
  {key:'armor',label:'防御',value:'+1.4%'},
  {key:'regen',label:'生命回复',value:'+0.1/秒'}
 ]);
 assert.equal(equipmentAttributeRows(armor,'lightning')[0].value,'+8.22');
 assert.equal(equipmentAttributeRows(armor,'star')[0].value,'+7.46');
 assert.deepEqual(equipmentAttributeRows(armor,'constructor'),equipmentAttributeRows(armor,'fire'));
 assert.deepEqual(equipmentAttributeRows(armor,'unknown'),equipmentAttributeRows(armor,'fire'));
});

test('reading or displaying equipment never mutates the item or implicitly rerolls it',t=>{
 t.mock.method(Math,'random',()=>{throw Error('Reading existing equipment must not use random');});
 const legacy=Object.freeze(equipment('weapon',{quality:2,level:3,rank:1}));
 const rolls=Object.freeze({attack:1.03,health:.92,armor:1.08,crit:.96,lifesteal:1.04});
 const item=Object.freeze(equipment('armor',{id:'item-7',quality:4,level:2,rank:1,rolls}));
 const before=JSON.stringify(item),legacyBefore=JSON.stringify(legacy);
 const first=equipmentBonuses(item),rows=equipmentAttributeRows(item,'nature');
 for(let i=0;i<3;i++){
  assert.deepEqual(equipmentBonuses(item),first);assert.deepEqual(equipmentAttributeRows(item,'nature'),rows);
  assert.deepEqual(normalizeEquipmentRolls(rolls),rolls);equipmentBonuses(legacy);equipmentAttributeRows(legacy);
 }
 assert.equal(JSON.stringify(item),before);assert.equal(JSON.stringify(legacy),legacyBefore);
 assert.equal(Object.hasOwn(legacy,'rolls'),false);
});
