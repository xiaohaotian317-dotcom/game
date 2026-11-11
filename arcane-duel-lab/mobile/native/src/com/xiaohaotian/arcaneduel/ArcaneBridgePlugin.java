package com.xiaohaotian.arcaneduel;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.AtomicFile;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.*;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;

@CapacitorPlugin(name="ArcaneBridge")
public final class ArcaneBridgePlugin extends Plugin {
    private static final int DEFAULT_PORT=44174,MAX_SAVE=8*1024*1024;
    private final ThreadPoolExecutor io=new ThreadPoolExecutor(2,4,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(16),r->{Thread t=new Thread(r,"arcane-native");t.setDaemon(true);return t;});
    private final LanHttpClient httpClient=new LanHttpClient();
    private final Object modeLock=new Object();
    private volatile LanHttpServer server;
    private volatile String target;
    private volatile int port=DEFAULT_PORT;
    private volatile long generation;
    private String exportText;
    private boolean pickerOpen;

    @PluginMethod public void state(PluginCall call){resolve(call,stateData());}
    @PluginMethod public void privacyStatus(PluginCall call){
        android.content.SharedPreferences p=getContext().getSharedPreferences("arcane-privacy",0);
        resolve(call,LanRoomService.obj("tap",p.getBoolean("tap",false),"safety",p.getBoolean("safety",false),"ads",p.getBoolean("ads-dirichlet",false),"version",BuildConfig.VERSION_NAME,"versionCode",BuildConfig.VERSION_CODE));
    }
    @PluginMethod public void withdrawServiceConsent(PluginCall call){getActivity().runOnUiThread(()->{
        if(!Boolean.TRUE.equals(call.getBoolean("confirmed",false))){call.reject("请确认撤回授权并退出游戏","confirmationRequired");return;}
        // Stop the process after the result reaches JS: initialized third-party
        // SDKs must not survive a withdrawal in a warm application process.
        if(!getContext().getSharedPreferences("arcane-privacy",0).edit().clear().commit()){call.reject("授权状态未能保存，请重试","saveFailed");return;}
        synchronized(modeLock){resetInternal();}
        resolve(call,LanRoomService.obj("withdrawn",true));
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(()->{getActivity().finishAndRemoveTask();android.os.Process.killProcess(android.os.Process.myPid());},250);
    });}
    @PluginMethod public void shareGame(PluginCall call){getActivity().runOnUiThread(()->{
        String requestId=call.getString("requestId",""),text=call.getString("text","");
        if(!requestId.matches("[A-Za-z0-9_-]{8,96}")||text.isBlank()||text.length()>1400||text.indexOf('\u0000')>=0){call.reject("分享内容不可用","invalidShare");return;}
        Activity activity=getActivity();if(activity==null||activity.isFinishing()||!activity.hasWindowFocus()){call.reject("请回到游戏页面后再分享","background");return;}
        Intent message=new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text).putExtra(Intent.EXTRA_SUBJECT,"秘境决斗");
        try{activity.startActivity(Intent.createChooser(message,"分享秘境决斗"));resolve(call,LanRoomService.obj("opened",true,"requestId",requestId));}
        catch(Exception ignored){call.reject("此设备暂时无法打开分享面板","shareUnavailable");}
    });}
    @PluginMethod public void insets(PluginCall call){getActivity().runOnUiThread(()->{
        int top=0,right=0,bottom=0,left=0;
        android.view.WindowInsets safe=getActivity().getWindow().getDecorView().getRootWindowInsets();
        if(safe!=null){
            if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets bars=safe.getInsets(android.view.WindowInsets.Type.systemBars());top=bars.top;right=bars.right;bottom=bars.bottom;left=bars.left;}
            else{top=safe.getSystemWindowInsetTop();right=safe.getSystemWindowInsetRight();bottom=safe.getSystemWindowInsetBottom();left=safe.getSystemWindowInsetLeft();}
            if(android.os.Build.VERSION.SDK_INT>=28&&safe.getDisplayCutout()!=null){android.view.DisplayCutout cutout=safe.getDisplayCutout();top=Math.max(top,cutout.getSafeInsetTop());right=Math.max(right,cutout.getSafeInsetRight());bottom=Math.max(bottom,cutout.getSafeInsetBottom());left=Math.max(left,cutout.getSafeInsetLeft());}
        }
        float density=getContext().getResources().getDisplayMetrics().density;
        resolve(call,LanRoomService.obj("top",Math.ceil(top/density),"right",Math.ceil(right/density),"bottom",Math.ceil(bottom/density),"left",Math.ceil(left/density)));
    });}
    private JSONObject stateData(){return LanRoomService.obj("platform","android","mode",server!=null?"host":target!=null?"guest":"offline","target",target,"port",port,"addresses",LanAddress.interfaces(port),"testMode",false,"build",LanRoomService.BUILD);}
    @PluginMethod public void host(PluginCall call){run(call,()->{synchronized(modeLock){
        int wanted=call.getInt("port",DEFAULT_PORT);if(wanted<1024||wanted>65535)throw new IllegalArgumentException("请选择 1024～65535 的端口");
        resetInternal();LanHttpServer host=new LanHttpServer(wanted);
        try{host.start(5000,true);}catch(Exception e){host.stop();throw new IOException("无法启动主机，请检查端口是否被占用",e);}
        server=host;port=wanted;target="http://127.0.0.1:"+port;return stateData();
    }});}
    @PluginMethod public void connect(PluginCall call){run(call,()->{
        long transportGeneration=httpClient.generation();String address=LanAddress.normalize(call.getString("address"));long version=generation;
        JSONObject info=http(address,"/lan-info","GET",null,null,transportGeneration).getJSONObject("data");
        if(!LanRoomService.PROTOCOL.equals(info.optString("protocol"))||!LanRoomService.BUILD.equals(info.optString("build")))throw new IllegalArgumentException("双方客户端版本不一致，请安装同一版本");
        synchronized(modeLock){if(generation!=version)throw new IOException("连接已取消");
            if(server!=null&&address.endsWith(":"+port)){String host=new URL(address).getHost();if(host.equals("127.0.0.1"))throw new IllegalArgumentException("不能加入自己开启的主机");org.json.JSONArray all=LanAddress.interfaces(port);for(int i=0;i<all.length();i++)if(all.getJSONObject(i).getString("ip").equals(host))throw new IllegalArgumentException("不能加入自己开启的主机");}
            resetInternal();target=address;port=new URL(address).getPort();return stateData();}
    });}
    @PluginMethod public void reset(PluginCall call){synchronized(modeLock){resetInternal();}resolve(call,stateData());}
    private void resetInternal(){generation++;target=null;httpClient.cancelAll();LanHttpServer old=server;server=null;if(old!=null)old.stop();port=DEFAULT_PORT;}
    @PluginMethod public void request(PluginCall call){run(call,()->{
        long transportGeneration=httpClient.generation();String host=target;if(host==null)return LanRoomService.obj("status",503,"data",LanRoomService.obj("error","请先创建或连接局域网主机"));
        String path=call.getString("path","");if(!path.matches("/api/duel/(rooms|join)(/[A-Za-z0-9]{4,8}(/(action|sync))?)?")&&!path.equals("/lan-info"))throw new IllegalArgumentException("无效的联机接口");
        String method=call.getString("method","GET").toUpperCase(java.util.Locale.ROOT);if(!method.equals("GET")&&!method.equals("POST"))throw new IllegalArgumentException("不支持的请求方法");
        Object raw=call.getData().opt("body");String body=raw==null||raw==JSONObject.NULL?null:raw instanceof String?(String)raw:raw.toString();
        return http(host,path,method,body,call.getString("token"),transportGeneration);
    });}
    private JSONObject http(String host,String path,String method,String body,String token,long transportGeneration)throws Exception{return httpClient.request(host,path,method,body,token,transportGeneration);}
    @PluginMethod public void saveBackup(PluginCall call){run(call,()->{
        Object input=call.getData().opt("data");String text=input instanceof String?(String)input:input==null?"":input.toString();
        if(text.getBytes(StandardCharsets.UTF_8).length>MAX_SAVE)throw new IllegalArgumentException("存档过大");new JSONObject(text);
        File dir=new File(getContext().getFilesDir(),"saves");if(!dir.exists()&&!dir.mkdirs())throw new IOException("无法创建备份目录");AtomicFile backup=new AtomicFile(new File(dir,"before-import.json"));FileOutputStream out=null;
        try{out=backup.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));backup.finishWrite(out);}catch(Exception e){if(out!=null)backup.failWrite(out);throw e;}
        return LanRoomService.obj("saved",true,"location","app-private/before-import.json");
    });}
    @PluginMethod public void exportSave(PluginCall call){getActivity().runOnUiThread(()->{
        if(pickerOpen){call.reject("请先完成当前文件选择","busy");return;}
        String text=call.getString("text","");if(text.getBytes(StandardCharsets.UTF_8).length>MAX_SAVE){call.reject("存档过大","tooLarge");return;}
        try{new JSONObject(text);}catch(Exception e){call.reject("存档不是有效 JSON","invalidSave");return;}
        exportText=text;pickerOpen=true;String filename=call.getString("filename","秘境决斗存档.json").replaceAll("[\\\\/:*?\"<>|\\x00-\\x1f]","_");
        Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE,filename);
        try{startActivityForResult(call,intent,"exportResult");}catch(Exception e){pickerOpen=false;exportText=null;call.reject("此设备没有可用的文件选择器","filePickerUnavailable");}
    });}
    @ActivityCallback private void exportResult(PluginCall call,ActivityResult result){
        pickerOpen=false;String text=exportText;exportText=null;if(call==null)return;
        if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("已取消导出","cancelled");return;}
        Uri uri=result.getData().getData();run(call,()->{if(uri==null||text==null)throw new IOException("未选择文件");try(OutputStream out=getContext().getContentResolver().openOutputStream(uri,"wt")){if(out==null)throw new IOException("无法写入文件");out.write(text.getBytes(StandardCharsets.UTF_8));}return LanRoomService.obj("saved",true);});
    }
    @PluginMethod public void importSave(PluginCall call){getActivity().runOnUiThread(()->{
        if(pickerOpen){call.reject("请先完成当前文件选择","busy");return;}pickerOpen=true;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"application/json","text/plain","application/octet-stream"});try{startActivityForResult(call,intent,"importResult");}catch(Exception e){pickerOpen=false;call.reject("此设备没有可用的文件选择器","filePickerUnavailable");}
    });}
    @ActivityCallback private void importResult(PluginCall call,ActivityResult result){
        pickerOpen=false;if(call==null)return;if(result.getResultCode()!=Activity.RESULT_OK||result.getData()==null){call.reject("已取消导入","cancelled");return;}
        Uri uri=result.getData().getData();run(call,()->{if(uri==null)throw new IOException("未选择文件");String text=readText(getContext().getContentResolver().openInputStream(uri),MAX_SAVE);new JSONObject(text);return LanRoomService.obj("text",text);});
    }
    @PluginMethod public void quit(PluginCall call){synchronized(modeLock){resetInternal();}call.resolve();getActivity().runOnUiThread(()->getActivity().finishAndRemoveTask());}
    @Override protected void handleOnDestroy(){synchronized(modeLock){resetInternal();}httpClient.close();io.shutdownNow();exportText=null;super.handleOnDestroy();}
    private interface Job{JSONObject run()throws Exception;}
    private void run(PluginCall call,Job job){try{io.execute(()->{try{resolve(call,job.run());}catch(Exception e){call.reject(e.getMessage()==null?"操作失败，请重试":e.getMessage(),"nativeError");}});}catch(RejectedExecutionException e){call.reject("主机繁忙，请稍后再试","busy");}}
    private static void resolve(PluginCall call,JSONObject data){try{call.resolve(new JSObject(data.toString()));}catch(Exception e){call.reject("无效的原生响应","nativeError");}}
    private static String readText(InputStream stream,int max)throws IOException{if(stream==null)throw new IOException("无法读取文件");try(InputStream in=stream;ByteArrayOutputStream out=new ByteArrayOutputStream()){byte[] buf=new byte[8192];int n;while((n=in.read(buf))!=-1){if(out.size()+n>max)throw new IOException("文件或响应过大");out.write(buf,0,n);}return out.toString(StandardCharsets.UTF_8.name());}}
}
