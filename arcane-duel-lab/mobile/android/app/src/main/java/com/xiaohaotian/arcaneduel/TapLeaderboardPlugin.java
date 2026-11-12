package com.xiaohaotian.arcaneduel;

import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.taptap.sdk.login.TapTapLogin;
import com.taptap.sdk.login.TapTapAccount;
import com.taptap.sdk.leaderboard.androidx.TapTapLeaderboard;
import com.taptap.sdk.leaderboard.callback.TapTapLeaderboardResponseCallback;
import com.taptap.sdk.leaderboard.data.request.LeaderboardCollection;
import com.taptap.sdk.leaderboard.data.request.SubmitScoresRequest;
import com.taptap.sdk.leaderboard.data.response.LeaderboardScoresResponse;
import com.taptap.sdk.leaderboard.data.response.SubmitScoresResponse;
import com.taptap.sdk.leaderboard.data.response.UserScoreResponse;
import com.taptap.sdk.leaderboard.data.response.common.Leaderboard;
import com.taptap.sdk.leaderboard.data.response.common.Score;
import org.json.JSONArray;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Real TapSDK 4.11.0 cloud leaderboard. No account tokens or client-made rankings. */
@CapacitorPlugin(name="TapLeaderboard")
public final class TapLeaderboardPlugin extends Plugin {
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Map<PluginCall,Runnable> pending=new HashMap<>();
    private boolean destroyed;
    private JSObject lastPeriod;
    private JSONArray lastPeriods=new JSONArray();
    private TapTowerLedger ledger;
    private static final class Query {
        final PluginCall call;final int limit;final String requested,account;
        final List<JSObject> entries=new ArrayList<>();final Set<String> pages=new HashSet<>();
        String currentToken="",token="",next;JSObject period;JSONArray periods=new JSONArray();int pageCount;
        boolean historyOnly;
        Query(PluginCall call,int limit,String requested,String account){this.call=call;this.limit=limit;this.requested=requested;this.account=account;}
    }
    private TapBattlePlugin loginBridge(){PluginHandle handle=getBridge().getPlugin("TapBattle");return handle!=null&&handle.getInstance() instanceof TapBattlePlugin?(TapBattlePlugin)handle.getInstance():null;}
    private boolean authenticated(){TapBattlePlugin login=loginBridge();return login!=null&&login.isAuthenticated();}
    private boolean configured(){return !BuildConfig.TAP_CLIENT_ID.trim().isEmpty()&&!BuildConfig.TAP_CLIENT_TOKEN.trim().isEmpty()&&BuildConfig.TOWER_LEADERBOARD_ID.matches("[A-Za-z0-9_-]{1,128}");}
    private String accountId(){TapTapAccount account=authenticated()?TapTapLogin.getCurrentTapAccount():null;return account==null?"":"tap:"+TapTowerLedger.digest(BuildConfig.TAP_CLIENT_ID+":"+account.getOpenId());}
    private JSObject base(){JSObject out=new JSObject();out.put("provider","taptap");out.put("scope","global");out.put("scoreAuthority","client");out.put("weeklyRewards",false);out.put("weeklyClaimAtomic",false);out.put("cloudLedgerSupported",true);out.put("rewardAuthority","unavailable");out.put("sdkVersion","4.11.0");out.put("configured",configured());String id=accountId();if(!id.isEmpty())out.put("accountId",id);return out;}
    private JSObject unavailable(String reason){JSObject out=base();out.put("available",false);out.put("connected",false);out.put("submitted",false);out.put("reason",reason);out.put("entries",new JSONArray());return out;}
    private boolean ready(PluginCall call){if(!configured()){call.resolve(unavailable("notConfigured"));return false;}if(!authenticated()){call.resolve(unavailable("loginRequired"));return false;}if(destroyed){call.resolve(unavailable("closed"));return false;}return true;}
    @PluginMethod public void status(PluginCall call){main.post(()->{boolean loggedIn=authenticated();JSObject out=base();out.put("loggedIn",loggedIn);out.put("available",configured()&&loggedIn&&!destroyed);out.put("connected",configured()&&loggedIn&&!destroyed);if(!configured())out.put("reason","notConfigured");else if(!loggedIn)out.put("reason","loginRequired");if(lastPeriod!=null)out.put("period",lastPeriod);out.put("availablePeriods",lastPeriods);call.resolve(out);});}
    @PluginMethod public void login(PluginCall call){main.post(()->{
        if(!Boolean.TRUE.equals(call.getBoolean("privacyAccepted",false))){call.reject("请先阅读并同意TapTap隐私说明","privacyRequired");return;}
        if(!configured()){call.resolve(unavailable("notConfigured"));return;}
        TapBattlePlugin login=loginBridge();if(login==null){call.resolve(unavailable("loginUnavailable"));return;}login.login(call);
    });}
    private boolean begin(PluginCall call){return begin(call,30000);}
    private boolean begin(PluginCall call,long milliseconds){if(pending.size()>=3){call.resolve(unavailable("busy"));return false;}Runnable timer=()->{if(pending.remove(call)!=null)call.resolve(unavailable("timeout"));};pending.put(call,timer);main.postDelayed(timer,milliseconds);return true;}
    private boolean current(PluginCall call){return !destroyed&&pending.containsKey(call);}
    private void resolve(PluginCall call,JSObject out){Runnable timer=pending.remove(call);if(timer!=null){main.removeCallbacks(timer);call.resolve(out);}}
    private void failure(PluginCall call,int code){JSObject out=unavailable("sdkFailed");out.put("errorCode",code);resolve(call,out);}
    private static String text(String value,int length){if(value==null)return "";String clean=value.replaceAll("[\\p{Cntrl}\\p{Cf}]"," ").trim();return clean.substring(0,Math.min(clean.length(),length));}
    private static String token(Leaderboard.Period period){return period==null?"":text(period.getPeriodToken(),256);}
    private static JSObject period(Leaderboard.Period value,String currentToken){JSObject out=new JSObject();out.put("token",token(value));out.put("label",value==null?"":text(value.getDisplay(),160));out.put("isCurrent",token(value).equals(currentToken));return out;}
    private static JSONArray periods(Leaderboard metadata,String currentToken){JSONArray out=new JSONArray();if(metadata!=null&&metadata.getAvailablePeriods()!=null)for(Leaderboard.Period value:metadata.getAvailablePeriods())out.put(period(value,currentToken));return out;}
    private static String avatar(String value){try{if(value==null||value.length()>2048)return "";URI uri=new URI(value);return "https".equalsIgnoreCase(uri.getScheme())&&uri.getHost()!=null&&uri.getUserInfo()==null?value:"";}catch(Exception ignored){return "";}}
    private JSObject entry(Score score){
        if(score==null||score.getScore()==null||score.getScore()<0||score.getScore()>TowerRunContract.MAX_FLOOR)return null;
        Long rank=TowerRankContract.verifiedRank(score.getRank(),score.getRankDisplay());
        JSObject out=new JSObject();out.put("rankVerified",rank!=null);if(rank!=null)out.put("rank",rank.longValue());out.put("rankDisplay",text(score.getRankDisplay(),64));out.put("floor",score.getScore().longValue());out.put("score",score.getScore().longValue());Score.User user=score.getUser();String name=user==null?"旅者":text(user.getName(),64);out.put("name",name.isEmpty()?"旅者":name);out.put("displayName",name.isEmpty()?"旅者":name);out.put("avatar",user==null?"":avatar(user.getAvatar()));TapTapAccount account=TapTapLogin.getCurrentTapAccount();out.put("isMe",user!=null&&account!=null&&account.getOpenId().equals(user.getOpenid()));return out;
    }
    @PluginMethod public void leaderboard(PluginCall call){main.post(()->{
        if(!ready(call))return;
        final int limit;try{limit=TowerRunContract.limit(call.getData().opt("limit"));}catch(IllegalArgumentException error){call.resolve(unavailable(error.getMessage()));return;}
        String requested=call.getString("periodToken","");if(requested.length()>256||requested.matches(".*[\\p{Cntrl}].*")){call.resolve(unavailable("invalidPeriod"));return;}
        if(!begin(call))return;Query query=new Query(call,limit,requested,accountId());loadCurrent(query);
    });}
    private void loadCurrent(Query query){
        try{TapTapLeaderboard.loadLeaderboardScores(BuildConfig.TOWER_LEADERBOARD_ID,LeaderboardCollection.PUBLIC,null,null,new TapTapLeaderboardResponseCallback<LeaderboardScoresResponse>(){
            @Override public void onSuccess(LeaderboardScoresResponse data){main.post(()->{
                if(!current(query.call))return;if(!query.account.equals(accountId())){resolve(query.call,unavailable("accountChanged"));return;}Leaderboard metadata=data==null?null:data.getLeaderboard();if(metadata==null||query.historyOnly&&metadata.getPeriod()==null){resolve(query.call,unavailable("invalidResponse"));return;}
                query.currentToken=token(metadata.getPeriod());query.token=query.requested.isEmpty()?query.currentToken:query.requested;query.periods=periods(metadata,query.currentToken);boolean found=query.token.equals(query.currentToken);query.period=period(metadata.getPeriod(),query.currentToken);
                for(int i=0;i<query.periods.length();i++){org.json.JSONObject p=query.periods.optJSONObject(i);if(p!=null&&query.token.equals(p.optString("token"))){found=true;try{query.period=new JSObject(p.toString());}catch(Exception ignored){}}}
                if(!found){resolve(query.call,unavailable("periodNotAvailable"));return;}
                lastPeriod=period(metadata.getPeriod(),query.currentToken);lastPeriods=query.periods;
                if(query.historyOnly){if(query.token.equals(query.currentToken)){resolve(query.call,unavailable("periodNotEnded"));return;}loadMine(query);return;}
                if(query.token.equals(query.currentToken))acceptPage(query,data);else loadPage(query,null);
            });}
            @Override public void onFailure(int code,String message){main.post(()->failure(query.call,code));}
        });}catch(Exception error){resolve(query.call,unavailable("sdkFailed"));}
    }
    private void loadPage(Query query,String next){
        if(!current(query.call))return;
        try{TapTapLeaderboard.loadLeaderboardScores(BuildConfig.TOWER_LEADERBOARD_ID,LeaderboardCollection.PUBLIC,next,query.token.isEmpty()?null:query.token,new TapTapLeaderboardResponseCallback<LeaderboardScoresResponse>(){
            @Override public void onSuccess(LeaderboardScoresResponse data){main.post(()->acceptPage(query,data));}
            @Override public void onFailure(int code,String message){main.post(()->failure(query.call,code));}
        });}catch(Exception error){resolve(query.call,unavailable("sdkFailed"));}
    }
    private void acceptPage(Query query,LeaderboardScoresResponse data){
        if(!current(query.call))return;if(!query.account.equals(accountId())){resolve(query.call,unavailable("accountChanged"));return;}if(data==null||data.getLeaderboard()==null||!query.token.equals(token(data.getLeaderboard().getPeriod()))){resolve(query.call,unavailable("periodMismatch"));return;}
        query.pageCount++;if(data.getScores()!=null)for(Score score:data.getScores()){JSObject row=entry(score);if(row!=null&&query.entries.size()<query.limit)query.entries.add(row);}
        String next=data.getNextPage();if(query.entries.size()<query.limit&&next!=null&&!next.isEmpty()&&next.length()<=2048&&query.pageCount<8&&query.pages.add(next)){loadPage(query,next);return;}loadMine(query);
    }
    private void loadMine(Query query){
        try{TapTapLeaderboard.loadCurrentPlayerLeaderboardScore(BuildConfig.TOWER_LEADERBOARD_ID,LeaderboardCollection.PUBLIC,query.token.isEmpty()?null:query.token,new TapTapLeaderboardResponseCallback<UserScoreResponse>(){
            @Override public void onSuccess(UserScoreResponse data){main.post(()->{
                if(!current(query.call))return;if(!query.account.equals(accountId())){resolve(query.call,unavailable("accountChanged"));return;}if(data==null||data.getLeaderboard()==null||!query.token.equals(token(data.getLeaderboard().getPeriod()))){resolve(query.call,unavailable("periodMismatch"));return;}
                Score score=data.getCurrentUserScore();JSObject mine=entry(score);if(query.historyOnly){if(score==null){resolve(query.call,unavailable("noScore"));return;}if(mine==null||!mine.optBoolean("rankVerified",false)){resolve(query.call,unavailable("rankUnverified"));return;}}
                JSObject out=base();out.put("available",true);out.put("connected",true);out.put("entries",new JSONArray(query.entries));out.put("period",query.period);out.put("periodToken",query.token);out.put("currentPeriodToken",query.currentToken);out.put("availablePeriods",query.periods);out.put("historical",!query.token.equals(query.currentToken));out.put("ended",!query.token.equals(query.currentToken));out.put("serverPeriod",true);if(mine!=null){out.put("myEntry",mine);if(query.historyOnly)out.put("rank",mine.optLong("rank"));}resolve(query.call,out);
            });}
            @Override public void onFailure(int code,String message){main.post(()->failure(query.call,code));}
        });}catch(Exception error){resolve(query.call,unavailable("sdkFailed"));}
    }
    @PluginMethod public void submitRun(PluginCall call){main.post(()->{
        if(!ready(call))return;final String expectedAccount=accountId();final TowerRunContract run;try{run=new TowerRunContract(call.getData());}catch(IllegalArgumentException error){call.resolve(unavailable(error.getMessage()));return;}if(!begin(call))return;
        Object requestedPeriod=call.getData().opt("periodToken");if(!(requestedPeriod instanceof String)||((String)requestedPeriod).length()>256){resolve(call,unavailable("periodRequired"));return;}
        try{TapTapLeaderboard.loadCurrentPlayerLeaderboardScore(BuildConfig.TOWER_LEADERBOARD_ID,LeaderboardCollection.PUBLIC,null,new TapTapLeaderboardResponseCallback<UserScoreResponse>(){
            @Override public void onSuccess(UserScoreResponse data){main.post(()->{if(!current(call))return;if(!expectedAccount.equals(accountId())){resolve(call,unavailable("accountChanged"));return;}if(data==null||data.getLeaderboard()==null||!requestedPeriod.equals(token(data.getLeaderboard().getPeriod()))){resolve(call,unavailable("periodChanged"));return;}submitCurrent(call,run,expectedAccount);});}
            @Override public void onFailure(int code,String message){main.post(()->failure(call,code));}
        });}catch(Exception error){resolve(call,unavailable("sdkFailed"));}
    });}
    private void submitCurrent(PluginCall call,TowerRunContract run,String expectedAccount){
        if(!current(call))return;if(!expectedAccount.equals(accountId())){resolve(call,unavailable("accountChanged"));return;}
        try{TapTapLeaderboard.submitScores(Collections.singletonList(new SubmitScoresRequest.ScoreItem(BuildConfig.TOWER_LEADERBOARD_ID,run.floor)),new TapTapLeaderboardResponseCallback<SubmitScoresResponse>(){
            @Override public void onSuccess(SubmitScoresResponse data){main.post(()->{if(!current(call))return;if(!expectedAccount.equals(accountId())){resolve(call,unavailable("accountChanged"));return;}JSObject out=base();out.put("available",true);out.put("submitted",true);out.put("floor",run.floor);resolve(call,out);});}
            @Override public void onFailure(int code,String message){main.post(()->failure(call,code));}
        });}catch(Exception error){resolve(call,unavailable("sdkFailed"));}
    }
    @PluginMethod public void getHistoricalRank(PluginCall call){main.post(()->{if(!ready(call))return;String requested=call.getString("periodToken","");if(requested.isEmpty()||requested.length()>256||requested.matches(".*[\\p{Cntrl}\\p{Cf}].*")){call.resolve(unavailable("invalidPeriod"));return;}if(!begin(call))return;Query query=new Query(call,1,requested,accountId());query.historyOnly=true;loadCurrent(query);});}
    private TapTowerLedger cloudLedger(){if(ledger==null)ledger=new TapTowerLedger(getContext());return ledger;}
    private TapTowerLedger.Callback ledgerResult(PluginCall call,String id){return out->main.post(()->{if(!id.equals(accountId()))resolve(call,unavailable("accountChanged"));else resolve(call,out);});}
    @PluginMethod public void loadWeeklyLedger(PluginCall call){main.post(()->{if(!ready(call)||!begin(call,45000))return;String id=accountId();cloudLedger().load(id,ledgerResult(call,id));});}
    @PluginMethod public void writeWeeklyLedger(PluginCall call){main.post(()->call.resolve(unavailable("atomicClaimUnavailable")));}
    @Override protected void handleOnDestroy(){main.post(()->{for(PluginCall call:new ArrayList<>(pending.keySet()))resolve(call,unavailable("closed"));destroyed=true;});}
}
