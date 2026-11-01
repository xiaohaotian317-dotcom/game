import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampaign,stepCampaign,beginEncounter,campaignPlatforms,fitCampaignCamera,SPAWN_RATE} from '../dist/src/campaign-simulation.mjs';
import {createWorld,step,STEP,requestCast,fireOrbVisible,HEROES} from '../dist/src/simulation.mjs';
import {FrameClock} from '../dist/src/frame-clock.mjs';
import {updateCamera,cameraView} from '../dist/src/camera.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {ENEMIES,ENEMY_IDS} from '../dist/src/enemy-roster.mjs';
import {BOSS_TUNING} from '../dist/src/enemy-tuning.mjs';
import {createDuel,stepDuel,duelSnapshot,restoreDuel,safeInput} from '../dist/src/duel-simulation.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CampaignPainter} from '../dist/src/campaign-painter.mjs';
import {BossFxPainter} from '../dist/src/boss-fx-painter.mjs';
import {STAGES} from '../dist/src/campaign-data.mjs';
const run=(w,t,input={})=>{for(let i=0;i<Math.round(t/STEP);i++)step(w,STEP,input);};
function flat(hero='fire'){const w=createWorld(hero);w.targets=[];w.platforms=w.platforms.filter(p=>p.id==='ground');w.mirror.enabled=w.spring.enabled=false;w.camera={x:0,y:0,viewWidth:1440,viewHeight:800};return w;}
test('boss bodies shrink another 10 percent, HP grows 10 percent and normal movement drops 15 percent',()=>{
 const base={B01:[1050,106],B02:[980,128],B03:[920,170],B04:[1100,104],B05:[1450,89],B06:[1250,115],B07:[1350,76],B08:[1050,186],B09:[1280,140],B10:[1200,125],B11:[1300,99]};
 for(const [id,[hp,speed]]of Object.entries(base)){const w=flat(),e=spawnEnemy(w,id,{x:600});assert.equal(e.scale,.72);assert.equal(e.hp,Math.round(hp*1.1));assert.ok(Math.abs(ENEMIES[id].speed-speed*.85)<1e-8);assert.equal(e.attackScale,.8*1.2);assert.equal(e.frequency,1.2);}
 for(let id=1;id<=11;id++){const w=createCampaign('fire',id);assert.equal(w.campaign.stage.bossHp,STAGES[id-1].bossHp);if(id>3)assert.ok(w.campaign.stage.bossHp>STAGES[id-2].bossHp);}
});
test('boss cooldowns and active timing carry the real 20 percent frequency increase',()=>{
 const w=flat(),e=spawnEnemy(w,'B04',{x:600});e.ai.readyAt=0;e.ai.nextPassive=100;run(w,.08);const event=w.enemyEvents.find(x=>x.type==='attackStarted');assert.ok(event);const p=ENEMIES.B04.patterns.find(p=>p.id===event.pattern);assert.ok(Math.abs(e.ai.cooldowns[p.id]-event.time-p.cd/1.2)<1e-8);assert.equal(e.ai.attack.speed,1.2);
 e.ai.attack=null;e.ai.readyAt=0;e.ai.cooldowns={};e.ai.sequence=2;run(w,.02);assert.equal(e.ai.attack.plan.kind,'special');assert.ok(Math.abs(e.ai.attack.plan.steps[0].radius-72*.8*1.2)<1e-9);
});
test('sparse random layouts reproduce their seed and have exactly ground plus one upper level',()=>{
 const a=campaignPlatforms(42),b=campaignPlatforms(42),c=campaignPlatforms(43);assert.deepEqual(a,b);assert.notDeepEqual(a,c);assert.ok(a.length>=12&&a.length<=22);assert.ok(new Set(a.map(p=>p.y)).size>3);for(let i=1;i<a.length;i++){const gap=a[i].x-a[i-1].x-a[i-1].w;assert.ok(gap>=124&&gap<=321);}
 const w=createCampaign('fire',1,{seed:42});assert.ok(w.platforms.filter(p=>p.id!=='ground').every(p=>p.y>=w.floor-225&&p.y<=w.floor-155));fitCampaignCamera(w,1280,720);assert.equal(w.camera.viewWidth,1664);assert.ok(w.camera.viewWidth>1280);assert.ok(w.floor>cameraView(w).y&&w.floor<cameraView(w).y+w.camera.viewHeight);
});
test('every hero can double jump onto the upper road and between its sparse neighboring platforms',()=>{
 for(const hero of Object.keys(HEROES)){const template=createCampaign(hero,1,{seed:71}),decks=template.platforms.filter(p=>p.type==='campaign-upper');for(const [from,to]of [[template.platforms[0],decks[0]],...decks.slice(0,4).map((p,i)=>[p,decks[i+1]])]){let reached=false;
  for(const delay of [.28,.31,.34]){const w=createCampaign(hero,1,{seed:71});w.campaign.triggers=[1e8,2e8,3e8,4e8];const start=from.id==='ground'?to.x+to.w/2:from.x+from.w-21;Object.assign(w.player,{x:start,prevX:start,y:from.y,prevY:from.y,grounded:true,platformId:from.id,jumps:0,vx:0,vy:0});let second=false;for(let i=0;i<210;i++){const t=i*STEP,jump=i===0||!second&&t>=delay;if(i&&jump)second=true;stepCampaign(w,STEP,{move:from.id==='ground'?0:1,jump});if(i>10&&w.player.grounded&&w.player.platformId===to.id){reached=true;break;}}if(reached)break;}assert.ok(reached,hero+': '+from.id+' → '+to.id);}
 }
});
test('spawn rate is 20 percent slower and later waves can drop onto the upper deck',()=>{
 assert.equal(SPAWN_RATE,.8);const early=createCampaign('fire',1,{seed:42});early.player.x=1400;beginEncounter(early);assert.ok(Math.abs(early.campaign.queue[0].at-.65/.8)<1e-8);assert.ok(early.campaign.queue.every(q=>q.platformId==='ground'));
 const late=createCampaign('fire',7,{seed:42});late.player.x=1400;beginEncounter(late);assert.ok(late.campaign.queue.some(q=>q.platformId!=='ground'));for(let i=0;i<360;i++)stepCampaign(late,STEP);assert.ok(late.campaign.spawned.some(s=>s.platformId!=='ground'&&late.platforms.some(p=>p.id===s.platformId&&p.y===s.landingY)));
});
test('ordinary ground minions never trigger a player-style jump toward a platform',()=>{
 for(const id of ENEMY_IDS.filter(id=>!ENEMIES[id].boss&&!ENEMIES[id].flying)){const w=createCampaign('fire',4,{seed:42});w.campaign.triggers=[1e8,2e8,3e8,4e8];const deck=w.platforms[1];Object.assign(w.player,{x:deck.x+deck.w/2,y:deck.y,prevY:deck.y,prevX:deck.x+deck.w/2,platformId:deck.id,hp:10000,maxHp:10000});const e=spawnEnemy(w,id,{x:deck.x+deck.w/2-100,y:w.floor});for(let i=0;i<600;i++){stepCampaign(w,STEP);assert.ok(e.vy>=-1e-8,id+' jumped');assert.equal(e.jumps||0,0,id);}}
});
test('camera follow cannot slow walking; fixed steps preserve elapsed time even at 12.5 FPS',()=>{
 const samples=[];for(const delta of [1/60,1/24,.08]){const w=createCampaign('fire',1,{seed:42}),clock=new FrameClock(STEP);w.campaign.triggers=[1e8,2e8,3e8,4e8];for(let i=0;i<Math.round(6/delta);i++){clock.advance(delta,()=>stepCampaign(w,STEP,{move:1}));updateCamera(w,delta);}samples.push({x:w.player.x,time:w.time});}for(const s of samples){assert.ok(Math.abs(s.x-samples[0].x)<.01);assert.ok(Math.abs(s.time-6)<.01);}
});
test('fire E flies toward its accepted direction, does not jump, and quick recast detonates at the current orb',()=>{
 const w=flat();const y=w.player.y;requestCast(w,'e',1200,y-110);run(w,.15);const orb=w.projectiles.find(p=>p.kind==='emberOrb');assert.ok(orb&&orb.vx>800);assert.equal(w.player.grounded,true);assert.equal(w.player.y,y);const x=orb.x,cy=orb.y;w.targets=[{id:'victim',x:x+20,y:cy+45,w:22,h:80,hp:200,maxHp:200,vx:0,vy:0,grounded:false,hit:0,deadUntil:0,burnUntil:0,nextBurn:0}];const cd=w.player.cooldowns.e;assert.ok(requestCast(w,'e'));run(w,.02);assert.equal(w.player.recast,null);assert.ok(w.player.cooldowns.e<cd&&w.player.cooldowns.e>0);const explosion=w.effects.find(e=>e.kind==='orbExplosion');assert.ok(explosion);assert.ok(Math.abs(explosion.x-x)<.01&&Math.abs(explosion.y-cy)<.01);assert.ok(w.targets[0].hp<200);assert.equal(w.projectiles.some(p=>p.kind==='emberOrb'),false);assert.equal(requestCast(w,'e'),false);
});
test('fire E passes a real wall while basic attacks stop; leaving the viewport closes recast',()=>{
 const w=flat();w.obstacles=[{x:350,y:400,w:12,h:304,actor:true}];requestCast(w,'e',1300,w.floor-100);run(w,.5);const orb=w.projectiles.find(p=>p.kind==='emberOrb');assert.ok(orb&&orb.x>362);assert.ok(fireOrbVisible(w,orb));run(w,1.3);assert.equal(w.player.recast,null);assert.equal(w.projectiles.some(p=>p.kind==='emberOrb'),false);assert.equal(requestCast(w,'e'),false);
});
test('new orb and bounded viewport survive PvP snapshots and still detonate against a real opponent',()=>{
 const m=createDuel(['fire','frost'],'moon'),a=m.worlds[0],b=m.worlds[1];a.platforms=m.worlds[1].platforms=a.platforms.filter(p=>p.id==='ground');a.obstacles=b.obstacles=[];a.mechanisms=b.mechanisms=null;a.mirror.enabled=b.mirror.enabled=false;a.spring.enabled=b.spring.enabled=false;a.player.x=800;a.player.y=a.floor;b.player.x=1110;b.player.y=b.floor;a.aim={x:b.player.x,y:b.player.y-55};const input=safeInput({view:{x:300,y:0,width:1200,height:680}});for(let i=0;i<30;i++)stepDuel(m,STEP,[{...input,cast:i===0?'e':undefined,aim:a.aim},{}]);const restored=restoreDuel(duelSnapshot(m));assert.ok(restored.worlds[0].projectiles.some(p=>p.kind==='emberOrb'));assert.ok(restored.worlds[0].player.recast);const hp=restored.worlds[1].player.hp;for(let i=0;i<10;i++)stepDuel(restored,STEP,[{...input,cast:i===0?'e':undefined},{}]);assert.ok(restored.worlds[1].player.hp<hp);assert.equal(restored.worlds[0].player.recast,null);assert.equal(safeInput({view:{x:Infinity,y:0,width:5000,height:680}}).view,undefined);
});
test('meteor flight is exactly 20 percent faster while cast windup stays unchanged',()=>{const w=flat();requestCast(w,'r',700,600);run(w,.2);const m=w.effects.find(e=>e.kind==='meteor');assert.ok(m);assert.ok(Math.abs(m.delay-.82/1.2)<1e-9);assert.equal(HEROES.fire.skills.r.release,.18);assert.equal(BOSS_TUNING.fallSpeed,1.2);});

const artRoot=new URL('../dist/assets/boss-fx/',import.meta.url),fxMeta=JSON.parse(readFileSync(new URL('bounds-v2.json',artRoot)));
test('all eleven selected boss atlases, portal and sparse platform art match inspected hashes and true alpha',()=>{
 const selected=[...Object.values(fxMeta.units),fxMeta.portal,fxMeta.platforms];assert.equal(Object.keys(fxMeta.units).length,11);assert.equal(fxMeta.platforms.file,'platforms-v4.png');
 for(const m of selected){const bytes=readFileSync(new URL(m.file,artRoot));assert.equal(createHash('sha256').update(bytes).digest('hex'),m.sha256);assert.equal(m.alphaExtrema[0],0);assert.ok(m.cornerAlpha.every(x=>x<=1));assert.equal(m.frames.length,m===fxMeta.platforms?12:16);for(const f of m.frames){const r=f.rect,s=f.spriteRect;assert.ok(r[0]>=0&&r[1]>=0&&r[0]+r[2]<=m.size[0]&&r[1]+r[3]<=m.size[1]);assert.ok(s[2]>0&&s[3]>0);assert.ok(f.bottomNormalized>0&&f.bottomNormalized<=1);}}
});
function mockCanvas(draws){const gradient={addColorStop(){}};let ty=0;const stack=[];return new Proxy({globalAlpha:1,save(){stack.push(ty);},restore(){ty=stack.pop()??0;},translate(x,y){ty+=y;},drawImage(...args){const n=args.slice(1);assert.ok(n.every(Number.isFinite));assert.ok(Math.abs(n[6]/n[2]-n[7]/n[3])<1e-8,'uniform image scale');args[6]+=ty;draws.push(args);},createLinearGradient(){return gradient;}},{get(t,k){return k in t?t[k]:()=>{};},set(t,k,v){t[k]=v;return true;}});}
test('boss windup, missiles, impacts, fields and falling meteor select their own atlas without stretching',()=>{
 const draws=[],c=mockCanvas(draws),assets={bossFxMeta:fxMeta,bossFx:Object.fromEntries(Object.keys(fxMeta.units).map(id=>[id,{id}]))},painter=new BossFxPainter(c,assets),w=flat();
 for(const id of Object.keys(fxMeta.units)){const e=spawnEnemy(w,id,{x:650});e.ai.attack={age:.1,plan:{steps:[{windup:.7}]},index:0};assert.equal(painter.windup(w,e),true);assert.equal(painter.projectile(w,{enemyKind:id,x:500,y:600,vx:300,vy:150,age:.2}),true);assert.equal(painter.effect(w,{kind:'enemyVfx',enemyKind:id,x:500,y:600,style:'bone',ground:true,age:.1,duration:.5,radius:90}),true);assert.equal(painter.zone(w,{enemyKind:id,x:500,y:600,created:-1,delay:.5,life:3,radius:90}),true);assert.ok(draws.slice(-4).every(d=>d[0].id===id));}
 w.time=.65;assert.equal(painter.falling(w,{enemyKind:'B05',created:0,warning:.55,delay:.925,fall:.375,x:500,y:700}),true);
});
test('theme platforms align their real standing surface and the portal keeps a stable source frame over time',()=>{
 const draws=[],c=mockCanvas(draws),portal={id:'portal'},platform={id:'platform'},painter=new CampaignPainter({newMeta:fxMeta,portalImage:portal,platformImage:platform});
 for(const s of STAGES){const w=createCampaign('fire',s.id,{seed:42}),view={x:0,width:w.width};painter.ground(c,w,view);const f=fxMeta.platforms.frames[s.id-1],first=draws.filter(d=>d[0]===platform).at(-w.platforms.filter(p=>p.id!=='ground').length);assert.ok(first);const r=f.rect,src=f.spriteRect,scale=first[7]/src[2];assert.ok(Math.abs(first[6]+(r[1]+f.topNormalized*r[3]-src[1])*scale-w.platforms[1].y)<1e-7);}
 const w=createCampaign();w.campaign.portal={x:700,y:w.floor,born:0};for(const time of [.6,1,1.1,2,5,9]){w.time=time;painter.effects(c,w);}const frames=draws.filter(d=>d[0]===portal).map(d=>d.slice(1,5));assert.equal(frames.length,6);assert.ok(frames.every(r=>JSON.stringify(r)===JSON.stringify(frames[0])));
});



