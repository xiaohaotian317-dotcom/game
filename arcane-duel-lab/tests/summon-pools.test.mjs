import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {freshSolo,normalizeSolo,summonSolo} from '../dist/src/campaign-profile.mjs';
import {POOL_ORDER,POOLS,SUMMON_RECTS,initialPool,poolStatus,poolURL,portraitMotion} from '../dist/src/summon-pools.mjs';
import {SPLASH_RECTS} from '../dist/src/lobby-art.mjs?v=20261030-duel12';

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
test('all six animated portraits pin the face, move outer cloth subtly and stop completely for reduced motion',()=>{
 for(const hero of POOL_ORDER){const d=POOLS[hero],r=SUMMON_RECTS[hero],u=(d.face[0]-r[0])/r[2],v=(d.face[1]-r[1])/r[3];let movement=0;
  for(let i=0;i<30;i++){assert.deepEqual(portraitMotion(hero,u,v,i/3),{x:0,y:0});const p=portraitMotion(hero,d.cloth[0],d.cloth[1],i/3);movement=Math.max(movement,Math.hypot(p.x,p.y));assert.ok(Math.abs(p.x)<5&&Math.abs(p.y)<2);assert.deepEqual(portraitMotion(hero,.1,.4,i/3,true),{x:0,y:0});}
  assert.ok(movement>.1,hero);
 }
});
test('six independent scene assets preserve the delivered original byte hashes',()=>{
 const root=new URL('../dist/assets/summon/',import.meta.url),meta=JSON.parse(readFileSync(new URL('scene-meta-v1.json',root)));
 assert.equal(meta.files.length,6);const hashes=new Set();for(const asset of meta.files){const hash=createHash('sha256').update(readFileSync(new URL(asset.file,root))).digest('hex');assert.equal(hash,asset.sha256);hashes.add(hash);}assert.equal(hashes.size,6);
});
