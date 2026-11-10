package com.xiaohaotian.arcaneduel;

import org.json.JSONArray;
import org.json.JSONObject;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Strict app-specific ledger schema. Never accepts a hero/bag/save payload. */
public final class TowerWeeklyLedger {
    public static final int MAX_BYTES=512*1024,MAX_CLAIMS=512;
    private static void keys(JSONObject value,String... keys){Set<String> allowed=new HashSet<>(Arrays.asList(keys));java.util.Iterator<String> names=value.keys();while(names.hasNext())if(!allowed.contains(names.next()))throw new IllegalArgumentException("invalidLedgerField");}
    public static JSONObject empty() throws org.json.JSONException{return new JSONObject().put("version",1).put("claims",new JSONArray());}
    public static JSONObject normalized(JSONObject input) throws org.json.JSONException{
        if(input==null||input.toString().getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw new IllegalArgumentException("invalidLedgerSize");keys(input,"version","claims");if(!Integer.valueOf(1).equals(input.opt("version")))throw new IllegalArgumentException("invalidLedgerVersion");JSONArray claims=input.optJSONArray("claims");if(claims==null||claims.length()>MAX_CLAIMS)throw new IllegalArgumentException("invalidLedgerClaims");JSONArray result=new JSONArray();Set<String> periods=new HashSet<>(),nonces=new HashSet<>();
        for(int i=0;i<claims.length();i++){
            JSONObject c=claims.optJSONObject(i);if(c==null)throw new IllegalArgumentException("invalidLedgerClaim");keys(c,"periodToken","nonce","rank","rewards");Object p=c.opt("periodToken"),n=c.opt("nonce"),r=c.opt("rank");if(!(p instanceof String)||((String)p).isEmpty()||((String)p).length()>256||((String)p).matches(".*[\\p{Cntrl}\\p{Cf}].*")||!periods.add((String)p))throw new IllegalArgumentException("invalidLedgerPeriod");if(!(n instanceof String)||!((String)n).matches("[A-Za-z0-9_-]{16,128}")||!nonces.add((String)n))throw new IllegalArgumentException("invalidLedgerNonce");if(!(r instanceof Number)||!Double.isFinite(((Number)r).doubleValue())||((Number)r).doubleValue()!=Math.rint(((Number)r).doubleValue())||((Number)r).doubleValue()<1||((Number)r).doubleValue()>50)throw new IllegalArgumentException("invalidLedgerRank");int rank=((Number)r).intValue();
            JSONArray rewards=c.optJSONArray("rewards"),expected=rewards(rank);if(rewards==null||rewards.length()!=expected.length())throw new IllegalArgumentException("invalidLedgerRewards");for(int j=0;j<rewards.length();j++){JSONObject item=rewards.optJSONObject(j),target=expected.getJSONObject(j);if(item==null)throw new IllegalArgumentException("invalidLedgerRewards");keys(item,"type","count");if(!target.get("type").equals(item.opt("type"))||!(item.opt("count") instanceof Number)||((Number)item.get("count")).doubleValue()!=target.getInt("count"))throw new IllegalArgumentException("invalidLedgerRewards");}
            result.put(new JSONObject().put("periodToken",p).put("nonce",n).put("rank",rank).put("rewards",expected));
        }
        return new JSONObject().put("version",1).put("claims",result);
    }
    private static JSONArray rewards(int rank) throws org.json.JSONException{JSONArray out=new JSONArray();if(rank==1)out.put(new JSONObject().put("type","heroChoice").put("count",1));out.put(new JSONObject().put("type",rank<=10?"stoneHigh":"stoneMedium").put("count",3));out.put(new JSONObject().put("type",rank<=10?"chestLarge":"chestMedium").put("count",3));return out;}
    public static boolean extendsByOne(JSONObject previous,JSONObject next) throws org.json.JSONException{
        JSONArray before=normalized(previous).getJSONArray("claims"),after=normalized(next).getJSONArray("claims");if(after.length()<before.length()||after.length()>before.length()+1)return false;
        for(int i=0;i<before.length();i++){JSONObject old=before.getJSONObject(i);boolean found=false;for(int j=0;j<after.length();j++)if(old.toString().equals(after.getJSONObject(j).toString()))found=true;if(!found)return false;}return true;
    }
}
