import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES,normalizeProgress,stageUnlocked,completeStage,waveComposition} from '../dist/src/campaign-data.mjs';
import {createCampaign,stepCampaign,beginEncounter,addCampaignHazard,fitCampaignCamera} from '../dist/src/campaign-simulation.mjs';
import {STEP,damage,requestCast} from '../dist/src/simulation.mjs?v=20261031-enemies1';
import {ENEMIES} from '../dist/src/enemy-roster.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';
import {updateCamera,worldPoint} from '../dist/src/camera.mjs?v=20261030-duel12';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {CampaignPainter} from '../dist/src/campaign-painter.mjs';
function run(w,seconds,input={}){for(let i=0;i<Math.ceil(seconds/STEP);i++){stepCampaign(w,STEP,input);w.events=[];}}
function durable(id=1,hero='fire'){const w=createCampaign(hero,id);w.player.hp=w.player.maxHp=100000;return w;}
function kill(w){for(const e of w.targets.filter(e=>e.hp>0))damage(w,e,100000);}
test('11 themed stages keep one melee and one ranged species per stage; difficulty grows and each next pair differs',()=>{
 assert.equal(STAGES.length,11);assert.equal(new Set(STAGES.map(s=>s.boss)).size,11);assert.equal(STAGES[0].boss,'B08');assert.equal(STAGES[1].boss,'B05');assert.equal(STAGES[2].boss,'B04');
 for(const [i,s]of STAGES.entries()){assert.equal(!!ENEMIES[s.melee].ranged,false);assert.equal(ENEMIES[s.ranged].ranged,true);for(let wave=1;wave<=3;wave++){const mix=waveComposition(s,wave);assert.ok(mix.perSide>=6&&mix.perSide<=10);assert.ok(mix.melee>mix.ranged);assert.equal(mix.total,mix.perSide*2);}if(i){assert.ok(s.minionHp>STAGES[i-1].minionHp);assert.ok(s.bossHp>STAGES[i-1].bossHp);assert.ok(s.damageFactor>STAGES[i-1].damageFactor);assert.notEqual(s.melee+'/'+s.ranged,STAGES[i-1].melee+'/'+STAGES[i-1].ranged);}}
});
test('progress normalizes hostile/corrupt storage, gates branches and keeps growth/rewards out',()=>{
 assert.deepEqual(normalizeProgress({cleared:[1,1,99,'2',null]}).cleared,[1]);let p=normalizeProgress(null);assert.ok(stageUnlocked(STAGES[0],p));assert.equal(stageUnlocked(STAGES[1],p),false);assert.throws(()=>completeStage(p,2));for(let i=1;i<=3;i++)p=completeStage(p,i);assert.ok(stageUnlocked(STAGES[3],p));assert.ok(stageUnlocked(STAGES[4],p));assert.equal(stageUnlocked(STAGES[5],p),false);p=completeStage(p,4);assert.equal(stageUnlocked(STAGES[5],p),false);p=completeStage(p,5);assert.ok(stageUnlocked(STAGES[5],p));assert.deepEqual(Object.keys(p).sort(),['cleared','version']);
});
test('camera locks near player, both sides spawn near viewport fifths, capped falling spawns land before attacking',()=>{
 const w=durable(11);w.player.x=1400;beginEncounter(w);const c=w.campaign,lock={...c.lock};run(w,.9);const first=w.targets[0];assert.ok(first.fallingSpawn);assert.ok(first.y>c.spawned[0].landingY-180&&first.y<c.spawned[0].landingY);assert.equal(first.ai.attack,null);run(w,2);assert.equal(c.spawned.length,20);assert.equal(w.targets.filter(t=>t.hp>0).length,20,'campaign cap exceeds trial cap 18');assert.ok(c.spawned.every(t=>[c.stage.melee,c.stage.ranged].includes(t.kind)));for(const side of [0,1]){const list=c.spawned.filter(s=>s.side===side);assert.equal(list.length,10);assert.ok(list.every(s=>s.platformId!=='ground'||Math.abs((s.x-lock.x)/lock.width-(side?.8:.2))<.04));}assert.ok(w.targets.every(t=>!t.fallingSpawn));const x=lock.x;updateCamera(w,.1);assert.equal(w.camera.x,x);run(w,4,{move:1});assert.ok(w.player.x<c.lock.x+c.lock.width-40);assert.ok(w.targets.every(e=>e.x>=lock.x&&e.x<=lock.x+lock.width));
});
test('all 11 levels finish three waves, one boss, enter the portal and stop; no wave unlock with queued enemies',()=>{
 for(const stage of STAGES){const w=durable(stage.id),c=w.campaign;for(let wave=1;wave<=4;wave++){w.player.x=c.triggers[wave-1];run(w,STEP);assert.equal(c.encounter,wave);assert.equal(c.state,wave===4?'boss':'wave');if(wave<4){assert.ok(c.queue.length);assert.equal(c.state,'wave');run(w,2.5);const list=c.spawned.filter(s=>s.wave===wave);assert.equal(list.length,waveComposition(stage,wave).total);assert.equal(new Set(list.map(s=>s.kind)).size,2);}else{const boss=w.targets.find(e=>e.id===c.bossId);assert.equal(boss.hp,stage.bossHp);assert.ok(Math.abs(boss.scale-.792)<1e-9);assert.ok(Math.abs(boss.visual-ENEMIES[stage.boss].visual*.72*1.1)<1e-9);}
 kill(w);run(w,STEP);assert.equal(c.state,wave===4?'portal':'travel');}assert.ok(c.portal);assert.equal(c.cleared,false);w.player.x=c.portal.x;w.player.y=w.floor;run(w,STEP,{settle:true});assert.equal(c.state,'complete');assert.equal(c.cleared,true);const time=w.time;run(w,1,{attack:true});assert.equal(w.time,time);assert.equal(w.stats.coins,undefined);}
});
test('death shows defeat without automatic training respawn or accidental clear',()=>{
 const w=createCampaign();w.player.invuln=0;w.player.hp=0;w.player.dead=1.6;run(w,3);assert.equal(w.campaign.state,'defeat');assert.equal(w.player.hp,0);assert.equal(w.campaign.cleared,false);
});
test('ice warning is safe, drops to grounded impact and can be dodged by moving or jumping',()=>{
 const w=durable();const hp=w.player.hp,h=addCampaignHazard(w,{x:w.player.x,kind:'ice',delay:.8});w.campaign.state='wave';w.campaign.queue=[{at:1000,done:false}];w.campaign.nextHazard=1000;run(w,.75);assert.equal(w.player.hp,hp);run(w,.5);assert.ok(w.player.hp<hp);assert.ok(h.impacted);const dodger=durable();dodger.campaign.state='wave';dodger.campaign.queue=[{at:1000}];dodger.campaign.nextHazard=1000;addCampaignHazard(dodger,{x:dodger.player.x,kind:'ice',delay:.8});run(dodger,1.3,{move:1});assert.equal(dodger.player.hp,dodger.player.maxHp);
});
test('falling fireball leaves damaging magma for exactly five seconds after impact',()=>{
 const w=durable(2);w.campaign.state='wave';w.campaign.queue=[{at:1000}];w.campaign.nextHazard=1000;const h=addCampaignHazard(w,{kind:'lava',x:w.player.x,delay:.5});run(w,.9);assert.ok(h.impacted);const hp=w.player.hp;run(w,2);assert.ok(w.player.hp<hp);const stop=h.born+h.delay+h.fall+5;while(w.time<stop+.02)run(w,STEP);assert.equal(w.campaign.hazards.length,0);const end=w.player.hp;run(w,2);assert.equal(w.player.hp,end);
});
test('wide flat route is continuously walkable by all six heroes without forced jumps',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star']){const w=durable(1,hero);w.campaign.triggers=[1e8,2e8,3e8,4e8];run(w,39,{move:1});assert.ok(w.player.x>w.width-200,hero);assert.equal(w.player.y,w.floor);assert.ok(!w.platforms.some(p=>p.type==='wood'||p.type==='lift'||p.type==='vine'));}
});
test('resize retains arena boundaries and precise pointer/camera mapping',()=>{
 const w=durable();w.player.x=1400;beginEncounter(w);fitCampaignCamera(w,1000,900);updateCamera(w,.1);const p=worldPoint(w,.5,.5);assert.equal(p.x,w.campaign.lock.x+w.camera.viewWidth/2);assert.equal(w.campaign.lock.width,w.camera.viewWidth);assert.equal(p.y,w.camera.viewHeight/2);run(w,2,{move:1});assert.ok(w.player.x<w.campaign.lock.x+w.campaign.lock.width);
});
test('tutorial boss attacks have scaled actual damage and smaller danger areas, not only smaller artwork',()=>{
 const w=durable();w.player.x=w.campaign.triggers[3];w.campaign.encounter=3;beginEncounter(w);const e=w.targets[0];w.player.x=e.x-220;run(w,8);assert.ok(w.enemyEvents.some(x=>x.type==='attackStarted'));assert.ok(w.player.hp<w.player.maxHp);assert.ok(w.player.maxHp-w.player.hp<100);for(const z of w.enemyZones||[])assert.ok(z.radius<=100);const base=createCampaign();const b=spawnEnemy(base,'B05',{x:700});assert.equal(b.scale,.72);assert.equal(b.w,ENEMIES.B05.w*.72);
});
test('six heroes keep actual attacks, grounded ultimates and kills on the new stage geometry',()=>{
 for(const hero of ['fire','nature','frost','lightning','shadow','star']){const w=durable(1,hero),e=spawnEnemy(w,'M04',{x:250,y:w.floor});e.hp=e.maxHp=200;e.ai.readyAt=100;w.player.x=170;const initial=e.hp;run(w,1.5,{attack:true,aim:{x:e.x,y:e.y-55}});assert.ok(e.hp<initial,hero);w.aim={x:700,y:w.floor-90};requestCast(w,'r');run(w,2);assert.ok(w.stats.casts>0);assert.ok([w.player.x,w.player.y,w.player.hp].every(Number.isFinite));}
});
test('17 concept/runtime PNGs match inspected hashes and the chosen FX preserve real transparency and per-frame foot anchors',()=>{
 const root=new URL('../dist/assets/campaign/',import.meta.url),v=JSON.parse(readFileSync(new URL('validation-v1.json',root))),meta=JSON.parse(readFileSync(new URL('fx-meta-v1.json',root))),scenes=JSON.parse(readFileSync(new URL('scene-meta-v1.json',root)));
 assert.equal(v.length,17);assert.equal(Object.keys(scenes).length,11);assert.equal(meta.fire.file,'fire-v2.png');for(const a of v){const bytes=readFileSync(new URL(a.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),a.sha256);assert.ok(a.size.every(n=>n>=1024));}
 for(const m of Object.values(meta)){const a=v.find(x=>x.file===m.file);assert.equal(a.mode,'RGBA');assert.equal(a.alphaExtrema[0],0);assert.ok(a.cornerAlpha.every(x=>x<=1));assert.equal(m.frames.length,16);for(const f of m.frames){assert.ok(f.bottomNormalized>0&&f.bottomNormalized<=1);assert.ok(f.spriteRect[2]>0&&f.spriteRect[3]>0);}}
});
test('all theme backgrounds, warnings, falling FX, impacts and portal frames draw finite undistorted source rectangles',()=>{
 const root=new URL('../dist/assets/campaign/',import.meta.url),fxMeta=JSON.parse(readFileSync(new URL('fx-meta-v1.json',root))),meta=JSON.parse(readFileSync(new URL('scene-meta-v1.json',root))),draws=[];
 const gradient={addColorStop(){}};const c=new Proxy({drawImage(...args){const n=args.slice(1);assert.ok(n.every(Number.isFinite));if(n.length===8){assert.ok(n[2]>0&&n[3]>0&&n[6]>0&&n[7]>0);assert.ok(Math.abs(n[6]/n[2]-n[7]/n[3])<.005,'same image scale in x/y');}draws.push(args);},createLinearGradient(){return gradient;},createRadialGradient(){return gradient;}},{get(t,k){return k in t?t[k]:(()=>{});},set(t,k,v){t[k]=v;return true;}});
 for(const s of STAGES){const art={meta,fxMeta,[s.art]:{width:1536,height:1024}};for(const m of Object.values(fxMeta))art[m.file]={width:m.size[0],height:m.size[1]};const painter=new CampaignPainter(art),w=durable(s.id);w.campaign.portal={x:700,y:w.floor,born:0};for(const time of [.1,1,1.1,1.3,1.7,3,5]){w.time=w.fxTime=time;w.campaign.hazards=[{x:400,y:w.floor,kind:s.theme,born:0,delay:.95,fall:.32,radius:60}];painter.background(c,w,{x:0,y:0,width:1200,height:760});painter.ground(c,w,{x:0,y:0,width:1200,height:760});painter.effects(c,w);}}assert.ok(draws.length>150);
});
test('wide displays keep feet and aim inside the visible view rather than cropping the road below the screen',()=>{const w=durable();fitCampaignCamera(w,2560,1080);updateCamera(w,.016);const v=w.camera;assert.ok(w.floor>=v.y&&w.floor<v.y+v.viewHeight-40);assert.equal(worldPoint(w,.5,.8).y,v.y+v.viewHeight*.8);});




