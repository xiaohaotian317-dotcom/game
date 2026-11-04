import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {freshSolo,normalizeSolo,summonSolo} from '../dist/src/campaign-profile.mjs';
import {POOL_ORDER,POOLS,SUMMON_RECTS,SUMMON_REGIONS,initialPool,poolStatus,poolURL,portraitPlacement} from '../dist/src/summon-pools.mjs';

test('each hero has an independently addressable pool, including already owned previews',()=>{
 const p=freshSolo();assert.equal(new Set(POOL_ORDER.map(poolURL)).size,6);assert.equal(initialPool('fire',p),'fire');assert.equal(initialPool('invalid',p),'nature');
 for(const hero of POOL_ORDER){assert.equal(new URL(poolURL(hero),'https://game.test/').searchParams.get('hero'),hero);assert.ok(POOLS[hero].title);}
 assert.equal(poolStatus(p,'fire').owned,true);assert.equal(poolStatus(p,'fire').canSingle,false);
});
test('changing targeted pools and saving preserves separate pity and never spends gold',()=>{
 let p=freshSolo();p.tickets=30;p.pity.frost=7;const gold=p.coins;
 summonSolo(p,'nature',1,()=>.99);summonSolo(p,'shadow',1,()=>.99);p=normalizeSolo(JSON.parse(JSON.stringify(p)));
 assert.equal(p.pity.nature,1);assert.equal(p.pity.shadow,1);assert.equal(p.pity.frost,7);assert.equal(p.coins,gold);assert.equal(p.tickets,28);
 assert.equal(poolStatus(p,'nature').remaining,19);
});
test('targeted ten-draw stops at guaranteed hero and retains unused tickets and all other pools',()=>{
 const p=freshSolo();p.tickets=30;p.pity.nature=19;p.pity.frost=7;
 const r=summonSolo(p,'nature',10,()=>.99);assert.deepEqual(r.map(x=>x.hero),['nature']);assert.equal(p.tickets,29);assert.equal(p.pity.frost,7);assert.equal(p.pity.nature,0);assert.ok(p.owned.includes('nature'));
 const snapshot=structuredClone(p);assert.throws(()=>summonSolo(p,'nature',1));assert.deepEqual(p,snapshot);
});
test('static portraits keep complete source rectangles inside the viewport with head clearance',()=>{
 for(const hero of POOL_ORDER)for(const [width,height]of [[500,518],[280,390],[900,800]]){
  const p=portraitPlacement(hero,width,height),r=SUMMON_RECTS[hero];
  assert.ok(p.x>=0&&p.y>=12);assert.ok(p.x+p.w<=width&&p.y+p.h<=height-12);
  assert.ok(Math.abs(p.w/p.h-r[2]/r[3])<1e-12);
 }
});
test('six independent scene assets preserve the delivered original byte hashes',()=>{
 const root=new URL('../dist/assets/summon/',import.meta.url),meta=JSON.parse(readFileSync(new URL('scene-meta-v1.json',root)));
 assert.equal(meta.files.length,6);const hashes=new Set();for(const asset of meta.files){const hash=createHash('sha256').update(readFileSync(new URL(asset.file,root))).digest('hex');assert.equal(hash,asset.sha256);hashes.add(hash);}assert.equal(hashes.size,6);
});

test('atlas overlap masks retain hair tips and exclude adjacent heroes boots',()=>{
 const contains=(id,x,y)=>SUMMON_REGIONS[id].some(([rx,ry,w,h])=>x>=rx&&x<rx+w&&y>=ry&&y<ry+h);
 for(const [id,x,y]of [['lightning',271,527],['shadow',853,543],['star',1245,536]])assert.ok(contains(id,x,y),id+' full head');
 for(const [id,x,y]of [['lightning',180,535],['shadow',800,535],['star',1276,535],['fire',271,527],['frost',1245,536]])assert.equal(contains(id,x,y),false,id+' neighboring fragment');
 for(const id of POOL_ORDER){const [x,y,w,h]=SUMMON_RECTS[id];for(const [rx,ry,rw,rh]of SUMMON_REGIONS[id])assert.ok(rx>=x&&ry>=y&&rx+rw<=x+w&&ry+rh<=y+h);}
});
