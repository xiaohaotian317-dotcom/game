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

    /** Bounded public diagnostics only. Never retain a raw SDK message or credential. */
    public static final class FailureDiagnostic {
        public static final int MAX_MESSAGE_CODEPOINTS=320;
        public final String phase,message;
        public final Integer code; // null means this callback did not provide an SDK error code.
        public FailureDiagnostic(String phase,Integer code,String rawMessage,String... secrets){
            this.phase=validPhase(phase);this.code=code;this.message=sanitize(rawMessage,secrets);
        }
        private static String validPhase(String phase){
            if(phase!=null)for(String allowed:new String[]{"init","load","show","video","verify","timeout","lifecycle"})if(phase.equals(allowed))return phase;
            return "unknown";
        }
        private static String sanitize(String raw,String... secrets){
            if(raw==null||raw.isEmpty())return "";
            // The public result is much shorter than the bounded scan, so a truncated
            // token at the scan boundary can never appear in the returned message.
            String value=raw.substring(0,Math.min(raw.length(),8192));
            if(secrets!=null)for(String secret:secrets)if(secret!=null&&!secret.isEmpty())value=value.replace(secret,"[redacted]");
            value=value.replaceAll("[\\p{Cntrl}\\p{Cf}]+"," ");
            value=value.replaceAll("(?i)\\b[a-z][a-z0-9+.-]{1,20}://[^\\s<>\\\"']+|\\bwww\\.[^\\s<>\\\"']+","[url]");
            value=value.replaceAll("(?i)((?:media[_ -]?(?:key|id)|client[_ -]?(?:token|secret|id)|access[_ -]?token|authorization|request[_ -]?id|trace[_ -]?id|user[_ -]?id|device[_ -]?id|oaid|imei|android[_ -]?id|ip(?:address)?)[\\\"']?\\s*[:=]\\s*)(?:\\\"[^\\\"\\r\\n]*\\\"|'[^'\\r\\n]*'|[^\\s,;}\\]]+)","$1[redacted]");
            value=value.replaceAll("\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b","[ip]");
            value=value.replaceAll("(?i)(?<![a-z0-9])(?:[0-9a-f]{0,4}:){2,}[0-9a-f:.]*(?:%[a-z0-9_.-]+)?","[ip]");
            value=value.replaceAll("(?i)\\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\b","[id]");
            value=value.replaceAll("(?i)\\b[0-9a-f]{12,}\\b|\\b[0-9]{8,}\\b","[id]");
            value=value.replaceAll("\\b(?=[A-Za-z0-9_-]{20,}\\b)(?=[A-Za-z0-9_-]*[0-9])[A-Za-z0-9_-]{20,}\\b","[id]");
            value=value.replaceAll("\\s+"," ").trim();
            int count=value.codePointCount(0,value.length());
            return count>MAX_MESSAGE_CODEPOINTS?value.substring(0,value.offsetByCodePoints(0,MAX_MESSAGE_CODEPOINTS-1))+"…":value;
        }
    }
}
