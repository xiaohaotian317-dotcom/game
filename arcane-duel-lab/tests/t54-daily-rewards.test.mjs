import test from 'node:test';
import assert from 'node:assert/strict';
import {freshSolo} from '../dist/src/campaign-profile.mjs';
import {DAILY_TASKS,dailyView,advanceDaily,normalizeDaily,DAILY_AD_RECEIPT_LIMIT,dailyDate} from '../dist/src/daily-quests.mjs';
import {dailyChestChoice,dailyRewardDraft,commitDailyChest} from '../dist/src/daily-quest-rewards.mjs';

const now=new Date(2026,10,10,12),tomorrow=new Date(2026,10,11,12);
function ready(date=now){const p=freshSolo();for(const task of DAILY_TASKS)advanceDaily(p,task.metric,task.goal,date);return p;}
function completed(receipt){return {completed:true,receipt,placement:'reward-coins'};}
function store(profile=ready()){let current=profile;return {getProfile:()=>current,onSave:next=>{current=next;return true;}};}

test('completing tasks and opening a chest choice do not award coins or mark a chest open',()=>{
 const p=ready(),before=structuredClone(p),choice=dailyChestChoice(p,0,now);assert.equal(choice.reward,100);assert.equal(p.coins,300);assert.equal(dailyView(p,now).count,0);assert.deepEqual(p,before);assert.throws(()=>dailyChestChoice(p,1,now),/尚不可领取/);
});
test('three manually claimed ordinary chests retain 100,100,300 and exact base progress',()=>{
 const s=store();for(let tier=0;tier<3;tier++){const result=commitDailyChest({...s,choice:dailyChestChoice(s.getProfile(),tier,now),now});assert.equal(result.reward,[100,100,300][tier]);assert.equal(result.bonus,0);}
 const view=dailyView(s.getProfile(),now);assert.equal(s.getProfile().coins,800);assert.equal(view.total,500);assert.equal(view.baseTotal,500);assert.equal(view.bonusTotal,0);assert.equal(view.count,3);assert.throws(()=>dailyChestChoice(s.getProfile(),3,now));
});
test('three distinct completed ads double only their selected chest to a 1000 total daily maximum',()=>{
 const s=store();for(let tier=0;tier<3;tier++){const result=commitDailyChest({...s,choice:dailyChestChoice(s.getProfile(),tier,now),double:true,adResult:completed('daily-ad-'+tier),now});assert.equal(result.reward,[200,200,600][tier]);}
 const view=dailyView(s.getProfile(),now);assert.equal(s.getProfile().coins,1300);assert.equal(view.baseTotal,500);assert.equal(view.bonusTotal,500);assert.equal(view.total,1000);assert.equal(view.adReceipts.length,3);assert.equal(view.adBonuses.length,3);
});
test('mixed normal and doubled choices do not later double an already ordinary-claimed chest',()=>{
 const s=store(),first=dailyChestChoice(s.getProfile(),0,now);commitDailyChest({...s,choice:first,now});assert.throws(()=>commitDailyChest({...s,choice:first,double:true,adResult:completed('late-ad'),now}),/已变化/);commitDailyChest({...s,choice:dailyChestChoice(s.getProfile(),1,now),double:true,adResult:completed('second-ad'),now});assert.equal(s.getProfile().coins,600);assert.equal(dailyView(s.getProfile(),now).baseTotal,200);assert.equal(dailyView(s.getProfile(),now).bonusTotal,100);
});
test('cancelled, failed, malformed or wrong-placement ad cannot award or consume the ordinary choice',()=>{
 for(const adResult of [{completed:false},{completed:true},{completed:true,receipt:''},{completed:true,receipt:'bad\n'},{completed:true,receipt:'valid',placement:'reward-ticket'}]){const s=store(),choice=dailyChestChoice(s.getProfile(),0,now),before=structuredClone(s.getProfile());assert.throws(()=>commitDailyChest({...s,choice,double:true,adResult,now}),/广告尚未完成/);assert.deepEqual(s.getProfile(),before);assert.equal(commitDailyChest({...s,choice,now}).reward,100);}
});
test('save failure leaves no open chest, extra coins or consumed receipt and ordinary retry succeeds',()=>{
 const s=store(),choice=dailyChestChoice(s.getProfile(),0,now),before=structuredClone(s.getProfile());assert.throws(()=>commitDailyChest({...s,onSave:()=>false,choice,double:true,adResult:completed('retry-ad'),now}),/存档写入失败/);assert.deepEqual(s.getProfile(),before);const result=commitDailyChest({...s,choice,now});assert.equal(result.reward,100);assert.deepEqual(result.profile.daily.adReceipts,[]);
});
test('duplicate chest and reused ad receipts are rejected after saved state and across local days',()=>{
 const s=store(),first=dailyChestChoice(s.getProfile(),0,now);commitDailyChest({...s,choice:first,double:true,adResult:completed('one-receipt'),now});assert.throws(()=>commitDailyChest({...s,choice:first,double:true,adResult:completed('another-receipt'),now}),/已变化/);assert.throws(()=>commitDailyChest({...s,choice:dailyChestChoice(s.getProfile(),1,now),double:true,adResult:completed('one-receipt'),now}),/已经使用/);
 for(const task of DAILY_TASKS)advanceDaily(s.getProfile(),task.metric,task.goal,tomorrow);const next=dailyChestChoice(s.getProfile(),0,tomorrow);assert.throws(()=>commitDailyChest({...s,choice:next,double:true,adResult:completed('one-receipt'),now:tomorrow}),/已经使用/);assert.equal(dailyView(s.getProfile(),tomorrow).count,0);assert.equal(commitDailyChest({...s,choice:next,now:tomorrow}).reward,100);
});
test('a callback arriving after midnight cannot award yesterday chest or consume today ordinary opportunity',()=>{
 const s=store(),choice=dailyChestChoice(s.getProfile(),0,now),before=structuredClone(s.getProfile());assert.throws(()=>commitDailyChest({...s,choice,double:true,adResult:completed('too-late'),now:tomorrow}),/跨天/);assert.deepEqual(s.getProfile(),before);for(const task of DAILY_TASKS)advanceDaily(s.getProfile(),task.metric,task.goal,tomorrow);assert.equal(commitDailyChest({...s,choice:dailyChestChoice(s.getProfile(),0,tomorrow),now:tomorrow}).reward,100);
});
test('daily transaction re-reads live profile after ad and retains intervening progress or currency changes',()=>{
 const s=store(),choice=dailyChestChoice(s.getProfile(),0,now);s.getProfile().coins+=44;s.getProfile().tickets=7;s.getProfile().heroes.fire.exp=19;const result=commitDailyChest({...s,choice,double:true,adResult:completed('current-data'),now});assert.equal(result.profile.coins,544);assert.equal(result.profile.tickets,7);assert.equal(result.profile.heroes.fire.exp,19);assert.equal(result.profile.daily.claimed.length,1);
});
test('legacy claimed chests stay claimed with no invented ad bonus, while corrupt/full ledgers retain normal claim',()=>{
 const p=ready(),view=dailyView(p,now);p.daily.claimed=[view.taskIds[0]];delete p.daily.adReceipts;delete p.daily.adBonuses;delete p.daily.adBlocked;const migrated=normalizeDaily(p.daily,now);assert.deepEqual(migrated.claimed,p.daily.claimed);assert.deepEqual(migrated.adBonuses,[]);assert.equal(dailyView({...p,daily:migrated},now).total,100);
 for(const ledger of [{adBlocked:true},{adReceipts:['bad\n']},{adReceipts:Array.from({length:DAILY_AD_RECEIPT_LIMIT},(_,i)=>'old-'+i)}]){const s=store();Object.assign(s.getProfile().daily,ledger);const choice=dailyChestChoice(s.getProfile(),0,now);assert.throws(()=>commitDailyChest({...s,choice,double:true,adResult:completed('new-ad'),now}),/核对|已满/);assert.equal(commitDailyChest({...s,choice,now}).reward,100);}
});
test('same receipt already used by shop and coin capacity cannot silently truncate daily rewards',()=>{
 const p=ready();p.shop.receipts=['shop-used'];assert.throws(()=>dailyRewardDraft(p,dailyChestChoice(p,0,now),{double:true,adResult:completed('shop-used'),now}),/已经使用/);p.coins=9999950;assert.throws(()=>dailyRewardDraft(p,dailyChestChoice(p,0,now),{now}),/存档上限/);assert.equal(p.daily.claimed.length,0);
});

test('400 new daily selections are date-stable with exactly five unique tasks and two or three shop objectives',()=>{
 const seen=new Set(),shopCounts=new Set();for(let day=0;day<400;day++){const date=new Date(2026,0,1+day,12),p=freshSolo();delete p.daily;const view=dailyView(p,date),shops=view.tasks.filter(t=>t.adRelated).length,combat=view.tasks.filter(t=>!t.adRelated).length;assert.equal(view.tasks.length,5);assert.equal(new Set(view.taskIds).size,5);assert.ok(shops===2||shops===3);assert.ok(combat===2||combat===3);shopCounts.add(shops);const sameDay=freshSolo();delete sameDay.daily;assert.deepEqual(dailyView(sameDay,date).taskIds,view.taskIds);for(const task of view.tasks)seen.add(task.id);}
 assert.deepEqual([...shopCounts].sort(),[2,3]);
 for(const id of ['shop-coins','shop-stone','shop-exp','shop-ticket'])assert.ok(seen.has(id));
 assert.equal(DAILY_TASKS.find(t=>t.id==='hunt').goal,35);assert.equal(DAILY_TASKS.find(t=>t.id==='boss').goal,2);assert.equal(DAILY_TASKS.find(t=>t.id==='skills').goal,12);
});
test('existing same-day legacy goals, progress and claims do not reroll or become incomplete after harder defaults',()=>{
 const p=freshSolo();p.daily={day:dailyDate(now),taskIds:['hunt','boss','skills','attacks','clear'],progress:{minions:20,bosses:1,skills:5,attacks:15,clears:1},claimed:['hunt']};const view=dailyView(p,now);assert.deepEqual(view.taskIds,['hunt','boss','skills','attacks','clear']);assert.deepEqual(view.tasks.map(t=>t.goal),[20,1,5,15,1]);assert.ok(view.tasks.every(t=>t.complete));assert.equal(view.count,1);assert.equal(view.total,100);assert.match(view.tasks[0].description,/20/);const stable=normalizeDaily(JSON.parse(JSON.stringify(p.daily)),now);assert.deepEqual(stable,p.daily);
 const next=dailyView(p,tomorrow);for(const task of next.tasks)assert.equal(task.goal,DAILY_TASKS.find(t=>t.id===task.id).goal);assert.equal(next.count,0);
});
test('shop progress metrics start at zero and ticket objective waits for an actual committed ticket reward',()=>{
 const p=ready();p.daily.taskIds=['shop-coins','shop-ticket','hunt','boss','skills'];p.daily.taskGoals={'shop-coins':1,'shop-ticket':1,hunt:35,boss:2,skills:12};p.daily.progress.shopCoins=0;p.daily.progress.shopStone=0;p.daily.progress.shopExperience=0;p.daily.progress.shopTicket=0;
 assert.equal(dailyView(p,now).tasks.filter(t=>t.adRelated&&t.complete).length,0);assert.equal(advanceDaily(p,'shopOpened',1,now),false);
 assert.equal(advanceDaily(p,'shopTicketAdViewed',1,now),false);assert.equal(dailyView(p,now).tasks.find(t=>t.id==='shop-ticket').complete,false);
 for(const metric of ['shopCoins','shopStone','shopExperience','shopTicket'])assert.equal(advanceDaily(p,metric,1,now),true);
 assert.equal(dailyView(p,now).tasks.filter(t=>t.adRelated&&t.complete).length,2);assert.equal(p.daily.progress.shopTicket,1);assert.equal(p.coins,300);assert.equal(p.daily.claimed.length,0);
});
