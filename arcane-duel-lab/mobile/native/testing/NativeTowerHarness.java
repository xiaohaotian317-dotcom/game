package com.xiaohaotian.arcaneduel;
import org.json.JSONObject;
import java.util.Base64;
import java.nio.charset.StandardCharsets;
import java.io.BufferedReader;
import java.io.InputStreamReader;
/** Boundary tests only; never initializes TapSDK or pretends to return real ranks. */
public final class NativeTowerHarness {
    private static JSONObject data(String value){return new JSONObject(new String(Base64.getDecoder().decode(value),StandardCharsets.UTF_8));}
    public static void main(String[] args)throws Exception{
        String[] inputs=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8)).lines().toArray(String[]::new);
        JSONObject out=new JSONObject();try{
            if(args[0].equals("run")){TowerRunContract run=new TowerRunContract(data(inputs[0]));out.put("ok",true).put("floor",run.floor);}
            else if(args[0].equals("ledger")){JSONObject ledger=TowerWeeklyLedger.normalized(data(inputs[0]));out.put("ok",true).put("ledger",ledger);}
            else if(args[0].equals("append"))out.put("ok",TowerWeeklyLedger.extendsByOne(data(inputs[0]),data(inputs[1])));
            else throw new IllegalArgumentException("unknownMode");
        }catch(Exception error){out.put("ok",false).put("reason",error.getMessage()==null?"invalid":error.getMessage());}
        System.out.println(out);
    }
}
