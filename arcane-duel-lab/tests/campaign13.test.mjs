import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {freshSolo,normalizeSolo,addItem,usePetExperienceItem} from '../dist/src/campaign-profile.mjs';
import {DAILY_TASKS,dailyDate,dailyView,advanceDaily,claimDaily,normalizeDaily} from '../dist/src/daily-quests.mjs';
import {SOLO_SKILLS,stageLoot,lootPreview} from '../dist/src/campaign-growth-data.mjs';
import {PETS,petExperience} from '../dist/src/campaign-pet-data.mjs';
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {createWorld,STEP,step,requestCast,damage,hitPlayer} from '../dist/src/simulation.mjs';
import {spawnEnemy,applyEnemyStatus} from '../dist/src/enemy-simulation.mjs';
import {blinkProtected,protectBlink} from '../dist/src/blink-guard.mjs';
import {switchTeamHero} from '../dist/src/campaign-team.mjs';
import {drawFxFrame} from '../dist/src/boss-fx-painter.mjs';
import {BOSS_HUD_META,bossHudStyle} from '../dist/src/boss-hud-art.mjs';
import {DAILY_UI_META,dailyArtStyle,petPotionStyle} from '../dist/src/daily-ui-art.mjs';
const now=new Date(2026,10,5,12),tomorrow=new Date(2026,10,6,0,1);
const run=(w,n,input={})=>{for(let i=0;i<n;i++)stepCampaign(w,STEP,input);};
function arena(hero='fire'){const p=freshSolo();p.owned=['fire','shadow','star'];const w=createCampaign(hero,1,{profile:p,seed:42,random:()=>.5});w.campaign.triggers=[1e8,2e8,3e8,4e8];return w;}
test('daily selection has five unique simple goals, stays fixed today and resets exactly at the next local date',()=>{
 const p=freshSolo(),a=dailyView(p,now);assert.equal(a.tasks.length,5);assert.equal(new Set(a.taskIds).size,5);advanceDaily(p,'minions',7,now);assert.equal(dailyView(p,now).progress.minions,7);
 assert.deepEqual(normalizeDaily(JSON.parse(JSON.stringify(p.daily)),now),p.daily);const next=dailyView(p,tomorrow);assert.equal(next.day,'2026-11-06');assert.equal(next.progress.minions,0);assert.equal(next.count,0);assert.notDeepEqual(next.taskIds,a.taskIds);assert.equal(dailyDate(now),'2026-11-05');
});
test('any three completed daily tasks pay 100 then 100 then 300 exactly once, even after reload',()=>{
 const p=freshSolo();dailyView(p,now);for(const t of DAILY_TASKS)advanceDaily(p,t.metric,t.goal,now);
 const ids=p.daily.taskIds;for(let i=0;i<3;i++){const value=claimDaily(p,ids[4-i],now);assert.equal(value.reward,[100,100,300][i]);assert.equal(value.total,[100,200,500][i]);}
 assert.equal(p.coins,800);assert.equal(dailyView(p,now).count,3);assert.throws(()=>claimDaily(p,ids[0],now),/500/);assert.throws(()=>claimDaily(p,ids[4],now),/已领取/);assert.equal(p.coins,800);
 const copy=JSON.parse(JSON.stringify(p));copy.daily=normalizeDaily(copy.daily,now);assert.equal(dailyView(copy,now).count,3);assert.throws(()=>claimDaily(copy,ids[3],now));
});
test('unfinished or unavailable daily claims cannot change wallet and invalid saved progress cannot unlock rewards',()=>{
 const p=freshSolo();const v=dailyView(p,now);assert.throws(()=>claimDaily(p,v.taskIds[0],now));assert.throws(()=>claimDaily(p,'unknown',now));assert.equal(p.coins,300);
 const invalid=normalizeDaily({day:dailyDate(now),taskIds:v.taskIds,progress:{minions:-10,skills:NaN},claimed:[v.taskIds[0],v.taskIds[0]]},now);assert.equal(invalid.progress.minions,0);assert.equal(invalid.claimed.length,0);
});
test('daily progress follows real solo skill releases, jumps, dashes and kills; recasts and training do not farm skill credit',()=>{
 const w=arena();requestCast(w,'q',400,w.floor-5);run(w,45);assert.equal(w.campaign.progression.daily.progress.skills,1);
 stepCampaign(w,STEP,{jump:true});stepCampaign(w,STEP,{dash:true});assert.equal(w.campaign.progression.daily.progress.jumps,1);assert.equal(w.campaign.progression.daily.progress.dashes,1);
 const e=spawnEnemy(w,'M06',{x:500});e.hp=1;damage(w,e,10000,{source:'artifact'});run(w,3);assert.equal(w.campaign.progression.daily.progress.minions,1);assert.equal(w.campaign.progression.coins,308);assert.equal(w.campaign.progression.heroes.fire.exp,9);assert.equal(w.campaign.rewards.xp.fire,9);run(w,10);assert.equal(w.campaign.progression.coins,308);
 const vanilla=createWorld('fire');step(vanilla,STEP,{jump:true});assert.equal(vanilla.campaign,undefined);
});
test('pet experience potions require a real selected pet, grant only its XP and preserve manual evolution and save data',()=>{
 const p=freshSolo();p.pets=[{id:'pet-3',kind:'mossdeer',form:0,exp:0,traits:{hp:1,mp:1,attack:1},vitals:{hp:17,mp:12,epoch:0}},{id:'pet-4',kind:'frostfox',form:0,exp:0}];
 const small=addItem(p,{type:'petXpSmall',count:1});assert.throws(()=>usePetExperienceItem(p,small.id,'missing'));assert.equal(small.count,1);usePetExperienceItem(p,small.id,'pet-3');assert.equal(p.pets[0].exp,40);assert.equal(p.pets[1].exp,0);
 const big=addItem(p,{type:'petXpLarge',count:1});usePetExperienceItem(p,big.id,'pet-3');assert.equal(p.pets[0].exp,340);assert.ok(petExperience(p.pets[0].exp).level>=5);assert.equal(p.pets[0].form,0);assert.equal(p.pets[0].vitals.hp,17);assert.equal(p.heroes.fire.exp,0);assert.equal(normalizeSolo(p).pets[0].exp,340);assert.ok(!p.bag.some(i=>i.id===big.id));
 for(const [id,type]of [[5,'petXpSmall'],[7,'petXpMedium'],[9,'petXpLarge']]){assert.ok(stageLoot(id).some(i=>i.type===type));assert.ok(lootPreview(id).guaranteed.some(i=>i.type===type));}
});
test('all 36 hero skills cost exactly ten percent less than campaign12 while pets and artifacts keep their own mana rules',()=>{
 for(const list of Object.values(SOLO_SKILLS))for(const s of list)assert.ok(Math.abs(s.mana-[9.9,16.5,31.35][s.row]*.9)<1e-10);
});
test('a real shadow blink dodges normal damage, DoT and new control only after release, then expires',()=>{
 const w=createWorld('shadow');w.targets=[];requestCast(w,'e',600,w.floor-20);assert.equal(blinkProtected(w),false);const hp=w.player.hp;assert.equal(hitPlayer(w,2,0,{dot:true}),true);
 for(let i=0;i<35&&!blinkProtected(w);i++)step(w,STEP);assert.ok(blinkProtected(w));const after=w.player.hp;assert.equal(hitPlayer(w,30,0),false);assert.equal(hitPlayer(w,30,0,{dot:true}),false);
 applyEnemyStatus(w,'petrify','enemy',{});applyEnemyStatus(w,'poison','enemy',{});assert.equal(w.player.enemyControl,undefined);assert.equal(w.player.enemyStatus?.poison,undefined);assert.equal(w.player.hp,after);
 for(let i=0;i<25;i++)step(w,STEP);assert.equal(blinkProtected(w),false);assert.equal(hitPlayer(w,3,0,{dot:true}),true);assert.ok(w.player.hp<hp-2);
});
test('blink guard precedes PvP special-hit exceptions and switching heroes carries the deadline without refreshing it',()=>{
 const w=createWorld('shadow'),t={...createWorld('fire').player,duelActor:true,hp:100,maxHp:100,shield:0};protectBlink(w,t);for(const source of ['backstab','overload'])assert.equal(damage(w,t,20,{source}),false);assert.equal(t.hp,100);w.time=.16;t.invuln=0;assert.equal(damage(w,t,20,{source:'backstab'}),true);
 const p=freshSolo();p.owned=['fire','shadow'];const a=createCampaign('fire',1,{profile:p,team:p.owned});a.time=10;a.player.blinkUntil=10.15;switchTeamHero(a,1);assert.equal(a.player.blinkUntil,10.15);a.time=10.16;assert.equal(blinkProtected(a),false);
});
test('ground-contact metadata maps the lava plane to the true platform and leaves airborne frames centered',()=>{
 const boss=JSON.parse(readFileSync(new URL('../dist/assets/boss-fx/bounds-v2.json',import.meta.url))).units.B05,fire=JSON.parse(readFileSync(new URL('../dist/assets/campaign/fx-meta-v1.json',import.meta.url))).fire;
 for(const [meta,indices]of [[boss,[12,13,14,15]],[fire,[8,9,10,11,12,13,14,15]]])for(const i of indices){let call;const c={globalAlpha:1,save(){},translate(){},restore(){},drawImage(...args){call=args;}};const f=meta.frames[i],scale=200/f.rect[2];drawFxFrame(c,{},meta,i,200,700,200,{ground:true});assert.ok(Number.isFinite(f.groundContactY));assert.ok(Math.abs(call[6]+(f.rect[1]+f.groundContactY-f.spriteRect[1])*scale)<1e-8);}
});
test('eleven original boss shells and daily/potion assets keep native hashes and bounded measured regions',()=>{
 assert.equal(Object.keys(BOSS_HUD_META.units).length,11);for(const sheet of Object.values(BOSS_HUD_META.sheets)){const bytes=readFileSync(new URL('../dist/assets/boss-hud/'+sheet.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),sheet.sha256);}
 for(const [id,m]of Object.entries(BOSS_HUD_META.units)){assert.ok(m.rect[1]+m.rect[3]<=1254);assert.ok(m.hpRect[0]+m.hpRect[2]<m.rect[2]);assert.ok(!/NaN|Infinity/.test(bossHudStyle(id)));}
 for(const img of Object.values(DAILY_UI_META.images)){const bytes=readFileSync(new URL('../dist/assets/daily-ui/'+img.file,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),img.sha256);for(const f of Object.values(img.sprites)){assert.ok(f.rect[0]>=0&&f.rect[1]>=0&&f.rect[0]+f.rect[2]<=img.size[0]&&f.rect[1]+f.rect[3]<=img.size[1]);}}
 for(const key of ['entry','track','chest0Closed','chest0Open','chest1Closed','chest1Open','chest2Closed','chest2Open'])assert.ok(!/NaN|Infinity/.test(dailyArtStyle(key)));for(let i=0;i<3;i++)assert.ok(!/NaN|Infinity/.test(petPotionStyle(i)));
});
