package com.xiaohaotian.arcaneduel;
import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.io.BufferedReader;
import java.io.InputStreamReader;
/** Pure rank boundary checks only. No SDK or network initialization. */
public final class NativeTowerRankHarness {
    public static void main(String[] args)throws Exception{
        String input=new BufferedReader(new InputStreamReader(System.in,StandardCharsets.UTF_8)).readLine();
        JSONArray cases=new JSONArray(input),result=new JSONArray();
        for(int i=0;i<cases.length();i++){
            JSONArray value=cases.getJSONArray(i);Long raw=value.isNull(0)?null:Long.valueOf(value.getString(0));String display=value.isNull(1)?null:value.getString(1);
            Long verified=TowerRankContract.verifiedRank(raw,display);result.put(verified==null?JSONObject.NULL:verified);
        }
        System.out.println(result);
    }
}
