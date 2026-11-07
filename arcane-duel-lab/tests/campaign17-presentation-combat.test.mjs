import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorld,requestCast,step,STEP,damage,hitPlayer,hitSummon} from '../dist/src/simulation.mjs';
import {createCampaign,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {freshSolo,normalizeSolo,heroStats,grantXP,addItem,equipItem} from '../dist/src/campaign-profile.mjs';
import {syncSoloStats,soloPay,soloSpec,soloDamage} from '../dist/src/campaign-growth-runtime.mjs';
import {SOLO_HEROES,SOLO_SKILLS,SOLO_SKILL_MANA,SOLO_BASIC_SPLASH,SOLO_BALANCE,BASE_STATS,xpNeeded} from '../dist/src/campaign-growth-data.mjs';
import {createDuel,stepDuel,duelSnapshot,restoreDuel} from '../dist/src/duel-simulation.mjs';
import {spawnEnemy} from '../dist/src/enemy-simulation.mjs';

const tick=(w,seconds)=>{for(let i=0;i<Math.ceil(seconds/STEP);i++)step(w,STEP);};
const totalXP=level=>Array.from({length:level-1},(_,i)=>xpNeeded(i+1)).reduce((a,b)=>a+b,0);
function profile(){const p=freshSolo();p.owned=[...SOLO_HEROES];return p;}
function arena(hero,{solo=true,random=()=>.99}={}){
 const w=solo?createCampaign(hero,1,{profile:profile(),seed:1,random}):createWorld(hero);
 w.platforms=w.platforms.filter(p=>p.id==='ground');w.obstacles=[];w.mechanisms=null;w.mirror.enabled=false;w.spring.enabled=false;
 Object.assign(w.player,{x:400,prevX:400,y:w.floor,prevY:w.floor,face:1});w.roleState.backstabAt=1e9;
 w.targets=[];return w;
}
function target(w,id,x,y=w.floor){const template=createWorld().targets[0],t={...template,id,x,y,prevX:x,prevY:y,spawnX:x,spawnY:y,hp:1000,maxHp:1000};w.targets.push(t);return t;}
function cluster(w,x=780){return [0,13,26,39,52,75,130].map((dx,i)=>target(w,'target-'+i,x+dx));}
function attack(w){assert.equal(requestCast(w,'attack',w.player.x+600,w.floor-65),true);return w.player.cast.id;}
const damageTexts=w=>w.texts.filter(t=>t.damage);

test('36 skills use one integer mana source and actual casts debit exactly, reject short mana and preserve free recasts',()=>{
 assert.deepEqual(SOLO_SKILL_MANA,[9,15,28]);let count=0;
 for(const hero of SOLO_HEROES)for(const skill of SOLO_SKILLS[hero]){
  count++;const w=arena(hero),h=w.campaign.progression.heroes[hero];h.skills[skill.id]=0;h.slots[skill.key]=skill.id;
  assert.equal(skill.mana,SOLO_SKILL_MANA[skill.row]);assert.ok(Number.isInteger(skill.mana));
  w.player.mp=skill.mana-.01;assert.equal(requestCast(w,skill.key,700,w.floor-1),false,skill.id);assert.equal(w.player.mp,skill.mana-.01);assert.equal(w.player.cast,null);
  w.player.buffer=null;w.player.mp=skill.mana;assert.equal(requestCast(w,skill.key,700,w.floor-1),true,skill.id);assert.equal(w.player.mp,0);assert.equal(w.player.cast.soloSkill.id,skill.id);
  const spec=soloSpec(w,skill.key,w.player.cast);assert.equal(soloPay(w,skill.key,true,spec),true);assert.equal(w.player.mp,0);
 }
 assert.equal(count,36);
 const w=arena('fire');w.player.mp=0;assert.equal(requestCast(w,'attack',900,w.floor-60),true);assert.equal(w.player.mp,0);
});

test('final solo mana is five percent above the previous integer cap at all growth levels, without changing public stats or save data',()=>{
 assert.equal(SOLO_BALANCE.mana,1.05);const p=profile();
 for(const hero of SOLO_HEROES)for(const level of [1,2,5,10,20,50]){
  p.heroes[hero].exp=totalXP(level);const before=structuredClone(p),s=heroStats(p,hero),old=Math.round(BASE_STATS[hero][1]*(1+.04*(level-1)));
  assert.equal(s.maxMp,Math.round(old*1.05),hero+' '+level);assert.deepEqual(p,before);assert.equal(heroStats(normalizeSolo(p),hero).maxMp,s.maxMp);
 }
 assert.equal(createWorld('fire').player.maxHp,180);assert.equal(createWorld('fire').player.maxMp,undefined);
});

test('level growth adds only capacity differences and repeated gear changes never restore spent health or mana',()=>{
 const w=arena('fire'),p=w.campaign.progression,oldHp=w.player.maxHp,oldMp=w.player.maxMp;w.player.hp=50;w.player.mp=10;
 grantXP(p,'fire',80);syncSoloStats(w);assert.equal(w.player.hp,50+w.player.maxHp-oldHp);assert.equal(w.player.mp,10+w.player.maxMp-oldMp);
 const gear=addItem(p,{type:'equipment',role:'staff',slot:'armor',quality:3,rolls:{health:1},level:3});const hp=w.player.hp,mp=w.player.mp;
 for(let i=0;i<4;i++){equipItem(p,'fire',gear.id);w.campaign.noStatHealOnce=true;syncSoloStats(w);p.heroes.fire.equipment.armor=null;w.campaign.noStatHealOnce=true;syncSoloStats(w);}
 assert.equal(w.player.hp,hp);assert.equal(w.player.mp,mp);
});

test('all six real solo basic projectile paths splash only the nearest three in 65 pixels at 35 percent and retain cast IDs',()=>{
 assert.deepEqual(SOLO_BASIC_SPLASH,{radius:65,ratio:.35,maxTargets:3});
 for(const hero of SOLO_HEROES){let rolls=0;const w=arena(hero,{random:()=>{rolls++;return .99;}}),targets=cluster(w),id=attack(w);
  while(!w.projectiles.length&&w.time<.4)step(w,STEP);
  assert.ok(w.projectiles.some(s=>s.basic&&s.castId===id),hero);tick(w,.7);
  const main=1000-targets[0].hp;assert.ok(main>0,hero);assert.deepEqual(targets.slice(1).map(t=>1000-t.hp),[Math.round(main*.35),Math.round(main*.35),Math.round(main*.35),0,0,0],hero);
  assert.equal(rolls,1,hero);assert.equal(w.stats.hits,1,hero);assert.equal(w.stats.damage,main+3*Math.round(main*.35),hero);
  const texts=damageTexts(w);assert.equal(texts.length,4);assert.equal(texts.filter(t=>t.splash).length,3);assert.ok(texts.every(t=>t.critical===false&&t.incoming===false&&Number.isFinite(t.lane)));assert.equal(new Set(texts.map(t=>t.lane)).size,4);
 }
});

test('near melee targets are reserved before splash; hybrid extension skips close and collateral targets but reaches a new target once',()=>{
 for(const hero of ['lightning','shadow']){
  let rolls=0;const w=arena(hero,{random:()=>{rolls++;return .99;}}),reach=hero==='lightning'?150:165;
  const first=target(w,'first',400+reach-40),second=target(w,'second',400+reach-20),collateral=target(w,'collateral',400+reach+10),remote=target(w,'remote',760);
  const id=attack(w);tick(w,.95);const main=hero==='lightning'?14:13,far=hero==='lightning'?11:10;
  assert.equal(1000-first.hp,main,hero);assert.equal(1000-second.hp,main,hero);assert.equal(1000-collateral.hp,Math.round(main*.35),hero);assert.equal(1000-remote.hp,far,hero);
  assert.equal(rolls,3,hero);assert.equal(w.stats.hits,3,hero);const record=w.campaign.basicAttacks.find(a=>a.id===id);assert.equal(record.hitIds.length,new Set(record.hitIds).size);assert.equal(record.hitIds.length,4);
  assert.equal(damageTexts(w).filter(t=>t.splash).length,1);
 }
});

test('all six solo basics retain the same splash distribution when firing left',()=>{
 for(const hero of SOLO_HEROES){const w=arena(hero);w.player.x=w.player.prevX=800;const targets=[0,13,26,39,52].map((dx,i)=>target(w,'left-'+i,420-dx));
  assert.ok(requestCast(w,'attack',200,w.floor-65));tick(w,.95);const main=1000-targets[0].hp;assert.ok(main>0,hero);assert.deepEqual(targets.slice(1).map(t=>1000-t.hp),[Math.round(main*.35),Math.round(main*.35),Math.round(main*.35),0],hero);
 }
});

test('real minion deaths caused by collateral enter enemy death state and reward the run once',()=>{
 const w=arena('nature'),p=w.campaign.progression,targets=[0,13,26,39,52].map(dx=>spawnEnemy(w,'M06',{x:780+dx,y:w.floor}));
 for(const t of targets){t.hp=t.maxHp=3;t.rootUntil=1e9;t.ai.readyAt=1e9;}
 attack(w);for(let i=0;i<150;i++)stepCampaign(w,STEP);
 assert.equal(targets.filter(t=>t.hp===0).length,4);assert.ok(targets.slice(0,4).every(t=>t.killedByPlayer&&t.rewarded&&t.ai.state==='dead'));
 assert.equal(p.coins,300+4*8);assert.equal(p.heroes.nature.exp,4*9);assert.equal(w.campaign.rewards.coins,4*8);assert.equal(w.stats.hits,1);
 const coins=p.coins;for(let i=0;i<60;i++)stepCampaign(w,STEP);assert.equal(p.coins,coins);
});

test('splash respects intervening cover, initial basic projectiles stop at walls, and no splash leaks into public practice or duel',()=>{
 for(const hero of SOLO_HEROES){
  const blocked=arena(hero),targets=cluster(blocked);blocked.obstacles=[{id:'wall',x:600,y:blocked.floor-200,w:4,h:200,actor:false}];attack(blocked);tick(blocked,1);assert.ok(targets.every(t=>t.hp===1000),hero);
  const practice=arena(hero,{solo:false}),ps=cluster(practice);attack(practice);tick(practice,.95);assert.ok(ps[0].hp<1000,hero);assert.ok(ps.slice(1).every(t=>t.hp===1000),hero);assert.equal(damageTexts(practice).some(t=>t.splash),false);
 }
 const w=arena('nature'),primary=target(w,'primary',780),across=target(w,'across',820);w.obstacles=[{id:'splash-wall',x:803,y:w.floor-120,w:3,h:120,actor:false}];attack(w);tick(w,.95);assert.ok(primary.hp<1000);assert.equal(across.hp,1000);
 const duel=createDuel(['lightning','shadow']).worlds[0];assert.equal(duel.campaign,undefined);assert.equal(damageTexts(duel).some(t=>t.splash),false);
});

test('real opposing actors keep public basic damage and combat metadata survives the duel snapshot round trip',()=>{
 const match=createDuel(['nature','shadow'],'training'),[w,rival]=match.worlds;
 for(const [i,world] of match.worlds.entries()){world.platforms=world.platforms.filter(p=>p.id==='ground');world.obstacles=[];world.mechanisms=null;world.mirror.enabled=false;world.spring.enabled=false;Object.assign(world.player,{x:i?780:400,prevX:i?780:400,hp:1000,maxHp:1000});}
 assert.ok(requestCast(w,'attack',1000,w.floor-65));for(let i=0;i<110;i++)stepDuel(match,STEP);
 assert.equal(rival.player.hp,985);assert.equal(w.campaign,undefined);const texts=damageTexts(w);assert.equal(texts.length,1);assert.equal(texts[0].critical,false);assert.equal(texts[0].splash,false);assert.equal(texts[0].incoming,false);
 assert.deepEqual(restoreDuel(duelSnapshot(match)).worlds[0].texts.filter(t=>t.damage).map(t=>({text:t.text,critical:t.critical,splash:t.splash,incoming:t.incoming,lane:t.lane})),texts.map(t=>({text:t.text,critical:t.critical,splash:t.splash,incoming:t.incoming,lane:t.lane})));
});

test('splash never re-rolls growth/critical, steals health, adds elemental passives, or recursively damages the next cluster',()=>{
 for(const [hero,crit] of [['fire',false],['frost',false],['lightning',true],['star',true]]){
  let rolls=0;const w=arena(hero,{random:()=>{rolls++;return crit?0:.99;}}),targets=cluster(w),remote=target(w,'chain-only',780+39+64);
  w.campaign.stats.lifesteal=.2;w.player.hp=20;w.campaign.stats.crit=.25;w.campaign.stats.critDamage=2;attack(w);tick(w,.95);
  const main=1000-targets[0].hp;assert.equal(rolls,1,hero);assert.ok(Math.abs(w.player.hp-(20+main*.2))<1e-9);assert.equal(remote.hp,1000);
  for(const t of targets.slice(1)){assert.equal(t.burnUntil,0);assert.ok(!(t.slowUntil>w.time));}
  assert.equal(w.player.stars,0);assert.ok(damageTexts(w).every(t=>t.critical===crit),hero);
 }
});

test('the actual critical RNG result controls metadata independently of high damage; skills and DoT stay outside basic splash',()=>{
 const low=arena('nature',{random:()=>0}),high=arena('nature',{random:()=>.99});low.campaign.stats.crit=.1;high.campaign.stats.crit=.1;high.campaign.stats.power=100;
 const a=target(low,'a',700),b=target(high,'b',700);damage(low,a,2);damage(high,b,2);assert.equal(damageTexts(low)[0].critical,true);assert.equal(damageTexts(high)[0].critical,false);assert.ok(1000-b.hp>1000-a.hp);
 const result={};assert.equal(soloDamage(high,2,{result}),200);assert.equal(result.critical,false);
 for(const hero of SOLO_HEROES){const w=arena(hero),targets=cluster(w);const skill=SOLO_SKILLS[hero].find(s=>s.row===0&&s.column===1);w.campaign.progression.heroes[hero].skills[skill.id]=0;w.campaign.progression.heroes[hero].slots.q=skill.id;assert.ok(requestCast(w,'q',780,w.floor-55));for(let i=0;i<108;i++)stepCampaign(w,STEP);assert.equal(damageTexts(w).some(t=>t.splash),false,hero);assert.equal(w.campaign.basicAttacks,undefined);assert.ok(targets.some(t=>t.hp<1000),hero);}
 const burn=arena('fire'),burned=target(burn,'burned',700),near=target(burn,'near',730);burned.burnUntil=2;burned.nextBurn=0;tick(burn,.1);assert.ok(burned.hp<1000);assert.equal(near.hp,1000);assert.equal(damageTexts(burn)[0].splash,false);
});

test('incoming direct, armored, guarded, shielded and persistent damage carry integer damage metadata while status messages retain fallback',()=>{
 const w=arena('fire');w.campaign.stats.armor=.12;w.player.hp=100;w.player.shield=.3;w.player.skillGuardUntil=10;
 assert.ok(hitPlayer(w,20,0));assert.equal(w.player.hp,86);assert.ok(hitPlayer(w,3,0,{dot:true,label:'毒伤'}));assert.equal(w.player.hp,84);
 w.fox={x:500,y:w.floor,hp:100,invuln:0};assert.ok(hitSummon(w,6.7));assert.equal(w.fox.hp,93);
 assert.deepEqual(damageTexts(w).map(t=>t.text),['−14','−2 毒伤','−7']);assert.ok(damageTexts(w).every(t=>t.incoming&&!t.critical&&!t.splash&&Number.isFinite(t.lane)));
 w.fox=null;const t=target(w,'weak',700);t.hp=1;damage(w,t,7.6,{source:'artifact'});assert.equal(damageTexts(w).at(-1).text,'1');assert.equal(damageTexts(w).at(-1).critical,false);assert.equal(w.texts.at(-1).text,'击破');assert.equal(w.texts.at(-1).damage,undefined);
});
