import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import bounds from '../dist/assets/enemies/bounds-v1.json' with {type:'json'};
import portraitMeta from '../dist/assets/enemies/portraits-v1.json' with {type:'json'};
import platformMeta from '../dist/assets/campaign-platforms/platforms-meta-v1.json' with {type:'json'};
import {ENEMIES} from '../dist/src/enemy-roster.mjs';
import {enemyPortraitRect} from '../dist/src/campaign-enemy-ui.mjs';
import {squarePortraitRect} from '../dist/src/portrait-framing.mjs';
import {RIGS} from '../dist/src/character-rig.mjs';
import {campaignPlatforms} from '../dist/src/campaign-platforms.mjs';
import {platformClearance,platformVariant,platformSurfaceGeometry,drawCampaignPlatform} from '../dist/src/campaign-platform-art.mjs';

test('every enemy has an explicit face crop contained in one source frame, including off-center heads',()=>{assert.deepEqual(Object.keys(portraitMeta.units).sort(),Object.keys(ENEMIES).sort());for(const id of Object.keys(ENEMIES)){const p=enemyPortraitRect(id),f=bounds.units[id].frames[p.frame].rect,[x,y,w,h]=p.rect;assert.equal(w,h);assert.ok(x>=f[0]&&y>=f[1]&&x+w<=f[0]+f[2]&&y+h<=f[1]+f[3],id);}assert.ok(portraitMeta.units.M08.rect[1]>150);assert.ok(portraitMeta.units.B09.rect[0]>200);assert.equal(portraitMeta.units.M10.frame,0);});

test('portrait samples remain square, retain the original face center and stay in the source bounds',()=>{for(const framing of Object.values(RIGS).map(r=>r.portrait)){const b={x:37,y:15,w:881,h:1181},[x,y,w,h]=squarePortraitRect(b,framing);assert.equal(w,h);assert.ok(x>=b.x&&y>=b.y&&x+w<=b.x+b.w&&y+h<=b.y+b.h);assert.ok(Math.abs((x+w/2)-(b.x+b.w*(framing[0]+framing[2]/2)))<1e-8);assert.ok(Math.abs((y+h/2)-(b.y+b.h*(framing[1]+framing[3]/2)))<1e-8);}});

test('all eleven themes provide two shallow original variants with valid collision anchors',()=>{const provenance=JSON.parse(readFileSync(new URL('../dist/assets/campaign-platforms/prompts-v1.json',import.meta.url)));assert.equal(Object.keys(platformMeta.stages).length,11);for(const source of provenance){const data=readFileSync(new URL('../dist/assets/campaign-platforms/'+source.file,import.meta.url));assert.equal(createHash('sha256').update(data).digest('hex'),source.sha256);}for(const m of Object.values(platformMeta.stages)){assert.equal(m.frames.length,2);assert.notDeepEqual(m.frames[0].rect,m.frames[1].rect);for(const f of m.frames){const [x,y,w,h]=f.rect;const size=platformMeta.images[f.file];assert.ok(x>=0&&y>=0&&x+w<=size[0]&&y+h<=size[1]);assert.ok(w>0&&h>0);assert.ok(f.standingX[0]>=0&&f.standingX[1]<=1);assert.ok(f.topNormalized>=0&&f.topNormalized<.4);}}});

test('both platform styles appear in every combat zone without changing collision or step routes',()=>{for(let seed=1;seed<=16;seed++){const platforms=campaignPlatforms(seed);for(let zone=0;zone<4;zone++)assert.equal(new Set(platforms.filter(p=>p.region==='combat'&&p.zone===zone).map(platformVariant)).size,2);for(const m of Object.values(platformMeta.stages)){const w={floor:760,platforms};for(const p of platforms){const clearance=platformClearance(w,p),g=platformSurfaceGeometry(m.frames[platformVariant(p)],p,clearance);assert.ok(g.clipBottom<=clearance);assert.ok(g.clipBottom>=0);assert.ok(g.clipBottom<=(p.role==='high'?180:110));assert.ok(g.x<=0&&g.x+g.width>=p.w);}}}});

test('platform decoration is clipped above a lower deck or ground with 24 units of air',()=>{const p={id:'p0',x:30,y:640,w:450,active:true},lower={id:'p1',x:100,y:710,w:200,active:true};const w={floor:760,platforms:[p,lower]};assert.equal(platformClearance(w,p),46);const calls=[],ctx={save(){},restore(){},translate(){},beginPath(){},rect(...a){calls.push(a);},clip(){calls.push('clip');},drawImage(){calls.push('draw');}};drawCampaignPlatform(ctx,{},platformMeta.stages[1],p,46);assert.ok(calls.indexOf('clip')<calls.indexOf('draw'));const rect=calls.find(Array.isArray);assert.ok(rect[1]+rect[3]<=46);assert.equal(p.y+46,lower.y-24);});
