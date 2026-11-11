import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo,loadSolo,saveSolo} from '../dist/src/campaign-profile.mjs';
import {commitShopReward} from '../dist/src/shop-rewards.mjs';
import {dailyChestChoice,commitDailyChest} from '../dist/src/daily-quest-rewards.mjs';
import {dailyView,advanceDaily} from '../dist/src/daily-quests.mjs';
import {exportSave,importSave,SAVE_KEYS} from '../dist/src/save-transfer.mjs';
import {createCampaign,beginEncounter,stepCampaign} from '../dist/src/campaign-simulation.mjs';
import {hitPlayer} from '../dist/src/simulation.mjs';
import {freshOperations,normalizeOperations,mergeOperationsForImport,RELEASE_AD_POLICY,resultInterstitialChoice,reserveResultInterstitialDraft,commitResultInterstitialReservation,resultInterstitialShownDraft,assertOperationReceipt} from '../dist/src/release-ad-policy.mjs';
import {campaignAdAttempt,captureCampaignDefeat,campaignReviveChoice,campaignReviveDraft,commitCampaignAdRevive,CAMPAIGN_AD_REVIVE_RULES} from '../dist/src/campaign-ad-recovery.mjs';
import {shareMessage,dailyShareChoice,shareRewardDraft,commitDailyShare} from '../dist/src/share-rewards.mjs';

// All ad results below are explicit fixtures. No SDK, phone or network is used.
const policy={confirmed:true,revive:{enabled:true},result:{enabled:true,minIntervalMs:60000,dailyLimit:2},share:{enabled:true,reward:{coins:100,tickets:0,items:[{type:'xpSmall',count:1}]},url:null}};
const now=new Date(2026,10,11,12),receipt=(id,placement='reward-revive')=>({completed:true,placement,receipt:`dirichlet-test:${placement}:fixture:${id}`});
const SOLO_KEY=SAVE_KEYS[0];
function failedWorld({id=1,mode,team=['fire'],pet=false}={}){
 const p=freshSolo();p.owned=[...new Set(team)];p.lineup=team;p.operations=freshOperations();if(pet){p.cleared=[4,5];p.artifacts={mirror:{level:1}};}
 const w=createCampaign(team[0],pet?5:id,{profile:p,team,petDungeon:pet});
 w.player.x=1500;w.camera.x=750;beginEncounter(w);if(mode)w.campaign.mode=mode;w.player.hp=0;w.player.dead=1e9;
 for(const m of w.campaign.team)m.player.hp=0;
 const before={phase:w.campaign.state,queue:structuredClone(w.campaign.queue)};captureCampaignDefeat(w);w.campaign.state='defeat';w.campaign.defeated=true;w.campaign.queue=[];
 return {p,w,before};
}
test('T72 revive/interstitial stay disabled; confirmed first daily share grants exactly 100 coins',()=>{
 let {p,w}=failedWorld();assert.equal(campaignReviveChoice(w,p),null);assert.equal(resultInterstitialChoice(p,{attemptId:'r1',mode:'story',settlementSaved:true,leaving:true}),null);const before=structuredClone(p),choice=dailyShareChoice(p,{requestId:'s1',now});assert.deepEqual(choice.reward,{coins:100,tickets:0,items:[]});
 assert.throws(()=>commitDailyShare({getProfile:()=>p,onSave:()=>true,choice,opened:{opened:false,requestId:'s1'},now}));assert.deepEqual(p,before);
 commitDailyShare({getProfile:()=>p,onSave:next=>{p=next;return true;},choice,opened:{opened:true,requestId:'s1',sent:false},now});assert.equal(p.coins,before.coins+100);assert.deepEqual(p.bag,before.bag);assert.equal(p.tickets,before.tickets);assert.equal(dailyShareChoice(p,{requestId:'s2',now}),null);
 assert.equal(dailyShareChoice(p,{requestId:'s1',policy:{confirmed:true,share:{enabled:true,reward:{coins:0,tickets:0,items:[]}}}}),null);
 assert.deepEqual(shareMessage(),{title:'秘境决斗',text:'秘境决斗：六位英雄、秘境探索与双人决斗。',url:null});assert.equal(RELEASE_AD_POLICY.confirmed,true);assert.equal(RELEASE_AD_POLICY.revive.enabled,false);assert.equal(RELEASE_AD_POLICY.result.enabled,false);
});
test('T72 operations normalization preserves replay evidence and fails closed on corrupt ledgers',()=>{
 assert.deepEqual(normalizeOperations(undefined),freshOperations());assert.equal(normalizeOperations({version:99}).blocked,true);assert.equal(normalizeOperations({version:1,receipts:['bad\nreceipt']}).blocked,true);
 const p=freshSolo();p.operations={...freshOperations(),receipts:['old'],revives:[{attemptId:'run1',receipt:'old'}],shareDays:['2026-11-11']};
 assert.deepEqual(normalizeOperations(p.operations),p.operations);assert.equal(normalizeOperations({...p.operations,revives:[{attemptId:'run1',receipt:'absent'}]}).blocked,true);
});
test('T72 imported archives cannot erase local revive/share/advertisement replay records',()=>{
 const a=freshOperations(),b=freshOperations();a.receipts=['imported'];a.shareDays=['2026-11-10'];b.receipts=['local'];b.revives=[{attemptId:'local-run',receipt:'local'}];b.shareDays=['2026-11-11'];b.interstitial={day:'2026-11-11',attemptIds:['result-run'],attempts:1,shown:1,lastAttemptAt:100,lastShownAt:110};
 const m=mergeOperationsForImport(a,b);assert.equal(m.blocked,false);assert.deepEqual(new Set(m.receipts),new Set(['imported','local']));assert.equal(m.revives[0].attemptId,'local-run');assert.deepEqual(m.shareDays,['2026-11-10','2026-11-11']);assert.deepEqual(m.interstitial,b.interstitial);
});
test('T72 native completion must match placement and be unused across operations/shop/daily',()=>{
 const p=freshSolo();p.operations=freshOperations();const ad=receipt('r1');assert.equal(assertOperationReceipt(p,ad,'reward-revive'),ad.receipt);
 for(const altered of [{...ad,completed:false},{...ad,placement:'reward-item'},{...ad,receipt:''}])assert.throws(()=>assertOperationReceipt(p,altered,'reward-revive'));
 p.shop.receipts=[ad.receipt];assert.throws(()=>assertOperationReceipt(p,ad,'reward-revive'),/已经使用/);p.shop.receipts=[];p.daily.adReceipts=[ad.receipt];assert.throws(()=>assertOperationReceipt(p,ad,'reward-revive'),/已经使用/);
});
test('T72 revive draft never mutates world/profile and saving failure leaves defeat and queues untouched',()=>{
 const {p,w}=failedWorld(),choice=campaignReviveChoice(w,p,{policy}),original=structuredClone(p),worldState={hp:w.player.hp,mp:w.player.mp,phase:w.campaign.state,queue:structuredClone(w.campaign.queue)};
 const prepared=campaignReviveDraft(p,w,choice,receipt('draft'),{policy});assert.equal(prepared.profile.operations.revives.length,1);assert.deepEqual(p,original);assert.equal(w.player.hp,0);
 assert.throws(()=>commitCampaignAdRevive({world:w,getProfile:()=>p,onSave:()=>false,choice,adResult:receipt('failed-save'),policy}),/保存/);assert.deepEqual(p,original);assert.deepEqual({hp:w.player.hp,mp:w.player.mp,phase:w.campaign.state,queue:w.campaign.queue},worldState);
});
test('T72 successful revive preserves real wave/remaining queue/enemies/loot/pet/team and only restores the current hero',()=>{
 let {p,w,before}=failedWorld({team:['fire','nature']});const c=w.campaign,player=w.player,targets=w.targets,drops=c.drops,companion={hp:27,mp:18,cooldowns:[3,4]},rewards={coins:89,xp:{fire:90},items:[]};w.companion=companion;c.rewards=rewards;w.time=8;player.cooldowns={q:4,e:8,r:12};
 const choice=campaignReviveChoice(w,p,{policy});let saves=0;
 const result=commitCampaignAdRevive({world:w,getWorld:()=>w,getProfile:()=>p,onSave:next=>{p=next;c.progression=p;saves++;return true;},choice,adResult:receipt('success'),policy});
 assert.equal(saves,1);assert.equal(w.campaign,c);assert.equal(w.player,player);assert.equal(w.targets,targets);assert.equal(c.drops,drops);assert.equal(c.rewards,rewards);assert.equal(w.companion,companion);assert.deepEqual(companion,{hp:27,mp:18,cooldowns:[3,4]});assert.equal(c.state,before.phase);assert.deepEqual(c.queue,before.queue);assert.equal(c.team[1].player.hp,0);
 assert.equal(result.hp,Math.ceil(player.maxHp*.5));assert.equal(result.mp,Math.ceil(player.maxMp*.5));assert.equal(player.dead,0);assert.deepEqual(player.cooldowns,{q:4,e:8,r:12});assert.equal(player.blinkUntil,8+CAMPAIGN_AD_REVIVE_RULES.invulnerability);assert.equal(hitPlayer(w,99,player.x-50,{dot:true}),false);assert.equal(player.hp,result.hp);
 const saved=structuredClone(p);c.state='defeat';player.hp=0;assert.equal(campaignReviveChoice(w,p,{policy}),null);assert.throws(()=>commitCampaignAdRevive({world:w,getProfile:()=>p,onSave:()=>true,choice,adResult:receipt('again'),policy}));assert.deepEqual(p,saved);
});
test('T72 resumed simulation continues the restored spawning queue instead of incorrectly clearing the wave',()=>{
 let {p,w,before}=failedWorld();const choice=campaignReviveChoice(w,p,{policy});commitCampaignAdRevive({world:w,getProfile:()=>p,onSave:next=>{p=next;w.campaign.progression=p;return true;},choice,adResult:receipt('spawn'),policy});
 assert(before.queue.some(v=>!v.done));stepCampaign(w,.01,{});assert.equal(w.campaign.state,'wave');assert.equal(w.campaign.queue.length,before.queue.length);
});
test('T72 same ID on a different world cannot accept the old world SDK callback',()=>{
 let {p,w}=failedWorld();const old=campaignReviveChoice(w,p,{policy}),other=failedWorld();campaignAdAttempt(other.w);assert.throws(()=>commitCampaignAdRevive({world:other.w,getProfile:()=>other.p,onSave:()=>true,choice:old,adResult:receipt('stale'),policy}));
 assert.throws(()=>commitCampaignAdRevive({world:w,getWorld:()=>other.w,getProfile:()=>p,onSave:()=>true,choice:old,adResult:receipt('abandoned'),policy}));assert.equal(w.player.hp,0);
});
test('T72 tutorial/endless/tower/twin/duel and surviving reserves are excluded; pet dungeon can revive',()=>{
 for(const mode of ['tutorial','endless','tower','twin']){const {p,w}=failedWorld({mode});assert.equal(campaignReviveChoice(w,p,{policy}),null);}
 const duel=failedWorld();duel.w.duel=true;assert.equal(campaignReviveChoice(duel.w,duel.p,{policy}),null);
 const pet=failedWorld({pet:true});assert(campaignReviveChoice(pet.w,pet.p,{policy}));
 const p=freshSolo();p.owned=['fire','nature'];const w=createCampaign('fire',1,{profile:p,team:['fire','nature']});w.player.hp=0;assert.equal(captureCampaignDefeat(w),null);
});
const resultContext=id=>({attemptId:id,mode:'story',settlementSaved:true,leaving:true});
test('T72 result interstitial requires confirmed frequency, saved settlement, leaving and non-duel context',()=>{
 const p=freshSolo();for(const ctx of [{...resultContext('r1'),leaving:false},{...resultContext('r1'),settlementSaved:false},{...resultContext('r1'),duel:true},{...resultContext('r1'),mode:'tower'},{...resultContext('r1'),mode:'tutorial'}])assert.equal(resultInterstitialChoice(p,ctx,{policy,now}),null);
 assert.equal(resultInterstitialChoice(p,resultContext('r1'),{policy:{...policy,result:{enabled:true}},now}),null);assert.equal(resultInterstitialChoice(p,resultContext('r1'),{policy:{...policy,confirmed:false},now}),null);
});
test('T72 reserve-before-request prevents same-attempt replay and respects cooldown/daily cap even after ad failure',()=>{
 let p=freshSolo();const original=structuredClone(p);assert.equal(commitResultInterstitialReservation({getProfile:()=>p,onSave:()=>false,context:resultContext('r1'),policy,now}),null);assert.deepEqual(p,original);
 const first=commitResultInterstitialReservation({getProfile:()=>p,onSave:next=>{p=next;return true;},context:resultContext('r1'),policy,now});assert(first);assert.equal(resultInterstitialChoice(p,resultContext('r1'),{policy,now:new Date(+now+120000)}),null);assert.equal(resultInterstitialShownDraft(p,first,{shown:false}),null);
 assert.equal(resultInterstitialChoice(p,resultContext('r2'),{policy,now:new Date(+now+1000)}),null);const second=reserveResultInterstitialDraft(p,resultContext('r2'),{policy,now:new Date(+now+60000)});p=second.profile;assert.equal(resultInterstitialChoice(p,resultContext('r3'),{policy,now:new Date(+now+120000)}),null);
 const nextDay=new Date(2026,10,12,12);assert(resultInterstitialChoice(p,resultContext('r3'),{policy,now:nextDay}));
});
test('T72 shown-result record is idempotent and does not mint rewards',()=>{
 const p=freshSolo(),r=reserveResultInterstitialDraft(p,resultContext('result'),{policy,now}),shown=resultInterstitialShownDraft(r.profile,r.choice,{shown:true},{now:new Date(+now+1000)});assert.equal(shown.operations.interstitial.shown,1);assert.equal(resultInterstitialShownDraft(shown,r.choice,{shown:true},{now:new Date(+now+2000)}),null);assert.equal(shown.coins,p.coins);assert.deepEqual(shown.bag,p.bag);
});
test('T72 share must actually open the matching native entry, current day, with unchanged configured reward',()=>{
 const p=freshSolo(),choice=dailyShareChoice(p,{requestId:'share-1',policy,now}),original=structuredClone(p);
 for(const opened of [{opened:false,requestId:'share-1'},{opened:true,requestId:'other'},{completed:true,requestId:'share-1'}])assert.throws(()=>shareRewardDraft(p,choice,opened,{policy,now}));
 assert.throws(()=>shareRewardDraft(p,choice,{opened:true,requestId:'share-1'},{policy,now:new Date(2026,10,12)}),/跨天/);assert.throws(()=>shareRewardDraft(p,{...choice,reward:{coins:99999}},{opened:true,requestId:'share-1'},{policy,now}),/变化/);assert.deepEqual(p,original);
});
test('T72 successful first daily share grants once, independent of actual sending; saving failure never grants',()=>{
 let p=freshSolo();const choice=dailyShareChoice(p,{requestId:'share-2',policy,now}),opened={opened:true,requestId:'share-2',sent:false},before=structuredClone(p);
 assert.throws(()=>commitDailyShare({getProfile:()=>p,onSave:()=>false,choice,opened,policy,now}),/保存/);assert.deepEqual(p,before);
 commitDailyShare({getProfile:()=>p,onSave:next=>{p=next;return true;},choice,opened,policy,now});assert.equal(p.coins,before.coins+100);assert.equal(p.bag.find(i=>i.type==='xpSmall').count,1);assert.equal(dailyShareChoice(p,{requestId:'share-again',policy,now}),null);assert.throws(()=>shareRewardDraft(p,choice,opened,{policy,now}));
 assert(dailyShareChoice(p,{requestId:'tomorrow',policy,now:new Date(2026,10,12,12)}));assert.deepEqual(p.daily,before.daily);assert.deepEqual(p.shop,before.shop);
});
test('T72 share URLs are owner-provided HTTPS only, and bad reward/currency overflow cannot consume the day',()=>{
 for(const url of [undefined,'http://old-preview.invalid/','javascript:alert(1)','https://name:secret@example.com/'])assert.equal(shareMessage({policy:{share:{url}}}).url,null);
 assert.equal(shareMessage({policy:{share:{url:'https://www.taptap.cn/app/123'}}}).url,null);assert.equal(shareMessage({policy:{share:{url:'https://www.taptap.cn/app/123',urlPublished:true}}}).url,'https://www.taptap.cn/app/123');
 const p=freshSolo();p.coins=10000000;const before=structuredClone(p),choice=dailyShareChoice(p,{requestId:'full',policy,now});assert.throws(()=>shareRewardDraft(p,choice,{opened:true,requestId:'full'},{policy,now}),/上限/);assert.deepEqual(p,before);
 const invalid={...policy,share:{enabled:true,reward:{coins:0,items:[{type:'missing',count:1}]}}},c=dailyShareChoice(p,{requestId:'bad-item',policy:invalid,now});assert.throws(()=>shareRewardDraft(p,c,{opened:true,requestId:'bad-item'},{policy:invalid,now}));assert.deepEqual(p,before);
});
test('T72 corrupted/overfull/import-conflicting operations fail closed rather than forget used rewards',()=>{
 assert.equal(normalizeOperations({...freshOperations(),shareDays:['2026-02-30']}).blocked,true);assert.equal(normalizeOperations({...freshOperations(),receipts:Array.from({length:4097},(_,i)=>'receipt-'+i)}).blocked,true);
 const a={...freshOperations(),receipts:['a'],revives:[{attemptId:'same',receipt:'a'}]},b={...freshOperations(),receipts:['b'],revives:[{attemptId:'same',receipt:'b'}]};assert.equal(mergeOperationsForImport(a,b).blocked,true);
 const p=freshSolo();p.operations={...freshOperations(),blocked:true};assert.equal(dailyShareChoice(p,{requestId:'blocked',policy,now}),null);assert.equal(resultInterstitialChoice(p,resultContext('blocked'),{policy,now}),null);
});
test('T72 a fresh world reusing an attempt label still rejects the former snapshot token',()=>{
 const {p,w}=failedWorld(),old=campaignReviveChoice(w,p,{policy}),p2=freshSolo(),other=createCampaign('fire',1,{profile:p2});campaignAdAttempt(other,old.attemptId);other.player.hp=0;captureCampaignDefeat(other);other.campaign.state='defeat';other.campaign.queue=[];
 assert(campaignReviveChoice(other,p2,{policy}));assert.throws(()=>campaignReviveDraft(p2,other,old,receipt('old-world'),{policy}));assert.equal(other.player.hp,0);
});

function memoryStorage(){const map=new Map();return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};}
test('T72 real shop/daily commit paths reject a receipt previously committed by revive without consuming rewards',()=>{
 let {p,w}=failedWorld();const storage=memoryStorage();assert(saveSolo(storage,p));const ad=receipt('operations-to-old-flows'),choice=campaignReviveChoice(w,p,{policy});
 commitCampaignAdRevive({world:w,getProfile:()=>p,onSave:next=>{if(!saveSolo(storage,next))return false;p=next;w.campaign.progression=p;return true;},choice,adResult:ad,policy});
 let saved=storage.getItem(SOLO_KEY);assert.throws(()=>commitShopReward(storage,'coins',{...ad,placement:'reward-coins'}),/已经领取/);assert.equal(storage.getItem(SOLO_KEY),saved);
 const latest=loadSolo(storage),task=dailyView(latest,now).tasks[0];advanceDaily(latest,task.metric,task.goal,now);assert(saveSolo(storage,latest));p=latest;const dailyChoice=dailyChestChoice(p,0,now);saved=storage.getItem(SOLO_KEY);const before=structuredClone(p);let saves=0;
 assert.throws(()=>commitDailyChest({getProfile:()=>p,onSave:next=>{saves++;if(!saveSolo(storage,next))return false;p=next;return true;},choice:dailyChoice,double:true,adResult:{...ad,placement:'reward-coins'},now}),/已经使用/);
 assert.equal(saves,0);assert.equal(storage.getItem(SOLO_KEY),saved);assert.deepEqual(p,before);
});
test('T72 real shop and daily rewards remain usable for new receipts and cannot replay into a revive',()=>{
 const storage=memoryStorage();let p=freshSolo();assert(saveSolo(storage,p));const shopAd=receipt('shop-to-revive','reward-coins');p=commitShopReward(storage,'coins',shopAd);assert.equal(p.coins,600);assert.throws(()=>assertOperationReceipt(loadSolo(storage),{...shopAd,placement:'reward-revive'},'reward-revive'),/已经使用/);
 const task=dailyView(p,now).tasks[0];advanceDaily(p,task.metric,task.goal,now);assert(saveSolo(storage,p));const choice=dailyChestChoice(p,0,now),dailyAd=receipt('daily-to-revive','reward-coins');
 commitDailyChest({getProfile:()=>p,onSave:next=>{if(!saveSolo(storage,next))return false;p=next;return true;},choice,double:true,adResult:dailyAd,now});assert.equal(p.coins,800);assert.throws(()=>assertOperationReceipt(loadSolo(storage),{...dailyAd,placement:'reward-revive'},'reward-revive'),/已经使用/);
});
test('T72 real complete archive export/import replaces economy while retaining local daily-share and revive replay evidence',async()=>{
 const storage=memoryStorage(),foreignStorage=memoryStorage();let {p,w}=failedWorld();assert(saveSolo(storage,p));const reviveAd=receipt('before-import'),reviveChoice=campaignReviveChoice(w,p,{policy});
 commitCampaignAdRevive({world:w,getProfile:()=>p,onSave:next=>{if(!saveSolo(storage,next))return false;p=next;w.campaign.progression=p;return true;},choice:reviveChoice,adResult:reviveAd,policy});
 const share=dailyShareChoice(p,{requestId:'before-import-share',now});commitDailyShare({getProfile:()=>p,onSave:next=>{if(!saveSolo(storage,next))return false;p=next;return true;},choice:share,opened:{opened:true,requestId:share.requestId,sent:false},now});assert.equal(p.coins,400);
 const foreign=freshSolo();foreign.coins=777;foreign.tickets=2;foreign.bag=[{id:'item-8',type:'stoneSmall',count:4}];foreign.operations.shareDays=['2026-11-10'];assert(saveSolo(foreignStorage,foreign));const exported=await exportSave(foreignStorage);let backup=null;
 await importSave(storage,exported,{backup:text=>{backup=JSON.parse(text);assert.equal(loadSolo(storage).coins,400);}});const loaded=loadSolo(storage);
 assert(backup.entries[SOLO_KEY]);assert.equal(loaded.coins,777);assert.equal(loaded.tickets,2);assert.deepEqual(loaded.bag,foreign.bag);assert(loaded.operations.shareDays.includes('2026-11-11'));assert(loaded.operations.shareDays.includes('2026-11-10'));assert(loaded.operations.receipts.includes(reviveAd.receipt));assert(loaded.operations.revives.some(c=>c.attemptId===reviveChoice.attemptId));
 assert.equal(dailyShareChoice(loaded,{requestId:'after-import-share',now}),null);assert.throws(()=>assertOperationReceipt(loaded,reviveAd,'reward-revive'),/已经使用/);
});
test('T72 real save merges operation evidence from a stale profile and failed import restores the prior archive',async()=>{
 const storage=memoryStorage();let p=freshSolo();assert(saveSolo(storage,p));const stale=loadSolo(storage),choice=dailyShareChoice(p,{requestId:'persist-share',now});commitDailyShare({getProfile:()=>p,onSave:next=>{if(!saveSolo(storage,next))return false;p=next;return true;},choice,opened:{opened:true,requestId:choice.requestId},now});
 assert(saveSolo(storage,stale));assert.equal(dailyShareChoice(loadSolo(storage),{requestId:'stale-retry',now}),null);
 const foreign=memoryStorage(),next=freshSolo();next.coins=999;assert(saveSolo(foreign,next));const text=await exportSave(foreign),before=storage.getItem(SOLO_KEY);let fail=true;
 const failing={...storage,setItem:(key,value)=>{if(fail&&key===SOLO_KEY){fail=false;throw Error('fixture storage full');}storage.setItem(key,value);}};
 await assert.rejects(importSave(failing,text),/导入失败/);assert.equal(storage.getItem(SOLO_KEY),before);assert.equal(dailyShareChoice(loadSolo(storage),{requestId:'failed-import-retry',now}),null);
});
