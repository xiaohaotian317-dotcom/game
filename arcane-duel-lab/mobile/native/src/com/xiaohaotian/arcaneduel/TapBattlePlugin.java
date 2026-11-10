package com.xiaohaotian.arcaneduel;

import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.taptap.sdk.core.TapTapSdk;
import com.taptap.sdk.core.TapTapSdkOptions;
import com.taptap.sdk.core.TapTapRegion;
import com.taptap.sdk.initializer.api.TapInitCallback;
import com.taptap.sdk.kit.internal.callback.TapTapCallback;
import com.taptap.sdk.kit.internal.exception.TapTapException;
import com.taptap.sdk.login.Scopes;
import com.taptap.sdk.login.TapTapAccount;
import com.taptap.sdk.login.TapTapLogin;
import com.taptap.sdk.battle.*;
import com.taptap.sdk.battle.model.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Typed TapSDK 4.11.0 adapter; no SDK initialization before explicit privacy consent. */
@CapacitorPlugin(name="TapBattle")
public final class TapBattlePlugin extends Plugin implements TapOnlineBattleCallback {
    private final Handler main=new Handler(Looper.getMainLooper());
    private final Map<PluginCall,Runnable> pending=new HashMap<>();
    private final ArrayDeque<Long> controlTimes=new ArrayDeque<>();
    private volatile boolean initialized,initializing,connected,frameActive,destroyed;
    private String playerId="";
    private JSONObject currentRoom;
    private volatile int frameSyncId;
    private long latestFrameId=-1;
    private int frameCount,framePending;
    private volatile int frameCreditGeneration;
    private TapInitCallback initCallback;

    @PluginMethod public void status(PluginCall call){main.post(()->{
        TapTapAccount account=initialized?TapTapLogin.getCurrentTapAccount():null;
        call.resolve(js(LanRoomService.obj("configured",configured(),"privacyAccepted",consented(),"initialized",initialized,
            "loggedIn",account!=null,"connected",connected,"playerId",playerId,"room",currentRoom,
            "frameActive",frameActive,"frameSyncId",frameSyncId,"sdkVersion","4.11.0","build",LanRoomService.BUILD)));
    });}
    @PluginMethod public void login(PluginCall call){main.post(()->{
        if(!configured()){call.reject("尚未配置 TapTap 游戏应用，局域网与单机可正常使用","notConfigured");return;}
        if(Boolean.TRUE.equals(call.getBoolean("privacyAccepted",false)))getContext().getSharedPreferences("arcane-privacy",0).edit().putBoolean("tap",true).apply();
        if(!consented()){call.reject("请先阅读并同意隐私与 TapTap SDK 说明","privacyRequired");return;}
        if(initializing){call.reject("正在初始化 TapTap，请稍后再试","busy");return;}
        begin(call,30000);
        if(initialized){loginNow(call);return;}
        initializing=true;
        initCallback=new TapInitCallback(){
            @Override public void onInitSuccess(){main.post(()->{
                initialized=true;initializing=false;TapTapSdk.removeInitCallback(this);initCallback=null;
                if(destroyed)return;TapTapOnlineBattle.registerOnlineBattleCallback(TapBattlePlugin.this);if(pending.containsKey(call))loginNow(call);
            });}
            @Override public void onInitFail(int code,String message){main.post(()->{initializing=false;TapTapSdk.removeInitCallback(this);initCallback=null;fail(call,"TapTap 初始化失败："+message,"tapInit"+code);});}
        };
        TapTapSdk.addInitCallback(initCallback);
        try{TapTapSdkOptions options=new TapTapSdkOptions(BuildConfig.TAP_CLIENT_ID,BuildConfig.TAP_CLIENT_TOKEN,TapTapRegion.CN);options.setScreenOrientation(1);options.setEnableLog(false);TapTapSdk.init(getContext(),options);}
        catch(Exception e){initializing=false;TapTapSdk.removeInitCallback(initCallback);initCallback=null;fail(call,"TapTap 初始化失败，请检查应用配置","tapInit");}
    });}
    private void loginNow(PluginCall call){
        TapTapAccount cached=TapTapLogin.getCurrentTapAccount();if(cached!=null){accountSuccess(call,cached);return;}
        TapTapLogin.loginWithScopes(getActivity(),new String[]{Scopes.SCOPE_PUBLIC_PROFILE},new TapTapCallback<TapTapAccount>(){
            @Override public void onSuccess(TapTapAccount account){main.post(()->accountSuccess(call,account));}
            @Override public void onFail(TapTapException error){main.post(()->fail(call,"TapTap 登录失败，请稍后重试","tapLogin"));}
            @Override public void onCancel(){main.post(()->fail(call,"已取消登录","cancelled"));}
        });
    }
    private void accountSuccess(PluginCall call,TapTapAccount account){success(call,LanRoomService.obj("openId",account.getOpenId(),"name",account.getName(),"avatar",account.getAvatar()));}
    @PluginMethod public void connect(PluginCall call){execute(call,false,false,()->{
        if(connected){success(call,LanRoomService.obj("playerId",playerId));return;}
        TapTapOnlineBattle.connect(new ConnectListener(){public void onSuccess(String id){main.post(()->{connected=true;playerId=id;success(call,LanRoomService.obj("playerId",id));});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void create(PluginCall call){execute(call,true,false,()->{
        if(currentRoom!=null)throw new IllegalArgumentException("请先离开当前房间");
        String name=call.getString("name","秘境决斗");if(name.length()>32)name=name.substring(0,32);
        String properties=propertyText(call.getData().opt("properties"));
        CreateRoomConfig config=new CreateRoomConfig(new RoomConfig(2,"arcane-duel-"+LanRoomService.BUILD,Collections.emptyMap(),name,properties),playerConfig(call));
        TapTapOnlineBattle.createRoom(config,new CreateRoomListener(){public void onSuccess(RoomInfo room){main.post(()->{currentRoom=roomJson(room);success(call,LanRoomService.obj("room",currentRoom));});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void join(PluginCall call){execute(call,true,false,()->{
        if(currentRoom!=null)throw new IllegalArgumentException("请先离开当前房间");
        String roomId=call.getString("roomId","").trim();if(roomId.isEmpty()||roomId.length()>128)throw new IllegalArgumentException("请输入正确的 TapTap 房间号");
        TapTapOnlineBattle.joinRoom(roomId,playerConfig(call),new JoinRoomListener(){public void onSuccess(RoomInfo room){main.post(()->{currentRoom=roomJson(room);success(call,LanRoomService.obj("room",currentRoom));});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void properties(PluginCall call){execute(call,true,true,()->{
        budgetControl();String scope=call.getString("scope","player"),properties=propertyText(call.getData().opt("properties"));
        if(scope.equals("status"))TapTapOnlineBattle.updatePlayerCustomStatus(call.getInt("status",0),new UpdatePlayerCustomStatusListener(){public void onSuccess(){main.post(()->success(call,new JSONObject()));}public void onFailure(ErrorResponse error){failure(call,error);}});
        else if(scope.equals("player"))TapTapOnlineBattle.updatePlayerCustomProperties(properties,new UpdatePlayerCustomPropertiesListener(){public void onSuccess(){main.post(()->success(call,new JSONObject()));}public void onFailure(ErrorResponse error){failure(call,error);}});
        else if(scope.equals("room")){if(!isOwner())throw new IllegalArgumentException("只有房主可以更新房间信息");TapTapOnlineBattle.updateRoomProperties(call.getString("name",currentRoom.optString("name")),properties,new UpdateRoomPropertiesListener(){public void onSuccess(){main.post(()->success(call,new JSONObject()));}public void onFailure(ErrorResponse error){failure(call,error);}});}
        else throw new IllegalArgumentException("未知的房间信息类型");
    });}
    @PluginMethod public void sendCustom(PluginCall call){execute(call,true,true,()->{
        String data=call.getString("data","");if(data.getBytes(StandardCharsets.UTF_8).length>2048)throw new IllegalArgumentException("控制消息不能超过 2048 字节");budgetControl();
        // Broadcast control only. Combat state must use sendFrame(), never this low-frequency channel.
        TapTapOnlineBattle.sendCustomMessage(data,0,Collections.emptyList(),new SendCustomMessageListener(){public void onSuccess(){main.post(()->success(call,new JSONObject()));}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void startFrame(PluginCall call){execute(call,true,true,()->{
        if(!isOwner())throw new IllegalArgumentException("只有房主可以开始对局");if(frameActive)throw new IllegalArgumentException("对局帧同步已开始");
        TapTapOnlineBattle.startFrameSync(new StartFrameSyncListener(){public void onSuccess(){main.post(()->success(call,new JSONObject()));}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void sendFrame(PluginCall call){execute(call,true,true,()->{
        if(!frameActive)throw new IllegalArgumentException("对局尚未开始");String data=call.getString("data","");if(data.getBytes(StandardCharsets.UTF_8).length>1024)throw new IllegalArgumentException("每条帧数据不能超过 1024 字节");
        Long expectedFrame=call.getLong("frameId");Integer expectedSync=call.getInt("frameSyncId");
        if(expectedFrame==null||expectedSync==null||expectedSync!=frameSyncId||latestFrameId<0||expectedFrame!=latestFrameId){fail(call,"此服务帧已过期，请使用最新帧","staleFrame");return;}
        if(frameCount>=5||framePending>=5){fail(call,"帧数据发送过快","backpressure");return;}frameCount++;framePending++;final int creditGeneration=frameCreditGeneration;
        TapTapOnlineBattle.sendFrameInput(data,new SendFrameInputListener(){public void onSuccess(){main.post(()->{if(creditGeneration==frameCreditGeneration)framePending=Math.max(0,framePending-1);success(call,new JSONObject());});}public void onFailure(ErrorResponse error){main.post(()->{if(creditGeneration==frameCreditGeneration)framePending=Math.max(0,framePending-1);failure(call,error);});}});
    });}
    @PluginMethod public void stopFrame(PluginCall call){execute(call,true,true,()->{
        if(!isOwner())throw new IllegalArgumentException("只有房主可以结束对局帧同步");
        TapTapOnlineBattle.stopFrameSync(new StopFrameSyncListener(){public void onSuccess(){main.post(()->{frameActive=false;resetFrameCredit();success(call,new JSONObject());});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void leave(PluginCall call){execute(call,true,false,()->{
        if(currentRoom==null){success(call,new JSONObject());return;}
        TapTapOnlineBattle.leaveRoom(new LeaveRoomListener(){public void onSuccess(){main.post(()->{currentRoom=null;frameActive=false;resetFrameCredit();success(call,new JSONObject());});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}
    @PluginMethod public void disconnect(PluginCall call){execute(call,false,false,()->{
        if(!connected){success(call,new JSONObject());return;}
        TapTapOnlineBattle.disconnect(new DisconnectListener(){public void onSuccess(){main.post(()->{clearConnection();success(call,new JSONObject());});}public void onFailure(ErrorResponse error){failure(call,error);}});
    });}

    private boolean configured(){return BuildConfig.TAP_CLIENT_ID!=null&&!BuildConfig.TAP_CLIENT_ID.trim().isEmpty()&&BuildConfig.TAP_CLIENT_TOKEN!=null&&!BuildConfig.TAP_CLIENT_TOKEN.trim().isEmpty();}
    private boolean consented(){return getContext().getSharedPreferences("arcane-privacy",0).getBoolean("tap",false);}
    private boolean isOwner(){return currentRoom!=null&&playerId.equals(currentRoom.optString("ownerId"));}
    private interface Action{void run()throws Exception;}
    private void execute(PluginCall call,boolean connection,boolean room,Action action){main.post(()->{
        if(!configured()){call.reject("尚未配置 TapTap 游戏应用，局域网与单机可正常使用","notConfigured");return;}
        if(!consented()){call.reject("请先同意隐私与 TapTap SDK 说明","privacyRequired");return;}
        if(!initialized||TapTapLogin.getCurrentTapAccount()==null){call.reject("请先登录 TapTap","loginRequired");return;}
        if(connection&&!connected){call.reject("请先连接 TapTap 联机服务","connectRequired");return;}
        if(room&&currentRoom==null){call.reject("请先创建或加入房间","roomRequired");return;}
        if(pending.size()>=24){call.reject("联机服务繁忙，请稍后重试","backpressure");return;}
        begin(call,10000);try{action.run();}catch(Exception error){fail(call,error.getMessage(),"invalidRequest");}
    });}
    private void begin(PluginCall call,long timeout){Runnable timer=()->{if(pending.remove(call)!=null)call.reject("联机操作超时，请检查网络","timeout");};pending.put(call,timer);main.postDelayed(timer,timeout);}
    private void success(PluginCall call,JSONObject result){Runnable timer=pending.remove(call);if(timer!=null){main.removeCallbacks(timer);call.resolve(js(result));}}
    private void fail(PluginCall call,String message,String code){Runnable timer=pending.remove(call);if(timer!=null){main.removeCallbacks(timer);call.reject(message==null?"TapTap 操作失败":message,code);}}
    private void failure(PluginCall call,ErrorResponse error){main.post(()->fail(call,error.getMsg(),"tap"+error.getCode()));}
    private void budgetControl(){long now=SystemClock.elapsedRealtime();while(!controlTimes.isEmpty()&&now-controlTimes.peekFirst()>=1000)controlTimes.removeFirst();if(controlTimes.size()>=12)throw new IllegalArgumentException("房间操作过于频繁，请稍后再试");controlTimes.addLast(now);}
    private static String propertyText(Object value){String text=value==null||value==JSONObject.NULL?"{}":value instanceof String?(String)value:value.toString();if(text.getBytes(StandardCharsets.UTF_8).length>1536)throw new IllegalArgumentException("房间信息过大");return text;}
    private static PlayerConfig playerConfig(PluginCall call){JSONObject p=call.getData().optJSONObject("player");return new PlayerConfig(p==null?0:p.optInt("status"),propertyText(p==null?null:p.opt("properties")));}
    private static JSObject js(JSONObject data){try{return new JSObject(data.toString());}catch(Exception error){return new JSObject();}}
    private void event(String type,Object...pairs){main.post(()->{if(destroyed)return;JSONObject data=LanRoomService.obj(pairs);try{data.put("type",type);}catch(Exception ignored){}notifyListeners("battle",js(data));});}
    private void resetFrameCredit(){latestFrameId=-1;frameCount=0;framePending=0;frameCreditGeneration++;}
    private void clearConnection(){connected=false;playerId="";currentRoom=null;frameActive=false;resetFrameCredit();frameSyncId=0;controlTimes.clear();}
    private static JSONObject playerJson(PlayerInfo p){return LanRoomService.obj("id",p.getId(),"status",p.getStatus(),"customStatus",p.getCustomStatus(),"properties",p.getCustomProperties());}
    private static JSONObject roomJson(RoomInfo r){JSONArray players=new JSONArray();for(PlayerInfo p:r.getPlayers())players.put(playerJson(p));return LanRoomService.obj("id",r.getId(),"name",r.getName(),"type",r.getType(),"ownerId",r.getOwnerId(),"status",r.getStatus(),"properties",r.getCustomProperties(),"maxPlayerCount",r.getMaxPlayerCount(),"players",players,"createTime",r.getCreateTime());}
    @Override public void onDisconnected(int code,String message){main.post(()->{clearConnection();event("disconnected","code",code,"message",message);});}
    @Override public void onBattleServiceError(){main.post(()->{clearConnection();event("serviceError");});}
    @Override public void onRoomPropertiesChanged(String roomId,String name,String properties){main.post(()->{if(currentRoom!=null&&roomId.equals(currentRoom.optString("id"))){try{currentRoom.put("name",name).put("properties",properties);}catch(Exception ignored){}}event("roomProperties","roomId",roomId,"name",name,"properties",properties);});}
    @Override public void onPlayerCustomPropertiesChanged(String id,String properties){main.post(()->{updatePlayer(id,"properties",properties);event("playerProperties","playerId",id,"properties",properties);});}
    @Override public void onPlayerCustomStatusChanged(String id,int status){main.post(()->{updatePlayer(id,"customStatus",status);event("playerStatus","playerId",id,"status",status);});}
    @Override public void onFrameSyncStarted(FrameSyncInfo info){main.post(()->{if(frameActive&&frameSyncId==info.getFrameSyncId())return;currentRoom=roomJson(info.getRoomInfo());frameSyncId=info.getFrameSyncId();frameActive=true;resetFrameCredit();event("frameStart","room",currentRoom,"frameSyncId",frameSyncId,"seed",info.getSeed(),"serverTime",info.getServerTime());});}
    @Override public void onFrameReceived(FrameData frame){final int callbackSync=frameSyncId,callbackGeneration=frameCreditGeneration;main.post(()->{if(!frameActive||currentRoom==null||callbackSync!=frameSyncId||callbackGeneration!=frameCreditGeneration||frame.getId()<=latestFrameId)return;latestFrameId=frame.getId();frameCount=0;JSONArray inputs=new JSONArray();for(PlayerInputInfo input:frame.getInputs())inputs.put(LanRoomService.obj("playerId",input.getPlayerId(),"data",input.getData(),"serverTime",input.getServerTime()));event("frame","id",latestFrameId,"frameSyncId",frameSyncId,"roomId",currentRoom.optString("id"),"inputs",inputs);});}
    @Override public void onFrameSyncStopped(String roomId,int syncId,int reason){main.post(()->{if(syncId!=frameSyncId)return;frameActive=false;resetFrameCredit();event("frameStop","roomId",roomId,"frameSyncId",syncId,"reason",reason);});}
    @Override public void onPlayerOffline(String roomId,String ownerId,String id){main.post(()->{removePlayer(id,ownerId);event("offline","roomId",roomId,"ownerId",ownerId,"playerId",id);});}
    @Override public void onPlayerLeft(String roomId,String ownerId,String id){main.post(()->{removePlayer(id,ownerId);event("left","roomId",roomId,"ownerId",ownerId,"playerId",id);});}
    @Override public void onPlayerEntered(String roomId,PlayerInfo player){main.post(()->{if(currentRoom!=null){JSONArray list=currentRoom.optJSONArray("players");if(list!=null){boolean exists=false;for(int i=0;i<list.length();i++)if(player.getId().equals(list.optJSONObject(i).optString("id")))exists=true;if(!exists)list.put(playerJson(player));}}event("entered","roomId",roomId,"player",playerJson(player));});}
    @Override public void onCustomMessageReceived(String id,String data){event("custom","playerId",id,"data",data);}
    @Override public void onPlayerKicked(String roomId,String id){main.post(()->{if(id.equals(playerId)){currentRoom=null;frameActive=false;resetFrameCredit();}else removePlayer(id,null);event("kicked","roomId",roomId,"playerId",id);});}
    private void updatePlayer(String id,String key,Object value){if(currentRoom==null)return;JSONArray players=currentRoom.optJSONArray("players");if(players==null)return;for(int i=0;i<players.length();i++){JSONObject player=players.optJSONObject(i);if(player!=null&&id.equals(player.optString("id"))){try{player.put(key,value);}catch(Exception ignored){}}}}
    private void removePlayer(String id,String ownerId){if(currentRoom==null)return;JSONArray old=currentRoom.optJSONArray("players"),next=new JSONArray();if(old!=null)for(int i=0;i<old.length();i++)if(!id.equals(old.optJSONObject(i).optString("id")))next.put(old.optJSONObject(i));try{currentRoom.put("players",next);if(ownerId!=null)currentRoom.put("ownerId",ownerId);}catch(Exception ignored){}/* JS treats owner changes during battle as disconnect, never simulation migration. */}
    @Override protected void handleOnDestroy(){destroyed=true;main.post(()->{
        for(Map.Entry<PluginCall,Runnable> entry:new ArrayList<>(pending.entrySet())){main.removeCallbacks(entry.getValue());entry.getKey().reject("应用已关闭","cancelled");}pending.clear();
        if(initCallback!=null){TapTapSdk.removeInitCallback(initCallback);initCallback=null;}
        if(initialized){TapTapOnlineBattle.unRegisterOnlineBattleCallback(this);if(connected)TapTapOnlineBattle.disconnect(null);}clearConnection();
    });super.handleOnDestroy();}
}
