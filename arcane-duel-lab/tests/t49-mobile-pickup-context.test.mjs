import test from 'node:test';
import assert from 'node:assert/strict';
import {canPickupDrop} from '../dist/src/campaign-pickups.mjs';
const world=()=>({player:{x:600,y:760,hp:124,maxHp:124,mp:68,maxMp:68}});
const drop=type=>({id:'near-portal',x:600,y:760,item:{type,count:1},picked:false});
test('unusable full-health and full-mana drops do not reserve the mobile interaction slot',()=>{
 const w=world();assert.equal(canPickupDrop(w,drop('health')),false);assert.equal(canPickupDrop(w,drop('mana')),false);
 w.player.hp--;assert.equal(canPickupDrop(w,drop('health')),true);w.player.mp--;assert.equal(canPickupDrop(w,drop('mana')),true);
});
test('equipment and stored rewards remain collectible at full resources; real proximity and picked state still apply',()=>{
 const w=world();assert.equal(canPickupDrop(w,drop('stoneSmall')),true);assert.equal(canPickupDrop(w,{...drop('stoneSmall'),picked:true}),false);assert.equal(canPickupDrop(w,{...drop('stoneSmall'),x:686}),false);assert.equal(canPickupDrop(w,{...drop('stoneSmall'),y:684}),false);w.player.hp=0;assert.equal(canPickupDrop(w,drop('stoneSmall')),false);
});
