package com.xiaohaotian.arcaneduel;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.taptap.sdk.core.TapTapRegion;
import com.taptap.sdk.core.TapTapSdk;
import com.taptap.sdk.core.TapTapSdkOptions;
import com.taptap.sdk.compliance.option.TapTapComplianceOptions;
import com.taptap.sdk.initializer.api.TapInitCallback;
import java.util.ArrayList;
import java.util.List;

/** One process-wide TapSDK initialization path. Call only after explicit privacy consent.
 * Official APIs: https://developer.taptap.cn/docs/sdk/anti-addiction/development-guide/android-native/
 * No SDK work occurs in status, plugin registration, or static construction.
 */
public final class TapSafetyCore {
    public interface Callback {void onReady();void onFailure(int code);}
    private static final Handler MAIN=new Handler(Looper.getMainLooper());
    private static final List<Callback> WAITING=new ArrayList<>();
    private static volatile boolean ready,starting;
    private static TapInitCallback initCallback;
    private static Runnable timeout;
    private static long generation;
    private TapSafetyCore(){}
    public static boolean isInitialized(){return ready;}
    public static boolean isInitializing(){return starting;}
    public static boolean isConfigured(){return !BuildConfig.TAP_CLIENT_ID.trim().isEmpty()&&!BuildConfig.TAP_CLIENT_TOKEN.trim().isEmpty();}
    public static void ensureInitialized(Context context,Callback callback){MAIN.post(()->{
        if(ready){callback.onReady();return;}
        if(!isConfigured()){callback.onFailure(-1);return;}
        if(WAITING.size()>=8){callback.onFailure(-2);return;}
        WAITING.add(callback);if(starting)return;starting=true;final long token=++generation;
        initCallback=new TapInitCallback(){
            @Override public void onInitSuccess(){MAIN.post(()->finish(token,true,0));}
            @Override public void onInitFail(int code,String ignored){MAIN.post(()->finish(token,false,code));}
        };
        TapTapSdk.addInitCallback(initCallback);
        timeout=()->finish(token,false,-3);MAIN.postDelayed(timeout,30000);
        try{
            TapTapSdkOptions options=new TapTapSdkOptions(BuildConfig.TAP_CLIENT_ID,BuildConfig.TAP_CLIENT_TOKEN,TapTapRegion.CN);
            options.setScreenOrientation(1);options.setEnableLog(false);
            // No age information is requested or fabricated; the SDK still enforces its actual policy.
            TapTapSdk.init(context.getApplicationContext(),options,new TapTapComplianceOptions(false,false));
        }catch(Exception|LinkageError ignored){finish(token,false,-4);}
    });}
    private static void finish(long token,boolean success,int code){
        if(!starting||token!=generation)return;
        if(timeout!=null)MAIN.removeCallbacks(timeout);timeout=null;
        if(initCallback!=null)TapTapSdk.removeInitCallback(initCallback);initCallback=null;
        starting=false;ready=success;List<Callback> callbacks=new ArrayList<>(WAITING);WAITING.clear();
        for(Callback callback:callbacks){try{if(success)callback.onReady();else callback.onFailure(code);}catch(Exception ignored){}}
    }
}
