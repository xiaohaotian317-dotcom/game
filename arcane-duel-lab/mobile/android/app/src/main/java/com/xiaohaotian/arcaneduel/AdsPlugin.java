package com.xiaohaotian.arcaneduel;

import android.app.Activity;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.tapsdk.tapad.AdRequest;
import com.tapsdk.tapad.TapAdConfig;
import com.tapsdk.tapad.TapAdCustomController;
import com.tapsdk.tapad.TapAdManager;
import com.tapsdk.tapad.TapAdNative;
import com.tapsdk.tapad.TapAdSdk;
import com.tapsdk.tapad.TapInterstitialAd;
import com.tapsdk.tapad.TapRewardVideoAd;
import com.tapsdk.tapad.constants.Constants;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import java.util.HashSet;

/** Real, non-aggregated TapADN 5.3.2.0; test media remains the default; production requires explicit approval. */
@CapacitorPlugin(name="ArcaneAds")
public final class AdsPlugin extends Plugin {
    private static final Set<String> REWARDED=new HashSet<>(Arrays.asList("reward-coins","reward-ticket","reward-item","reward-revive"));
    private final Handler main=new Handler(Looper.getMainLooper());
    private boolean initialized,destroyed;
    private TapAdNative adNative;
    private Attempt active;
    private AdReceiptGate.FailureDiagnostic lastFailure;

    private static final class Attempt {
        final PluginCall call;
        final AdReceiptGate gate;
        Runnable timeout;
        boolean showRequested;
        TapRewardVideoAd reward;
        TapInterstitialAd interstitial;
        AdReceiptGate.FailureDiagnostic failure;
        Attempt(PluginCall call,String placement,boolean rewarded){this.call=call;gate=new AdReceiptGate(placement,rewarded,BuildConfig.ADN_TEST_MODE);}
    }
    private long positiveId(String value){try{long id=Long.parseLong(value);return id>0?id:0;}catch(Exception ignored){return 0;}}
    private boolean supportedAbi(){String primary=Build.SUPPORTED_ABIS.length>0?Build.SUPPORTED_ABIS[0]:"";return primary.equals("arm64-v8a")||primary.equals("armeabi-v7a");}
    private boolean configured(){return (BuildConfig.ADN_TEST_MODE||BuildConfig.ADN_PRODUCTION_APPROVED)&&positiveId(BuildConfig.ADN_MEDIA_ID)>0&&!BuildConfig.ADN_MEDIA_KEY.trim().isEmpty();}
    private boolean consented(){return getContext().getSharedPreferences("arcane-privacy",0).getBoolean("ads-dirichlet",false);}
    private JSObject statusJson(){
        JSObject value=new JSObject();value.put("provider","dirichlet");value.put("sdkVersion","5.3.2.0");value.put("testMode",BuildConfig.ADN_TEST_MODE);value.put("environment",BuildConfig.ADN_TEST_MODE?"test":"production");value.put("monetization",!BuildConfig.ADN_TEST_MODE&&BuildConfig.ADN_PRODUCTION_APPROVED);value.put("configured",configured());value.put("supportedAbi",supportedAbi());if(!supportedAbi())value.put("reason","unsupportedAbi");value.put("privacyAccepted",consented());value.put("initialized",initialized);value.put("rewarded",configured()&&supportedAbi()&&positiveId(BuildConfig.ADN_REWARDED_PLACEMENT)>0);value.put("interstitial",configured()&&supportedAbi()&&positiveId(BuildConfig.ADN_INTERSTITIAL_PLACEMENT)>0);value.put("busy",active!=null);if(lastFailure!=null)value.put("lastFailure",diagnosticJson(lastFailure));return value;
    }
    @PluginMethod public void status(PluginCall call){main.post(()->call.resolve(statusJson()));}
    @PluginMethod public void consent(PluginCall call){main.post(()->{
        if(!Boolean.TRUE.equals(call.getBoolean("privacyAccepted",false))){call.reject("请先阅读并确认广告SDK隐私说明","privacyRequired");return;}
        if(!supportedAbi()){call.reject("此设备架构暂不支持广告服务，单机游玩不受影响","unsupportedAbi");return;}
        if(!configured()){call.reject("广告服务尚未配置完成，单机游玩不受影响","notConfigured");return;}
        if(destroyed){call.reject("广告页面已关闭","closed");return;}
        if(!initialized&&!usableActivity()){remember(null,"lifecycle",null,"Initialization requires a foreground focused Activity");call.reject("请回到游戏页面后再主动观看广告","background",errorJson(lastFailure));return;}
        try{
            if(!initialized){
                // No optional identifiers, installed-app list, sensors or runtime permissions.
                TapAdCustomController privacy=new TapAdCustomController(){
                    @Override public boolean isCanUseLocation(){return false;}
                    @Override public boolean isCanUsePhoneState(){return false;}
                    @Override public boolean isCanUseWifiState(){return false;}
                    @Override public boolean isCanUseWriteExternal(){return false;}
                    @Override public boolean alist(){return false;}
                    @Override public boolean isCanUseAndroidId(){return false;}
                    @Override public boolean isCanUsePhoneMacAddress(){return false;}
                    @Override public boolean isCanUseBssid(){return false;}
                    @Override public boolean isCanUseSsid(){return false;}
                    @Override public boolean isCanUseSensor(){return false;}
                    @Override public boolean isCanUseOaid(){return false;}
                };
                TapAdConfig config=new TapAdConfig.Builder().withMediaId(positiveId(BuildConfig.ADN_MEDIA_ID)).withMediaName(BuildConfig.ADN_MEDIA_NAME).withMediaKey(BuildConfig.ADN_MEDIA_KEY).withMediaVersion(BuildConfig.VERSION_NAME).withCustomController(privacy).shakeEnabled(false).enableDebug(false).build();
                TapAdSdk.init(getContext().getApplicationContext(),config);
                if(!TapAdSdk.isInitialized())throw new IllegalStateException("Ad initialization incomplete");
                TapAdSdk.putMediaGlobalSettings(Constants.Personalization.PERSONAL_ADS_TYPE,Constants.Personalization.PERSONAL_ADS_TYPE_LIMIT);
                initialized=true;
            }
            getContext().getSharedPreferences("arcane-privacy",0).edit().putBoolean("ads-dirichlet",true).apply();call.resolve(statusJson());
        }catch(Exception|LinkageError error){remember(null,"init",null,errorText(error));call.reject("广告SDK初始化失败，请稍后重试","adInitFailed",errorJson(lastFailure));}
    });}
    @PluginMethod public void showRewarded(PluginCall call){main.post(()->{
        String placement=call.getString("placement","");if(!REWARDED.contains(placement)){call.reject("广告位不可用","invalidPlacement");return;}
        Attempt a=begin(call,placement,true,positiveId(BuildConfig.ADN_REWARDED_PLACEMENT));if(a==null)return;
        try{adNative.loadRewardVideoAd(request(BuildConfig.ADN_REWARDED_PLACEMENT,a),new TapAdNative.RewardVideoAdListener(){
            @Override public void onError(int code,String message){main.post(()->fail(a,"loadFailed",code,message));}
            @Override public void onRewardVideoAdLoad(TapRewardVideoAd ad){main.post(()->{if(current(a)&&ad!=null){a.reward=ad;a.gate.loaded(requestId(ad.getMediaExtraInfo()));}});}
            @Override public void onRewardVideoCached(TapRewardVideoAd ad){main.post(()->showReward(a,ad));}
        });}catch(Exception|LinkageError error){fail(a,"loadFailed",null,errorText(error));}
    });}
    private void showReward(Attempt a,TapRewardVideoAd ad){
        if(!current(a)||a.showRequested)return;
        if(!usableActivity()||ad==null||!ad.isValid()){fail(a,"notAvailable",0);return;}
        a.reward=ad;a.gate.loaded(requestId(ad.getMediaExtraInfo()));a.showRequested=true;
        ad.setRewardAdInteractionListener(new TapRewardVideoAd.RewardAdInteractionListener(){
            @Override public void onAdShow(TapRewardVideoAd source){main.post(()->{if(current(a)){a.gate.shown();timeout(a,300000,"showTimeout");}});}
            @Override public void onAdClose(TapRewardVideoAd source){main.post(()->finish(a,true,"closedBeforeReward",0));}
            @Override public void onVideoComplete(TapRewardVideoAd source){/* Completion alone is never a reward. */}
            @Override public void onVideoError(TapRewardVideoAd source){main.post(()->fail(a,"videoFailed",0));}
            @Override public void onRewardVerify(TapRewardVideoAd source,boolean valid,int amount,String name,int code,String message){main.post(()->{if(current(a)){a.gate.verify(valid);if(!valid)remember(a,"verify",code,message);}});}
            @Override public void onSkippedVideo(TapRewardVideoAd source){main.post(()->{if(current(a))a.gate.skip();});}
            @Override public void onAdClick(TapRewardVideoAd source){}
            @Override public void onAdValidShow(TapRewardVideoAd source){}
        });
        try{ad.showRewardVideoAd(getActivity());}catch(Exception|LinkageError error){fail(a,"showFailed",null,errorText(error));}
    }
    @PluginMethod public void showInterstitial(PluginCall call){main.post(()->{
        String placement=call.getString("placement","");if(!placement.equals("interstitial-result")){call.reject("广告位不可用","invalidPlacement");return;}
        Attempt a=begin(call,placement,false,positiveId(BuildConfig.ADN_INTERSTITIAL_PLACEMENT));if(a==null)return;
        try{adNative.loadInterstitialAd(request(BuildConfig.ADN_INTERSTITIAL_PLACEMENT,a),new TapAdNative.InterstitialAdListener(){
            @Override public void onError(int code,String message){main.post(()->fail(a,"loadFailed",code,message));}
            @Override public void onInterstitialAdLoad(TapInterstitialAd ad){main.post(()->{
                if(!current(a))return;if(!usableActivity()||ad==null||!ad.isValid()){fail(a,"notAvailable",0);return;}
                a.interstitial=ad;a.gate.loaded(requestId(ad.getMediaExtraInfo()));a.showRequested=true;
                ad.setInteractionListener(new TapInterstitialAd.InterstitialAdInteractionListener(){
                    @Override public void onAdShow(){main.post(()->{if(current(a)){a.gate.shown();timeout(a,300000,"showTimeout");}});}
                    @Override public void onAdClose(){main.post(()->finish(a,true,"closed",0));}
                    @Override public void onAdError(){main.post(()->fail(a,"showFailed",0));}
                    @Override public void onAdValidShow(){}
                    @Override public void onAdClick(){}
                });
                try{ad.show(getActivity());}catch(Exception|LinkageError error){fail(a,"showFailed",null,errorText(error));}
            });}
        });}catch(Exception|LinkageError error){fail(a,"loadFailed",null,errorText(error));}
    });}
    private AdRequest request(String spaceId,Attempt a){return new AdRequest.Builder().withSpaceId(positiveId(spaceId)).withRewardName("秘境补给").withRewardAmount(1).withExtra1(a.gate.attemptId).build();}
    private Attempt begin(PluginCall call,String placement,boolean reward,long spaceId){
        if(!supportedAbi()){call.resolve(unavailable(reward,"unsupportedAbi"));return null;}
        if(!configured()||spaceId==0){call.resolve(unavailable(reward,"notConfigured"));return null;}
        if(!initialized||!consented()){call.reject("请先阅读并确认广告SDK隐私说明","privacyRequired");return null;}
        if(active!=null){call.reject("广告正在处理中","busy");return null;}
        if(destroyed||!usableActivity()){call.resolve(unavailable(reward,"background"));return null;}
        try{if(adNative==null)adNative=TapAdManager.get().createAdNative(getActivity());}
        catch(Exception|LinkageError error){remember(null,"load",null,errorText(error));JSObject out=unavailable(reward,"notAvailable");appendError(out,lastFailure);call.resolve(out);return null;}
        Attempt a=new Attempt(call,placement,reward);active=a;timeout(a,30000,"loadTimeout");return a;
    }
    private boolean usableActivity(){Activity activity=getActivity();return activity!=null&&!activity.isFinishing()&&!activity.isDestroyed()&&activity.hasWindowFocus();}
    private boolean current(Attempt a){return active==a&&!a.gate.isEnded()&&!destroyed;}
    private String requestId(Map<String,Object> info){if(info==null)return "";for(String key:new String[]{"request_id","requestId","ad_request_id"}){Object value=info.get(key);if(value instanceof String)return ((String)value).substring(0,Math.min(512,((String)value).length()));}return "";}
    private JSObject unavailable(boolean reward,String reason){JSObject out=new JSObject();out.put(reward?"available":"shown",false);out.put("completed",false);out.put("testMode",BuildConfig.ADN_TEST_MODE);out.put("environment",BuildConfig.ADN_TEST_MODE?"test":"production");out.put("reason",reason);return out;}
    private void timeout(Attempt a,long ms,String reason){if(a.timeout!=null)main.removeCallbacks(a.timeout);a.timeout=()->fail(a,reason,0);main.postDelayed(a.timeout,ms);}
    private String errorText(Throwable error){return error.getClass().getSimpleName()+": "+(error.getMessage()==null?"":error.getMessage());}
    private String failurePhase(String reason){if(reason.endsWith("Timeout"))return "timeout";if(reason.startsWith("load"))return "load";if(reason.startsWith("show"))return "show";if(reason.startsWith("video"))return "video";if(reason.equals("closedBeforeReward"))return "verify";if(reason.equals("background")||reason.equals("destroyed"))return "lifecycle";return "show";}
    private void remember(Attempt a,String phase,Integer code,String message){
        if(a!=null&&active!=a)return;
        AdReceiptGate.FailureDiagnostic diagnostic=new AdReceiptGate.FailureDiagnostic(phase,code,message,BuildConfig.ADN_MEDIA_KEY,BuildConfig.ADN_MEDIA_ID,BuildConfig.ADN_REWARDED_PLACEMENT,BuildConfig.ADN_INTERSTITIAL_PLACEMENT);
        lastFailure=diagnostic;if(a!=null)a.failure=diagnostic;
    }
    private JSObject diagnosticJson(AdReceiptGate.FailureDiagnostic diagnostic){JSObject out=new JSObject();out.put("phase",diagnostic.phase);if(diagnostic.code!=null)out.put("code",diagnostic.code.intValue());out.put("message",diagnostic.message);return out;}
    private void appendError(JSObject out,AdReceiptGate.FailureDiagnostic diagnostic){if(diagnostic==null)return;out.put("errorPhase",diagnostic.phase);if(diagnostic.code!=null)out.put("errorCode",diagnostic.code.intValue());out.put("errorMessage",diagnostic.message);}
    private JSObject errorJson(AdReceiptGate.FailureDiagnostic diagnostic){JSObject out=new JSObject();appendError(out,diagnostic);return out;}
    private void fail(Attempt a,String reason,int code){fail(a,reason,code==0?null:Integer.valueOf(code),"");}
    private void fail(Attempt a,String reason,Integer code,String message){if(active!=a)return;remember(a,failurePhase(reason),code,message);a.gate.fail();finish(a,false,reason,0);}
    private void finish(Attempt a,boolean normalClose,String reason,int code){
        if(active!=a)return;AdReceiptGate.Result result=a.gate.finish(normalClose,reason);if(result==null)return;if(a.timeout!=null)main.removeCallbacks(a.timeout);
        if(!result.completed&&a.gate.rewarded&&a.failure==null)remember(a,"verify",null,"Reward not verified before normal close");
        active=null;
        JSObject out=new JSObject();out.put("available",result.available);out.put("shown",result.shown);out.put("completed",result.completed);out.put("placement",a.gate.placement);out.put("testMode",BuildConfig.ADN_TEST_MODE);out.put("environment",BuildConfig.ADN_TEST_MODE?"test":"production");if(result.completed)out.put("receipt",result.receipt);if(!result.reason.isEmpty())out.put("reason",result.reason);appendError(out,a.failure);a.call.resolve(out);dispose(a);
    }
    private void dispose(Attempt a){try{if(a.reward!=null)a.reward.dispose();}catch(Exception ignored){}try{if(a.interstitial!=null)a.interstitial.dispose();}catch(Exception ignored){}}
    @Override protected void handleOnPause(){main.post(()->{if(active!=null&&!active.showRequested)fail(active,"background",0);});}
    @Override protected void handleOnDestroy(){main.post(()->{if(active!=null)fail(active,"destroyed",0);destroyed=true;if(adNative!=null){try{adNative.dispose();}catch(Exception ignored){}adNative=null;}});}
}
