package com.xiaohaotian.arcaneduel;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

/** Only SDK verification plus a normal close can produce a local test receipt. */
public final class AdReceiptGate {
    public final String placement;
    public final boolean rewarded;
    public final String attemptId=UUID.randomUUID().toString();
    private boolean available,shown,verified,failed,ended;
    private String requestId="";

    public AdReceiptGate(String placement,boolean rewarded){this.placement=placement;this.rewarded=rewarded;}
    public void loaded(String sdkRequestId){if(!ended){available=true;if(sdkRequestId!=null)requestId=sdkRequestId;}}
    public void shown(){if(!ended){available=true;shown=true;}}
    public void verify(boolean valid){if(!ended){if(valid)verified=true;else failed=true;}}
    // SDK videos may allow a skip after the verified viewing quota has been met.
    public void skip(){if(!ended&&!verified)failed=true;}
    public void fail(){if(!ended)failed=true;}
    public boolean isShown(){return shown;}
    public boolean isEnded(){return ended;}
    public Result finish(boolean normalClose,String reason){
        if(ended)return null;ended=true;
        boolean completed=normalClose&&rewarded&&shown&&verified&&!failed;
        String receipt=completed?"dirichlet-test:"+placement+":"+digest(requestId)+":"+attemptId:"";
        return new Result(available,shown,completed,receipt,completed?"":reason);
    }
    private static String digest(String text){
        if(text.isEmpty())return "local";
        try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(int i=0;i<12;i++)out.append(String.format("%02x",bytes[i]&255));return out.toString();}
        catch(Exception ignored){return "local";}
    }
    public static final class Result {
        public final boolean available,shown,completed;
        public final String receipt,reason;
        Result(boolean available,boolean shown,boolean completed,String receipt,String reason){this.available=available;this.shown=shown;this.completed=completed;this.receipt=receipt;this.reason=reason;}
    }
}
