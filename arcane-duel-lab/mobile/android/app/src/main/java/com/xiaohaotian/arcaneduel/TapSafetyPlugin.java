package com.xiaohaotian.arcaneduel;

import android.app.Activity;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.taptap.sdk.compliance.TapTapCompliance;
import com.taptap.sdk.compliance.TapTapComplianceCallback;
import com.taptap.sdk.login.TapTapAccount;
import com.taptap.sdk.login.TapTapLogin;
import com.taptap.sdk.update.TapTapUpdate;
import com.taptap.sdk.update.TapTapUpdateCallback;
import java.util.Map;
import java.util.UUID;

/** Typed SDK bridge. It never certifies an identity itself, returns identity data, or installs an APK.
 * https://developer.taptap.cn/docs/sdk/update/development-guide/android-native/
 * https://developer.taptap.cn/docs/sdk/anti-addiction/development-guide/android-native/
 */
@CapacitorPlugin(name="TapSafety")
public final class TapSafetyPlugin extends Plugin {
    private final Handler main=new Handler(Looper.getMainLooper());
    private boolean destroyed,callbackRegistered,sessionActive,allowed;
    private String identityMode="local",sessionIdentity="",reason="unchecked";
    private Integer complianceCode;
    private long revision;
    private PluginCall startupCall;
    private Runnable startupTimeout;
    private final TapTapComplianceCallback complianceCallback=new TapTapComplianceCallback(){
        @Override public void onComplianceResult(int code,Map<String,?> ignored){main.post(()->receiveCompliance(code));}
    };
    private SharedPreferences privacy(){return getContext().getSharedPreferences("arcane-privacy",0);}
    private SharedPreferences identityStore(){return getContext().getSharedPreferences("arcane-safety-identity",0);}
    private boolean usableActivity(){Activity a=getActivity();return a!=null&&!a.isFinishing()&&!a.isDestroyed()&&a.hasWindowFocus();}
    private boolean tapInstalled(){try{getContext().getPackageManager().getPackageInfo("com.taptap",0);return true;}catch(PackageManager.NameNotFoundException ignored){return false;}}
    private String currentIdentity(String mode){
        if("tap".equals(mode)){if(!TapSafetyCore.isInitialized())return "";TapTapAccount account=TapTapLogin.getCurrentTapAccount();return account==null?"":account.getOpenId();}
        return identityStore().getString("local-player","");
    }
    private void checkIdentity(){if(sessionActive&&!sessionIdentity.equals(currentIdentity(identityMode))){sessionActive=false;allowed=false;complianceCode=null;reason="accountChanged";++revision;}}
    private JSObject state(){
        checkIdentity();JSObject out=new JSObject();out.put("available",TapSafetyCore.isConfigured()&&!destroyed);out.put("configured",TapSafetyCore.isConfigured());out.put("required",BuildConfig.COMPLIANCE_REQUIRED);out.put("initialized",TapSafetyCore.isInitialized());out.put("initializing",TapSafetyCore.isInitializing());out.put("privacyAccepted",privacy().getBoolean("safety",false));out.put("tapClientInstalled",tapInstalled());out.put("identityMode",identityMode);out.put("complianceAllowed",allowed&&sessionActive&&TapSafetyCore.isInitialized());out.put("compliancePending",startupCall!=null);out.put("complianceRevision",revision);if(complianceCode!=null)out.put("complianceCode",complianceCode);out.put("reason",reason);return out;
    }
    private JSObject unavailable(String why){JSObject out=state();out.put("available",false);out.put("complianceAllowed",false);out.put("reason",why);return out;}
    @PluginMethod public void status(PluginCall call){main.post(()->call.resolve(state()));}
    private boolean acceptAction(PluginCall call){
        if(!Boolean.TRUE.equals(call.getBoolean("privacyAccepted",false))){call.reject("请先阅读并同意隐私与SDK说明","privacyRequired");return false;}
        if(destroyed){call.reject("当前页面已关闭","closed");return false;}
        if(!usableActivity()){call.reject("请回到游戏页面后再试","background");return false;}
        if(!TapSafetyCore.isConfigured()){call.reject("TapTap游戏服务尚未配置","notConfigured");return false;}
        if(!privacy().edit().putBoolean("safety",true).commit()){call.reject("无法保存本次同意，请重试","privacyRequired");return false;}
        return true;
    }
    private void withCore(PluginCall call,Runnable action){TapSafetyCore.ensureInitialized(getContext(),new TapSafetyCore.Callback(){
        @Override public void onReady(){if(destroyed){call.reject("当前页面已关闭","closed");return;}if(!usableActivity()){call.reject("请回到游戏页面后再试","background");return;}try{if(!callbackRegistered){TapTapCompliance.registerComplianceCallback(complianceCallback);callbackRegistered=true;}action.run();}catch(Exception|LinkageError ignored){call.reject("TapTap服务暂不可用，请稍后重试","sdkFailed");}}
        @Override public void onFailure(int ignored){if(!destroyed)call.reject("TapTap初始化暂未完成，请稍后重试","sdkFailed");}
    });}
    @PluginMethod public void initialize(PluginCall call){main.post(()->{if(acceptAction(call))withCore(call,()->call.resolve(state()));});}
    @PluginMethod public void checkForceUpdate(PluginCall call){main.post(()->{
        if(!acceptAction(call))return;if(!tapInstalled()){call.resolve(unavailable("tapClientMissing"));return;}
        withCore(call,()->{if(!tapInstalled()){call.resolve(unavailable("tapClientMissing"));return;}TapTapUpdate.checkForceUpdate();JSObject out=state();out.put("requested",true);call.resolve(out);});
    });}
    @PluginMethod public void openUpdate(PluginCall call){main.post(()->{
        if(!acceptAction(call))return;if(!tapInstalled()){call.resolve(unavailable("tapClientMissing"));return;}
        withCore(call,()->{if(!tapInstalled()){call.resolve(unavailable("tapClientMissing"));return;}TapTapUpdate.updateGame(getActivity(),new TapTapUpdateCallback(){@Override public void onCancel(){main.post(()->{JSObject event=unavailable("cancelled");event.put("requested",false);notifyListeners("update",event);});}});JSObject out=state();out.put("requested",true);call.resolve(out);});
    });}
    @PluginMethod public void startCompliance(PluginCall call){main.post(()->{
        if(!acceptAction(call))return;String mode=call.getString("identityMode","local");if(!"local".equals(mode)&&!"tap".equals(mode)){call.reject("认证方式不可用","invalidIdentityMode");return;}
        if(startupCall!=null){call.reject("正在进行实名认证，请稍候","busy");return;}
        withCore(call,()->{
            checkIdentity();if(sessionActive){if(!identityMode.equals(mode)){call.reject("请先退出当前认证再切换方式","busy");return;}call.resolve(state());return;}
            String id=currentIdentity(mode);
            if("tap".equals(mode)&&id.isEmpty()){call.resolve(unavailable("loginRequired"));return;}
            if("local".equals(mode)&&id.isEmpty()){id="local:"+UUID.randomUUID();if(!identityStore().edit().putString("local-player",id).commit()){call.reject("无法保存本机认证标识，请重试","sdkFailed");return;}}
            if(!id.matches("[A-Za-z0-9_+/.=,:-]{1,160}")){call.reject("认证标识不可用，请重新登录","sdkFailed");return;}
            identityMode=mode;sessionIdentity=id;sessionActive=true;allowed=false;complianceCode=null;reason="checking";++revision;startupCall=call;
            startupTimeout=()->{if(startupCall!=call)return;sessionActive=false;allowed=false;complianceCode=null;reason="timeout";++revision;finishStartup(unavailable("timeout"));notifyListeners("compliance",state());try{TapTapCompliance.exit();}catch(Exception ignored){}};
            main.postDelayed(startupTimeout,90000);notifyListeners("compliance",state());
            try{TapTapCompliance.startup(getActivity(),id);}catch(Exception|LinkageError ignored){sessionActive=false;allowed=false;reason="sdkFailed";++revision;finishStartup(unavailable("sdkFailed"));notifyListeners("compliance",state());}
        });
    });}
    private void receiveCompliance(int code){
        if(destroyed||!sessionActive)return;checkIdentity();if(!sessionActive){finishStartup(unavailable("accountChanged"));notifyListeners("compliance",state());return;}
        complianceCode=code;allowed=code==500;reason=code==500?"allowed":code==1000?"exited":code==1001?"switchAccount":code==1030?"periodRestricted":code==1050?"durationLimit":code==1100?"ageRestricted":code==1200?"serviceUnavailable":code==9002?"cancelled":"unknown";
        if(code!=500&&code!=1030&&code!=1050&&code!=1100)sessionActive=false;
        ++revision;finishStartup(state());notifyListeners("compliance",state());
    }
    private void finishStartup(JSObject result){PluginCall call=startupCall;startupCall=null;if(startupTimeout!=null)main.removeCallbacks(startupTimeout);startupTimeout=null;if(call!=null){result.put("compliancePending",false);call.resolve(result);}}
    @PluginMethod public void exitCompliance(PluginCall call){main.post(()->{
        sessionActive=false;allowed=false;complianceCode=null;reason="exited";++revision;finishStartup(unavailable("cancelled"));
        if(TapSafetyCore.isInitialized())try{TapTapCompliance.exit();}catch(Exception ignored){}
        notifyListeners("compliance",state());call.resolve(state());
    });}
    @Override protected void handleOnDestroy(){main.post(()->{
        destroyed=true;sessionActive=false;allowed=false;reason="closed";++revision;finishStartup(unavailable("closed"));
        if(callbackRegistered){try{TapTapCompliance.exit();}catch(Exception ignored){}try{TapTapCompliance.unregisterComplianceCallback(complianceCallback);}catch(Exception ignored){}callbackRegistered=false;}
    });}
}
