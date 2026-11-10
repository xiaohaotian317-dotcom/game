package com.xiaohaotian.arcaneduel;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Random;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONObject;

/** JVM-only harness; not packaged into the Android application. */
public final class NativeRoomHarness {
    public static void main(String[] args)throws Exception {
        System.setOut(new java.io.PrintStream(System.out,true,java.nio.charset.StandardCharsets.UTF_8));
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in,java.nio.charset.StandardCharsets.UTF_8));
        if(args.length>0&&args[0].equals("--server")){
            LanHttpServer server=new LanHttpServer(Integer.parseInt(args[1]));server.start(5000,true);
            System.out.println("{\"started\":true}");System.out.flush();try{while(input.readLine()!=null){}}finally{server.stop();}return;
        }
        AtomicLong clock=new AtomicLong(100000);LanRoomService service=new LanRoomService(clock::get,new Random(42));String line;
        while((line=input.readLine())!=null){try{
            JSONObject envelope=new JSONObject(line);if(envelope.has("time"))clock.set(envelope.getLong("time"));
            if(envelope.has("address")){try{System.out.println(LanRoomService.obj("address",LanAddress.normalize(envelope.getString("address"))));}catch(Exception error){System.out.println(LanRoomService.obj("error",error.getMessage()));}}
            else{LanRoomService.Result r=service.handle(envelope.optString("method","POST"),envelope.optString("path"),envelope.optString("token",null),envelope.optJSONObject("body")==null?new JSONObject():envelope.getJSONObject("body"));System.out.println(LanRoomService.obj("status",r.status,"data",r.data));}
        }catch(Exception e){System.out.println(LanRoomService.obj("fatal",e.getMessage()));}System.out.flush();}
    }
}
