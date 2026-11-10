package com.xiaohaotian.arcaneduel;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** Pure JVM diagnostic probe: no Android/SDK initialization, requests or identifiers. */
public final class NativeAdDiagnosticsHarness {
    private static String decoded(String value){return new String(Base64.getDecoder().decode(value),StandardCharsets.UTF_8);}
    private static String json(String value){
        StringBuilder out=new StringBuilder("\"");for(int i=0;i<value.length();i++){char c=value.charAt(i);if(c=='\\'||c=='\"')out.append('\\');if(c<32||c>126)out.append(String.format("\\u%04x",(int)c));else out.append(c);}return out.append('"').toString();
    }
    public static void main(String[] args){
        String[] secrets=new String[Math.max(0,args.length-3)];for(int i=3;i<args.length;i++)secrets[i-3]=decoded(args[i]);
        Integer code=args[1].equals("none")?null:Integer.valueOf(args[1]);
        AdReceiptGate.FailureDiagnostic diagnostic=new AdReceiptGate.FailureDiagnostic(args[0],code,decoded(args[2]),secrets);
        AdReceiptGate gate=new AdReceiptGate("reward-item",true);gate.loaded("private-test-request");gate.shown();gate.verify(true);gate.fail();AdReceiptGate.Result terminal=gate.finish(true,"loadFailed");
        System.out.println("{\"phase\":"+json(diagnostic.phase)+",\"code\":"+diagnostic.code+",\"message\":"+json(diagnostic.message)+",\"completedAfterFailure\":"+terminal.completed+",\"receiptAfterFailure\":"+json(terminal.receipt)+"}");
    }
}
