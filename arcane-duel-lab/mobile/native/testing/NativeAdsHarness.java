package com.xiaohaotian.arcaneduel;

/** JVM callback-order probe. It does not emulate an SDK fill or generate app rewards. */
public final class NativeAdsHarness {
    public static void main(String[] events){
        AdReceiptGate gate=new AdReceiptGate("reward-item",true);AdReceiptGate.Result result=null;int ignoredFinishes=0;
        for(String event:events){
            AdReceiptGate.Result next=null;
            if(event.equals("loaded"))gate.loaded("sdk-request-private-value");
            else if(event.equals("shown"))gate.shown();
            else if(event.equals("verified"))gate.verify(true);
            else if(event.equals("denied"))gate.verify(false);
            else if(event.equals("error"))gate.fail();
            else if(event.equals("skip"))gate.skip();
            else if(event.equals("close")||event.equals("timeout")){
                next=gate.finish(event.equals("close"),event);if(next==null)ignoredFinishes++;
            }
            if(next!=null)result=next;
        }
        if(result==null)throw new IllegalArgumentException("No terminal event");
        System.out.println("{\"available\":"+result.available+",\"shown\":"+result.shown+",\"completed\":"+result.completed+",\"receipt\":\""+result.receipt+"\",\"ignoredFinishes\":"+ignoredFinishes+"}");
    }
}
