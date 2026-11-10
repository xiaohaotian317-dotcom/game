package com.xiaohaotian.arcaneduel;

/** Verifies the service's human-facing rank without guessing the raw rank's base. */
public final class TowerRankContract {
    private TowerRankContract(){}
    public static Long verifiedRank(Long rawRank,String rankDisplay){
        if(rawRank==null||rawRank<0||rankDisplay==null||!rankDisplay.matches("[1-9][0-9]{0,18}"))return null;
        final long displayed;
        try{displayed=Long.parseLong(rankDisplay);}catch(NumberFormatException error){return null;}
        // Subtract from the strictly positive display value to avoid rawRank + 1 overflow.
        return rawRank==displayed||rawRank==displayed-1?displayed:null;
    }
}
