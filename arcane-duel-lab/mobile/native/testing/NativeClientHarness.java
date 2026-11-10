package com.xiaohaotian.arcaneduel;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.*;
import org.json.JSONObject;

/** Test-only JSON-lines process; no Android dependencies and never included in the APK. */
public final class NativeClientHarness {
    private static synchronized void emit(JSONObject data){System.out.println(data);System.out.flush();}
    public static void main(String[] args)throws Exception {
        System.setOut(new PrintStream(System.out,true,StandardCharsets.UTF_8));
        LanHttpClient client=new LanHttpClient(args.length>0?Integer.parseInt(args[0]):4000,args.length>1?Integer.parseInt(args[1]):5000,args.length>2?Integer.parseInt(args[2]):4);
        ExecutorService workers=Executors.newFixedThreadPool(8);
        try(BufferedReader input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8))){String line;while((line=input.readLine())!=null){JSONObject call=new JSONObject(line);Object id=call.opt("id");
            if(call.optString("op").equals("cancel")){client.cancelAll();emit(LanRoomService.obj("id",id,"cancelled",true,"active",client.activeCount()));continue;}
            if(call.optString("op").equals("stats")){emit(LanRoomService.obj("id",id,"active",client.activeCount()));continue;}
            workers.execute(()->{try{
                Object raw=call.opt("body");String body=raw==null||raw==JSONObject.NULL?null:raw instanceof String?(String)raw:raw.toString();
                JSONObject response=client.request(call.optString("target"),call.optString("path","/lan-info"),call.optString("method","GET"),body,call.optString("token",null));
                emit(LanRoomService.obj("id",id,"ok",true,"response",response));
            }catch(Exception e){emit(LanRoomService.obj("id",id,"ok",false,"error",e.getMessage(),"class",e.getClass().getSimpleName()));}});
        }}finally{client.close();workers.shutdownNow();workers.awaitTermination(2,TimeUnit.SECONDS);}
    }
}
