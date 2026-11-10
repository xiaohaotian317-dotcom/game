package com.xiaohaotian.arcaneduel;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Client run boundary, not a server attestation or a weekly reward authority. */
public final class TowerRunContract {
    public static final int MAX_FLOOR=1000000;
    private static final Set<String> HEROES=new HashSet<>(Arrays.asList("fire","nature","frost","lightning","shadow","star"));
    public final String runId;
    public final long floor;
    public TowerRunContract(JSONObject data){
        Object rawId=data.opt("runId");if(!(rawId instanceof String)||!((String)rawId).matches("[A-Za-z0-9_-]{8,128}"))throw new IllegalArgumentException("invalidRunId");runId=(String)rawId;
        floor=integer(data.opt("floor"),1,MAX_FLOOR,"invalidFloor");
        JSONArray team=data.optJSONArray("team");if(team==null||team.length()<1||team.length()>2)throw new IllegalArgumentException("invalidTeam");
        Set<String> selected=new HashSet<>();for(int i=0;i<team.length();i++){Object hero=team.opt(i);if(!(hero instanceof String)||!HEROES.contains(hero)||!selected.add((String)hero))throw new IllegalArgumentException("invalidTeam");}
        JSONObject proof=data.optJSONObject("proof");if(proof==null||!Boolean.TRUE.equals(proof.opt("ended"))||integer(proof.opt("completedFloor"),1,MAX_FLOOR,"runNotEnded")!=floor)throw new IllegalArgumentException("runNotEnded");
        // Local week strings, build labels and client proofs do not choose a cloud
        // period or establish trusted performance. The SDK chooses the current period.
    }
    public static int limit(Object value){return value==null||value==JSONObject.NULL?50:(int)integer(value,1,50,"invalidLimit");}
    private static long integer(Object value,int min,int max,String error){if(!(value instanceof Number))throw new IllegalArgumentException(error);double n=((Number)value).doubleValue();if(!Double.isFinite(n)||n!=Math.rint(n)||n<min||n>max)throw new IllegalArgumentException(error);return (long)n;}
}
