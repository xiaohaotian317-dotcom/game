package com.xiaohaotian.arcaneduel;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.taptap.sdk.cloudsave.ArchiveData;
import com.taptap.sdk.cloudsave.ArchiveMetadata;
import com.taptap.sdk.cloudsave.TapTapCloudSave;
import com.taptap.sdk.cloudsave.internal.TapCloudSaveRequestCallback;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/** One Tap-owned tiny archive; revision reread is optimistic checking, never distributed CAS. */
public final class TapTowerLedger {
    public interface Callback {void result(JSObject value);}
    private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private boolean busy;private int generation;
    // Kotlin 4.11.0 DefaultImpls are not Java interface default methods.
    private static abstract class Callbacks implements TapCloudSaveRequestCallback {
        @Override public void onArchiveCreated(ArchiveData archive){}
        @Override public void onArchiveUpdated(ArchiveData archive){}
        @Override public void onArchiveDeleted(ArchiveData archive){}
        @Override public void onArchiveListResult(List<ArchiveData> archives){}
        @Override public void onArchiveDataResult(byte[] bytes){}
        @Override public void onArchiveCoverResult(byte[] bytes){}
        @Override public void onRequestError(int code,String message){}
    }
    private static final class State {final ArchiveData archive;final JSONObject ledger;State(ArchiveData archive,JSONObject ledger){this.archive=archive;this.ledger=ledger;}String revision(){return archive==null?"":archive.getFileId();}}
    private interface Loaded {void success(State state);}
    public TapTowerLedger(Context context){this.context=context.getApplicationContext();}
    public static String digest(String value){try{byte[] bytes=MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));StringBuilder out=new StringBuilder();for(byte b:bytes)out.append(String.format("%02x",b&255));return out.toString();}catch(Exception error){throw new IllegalStateException("hashUnavailable");}}
    private String name(){return "arcane_tower_weekly_v1_"+digest(BuildConfig.TOWER_LEADERBOARD_ID).substring(0,12);}
    private JSObject response(String account,State state){JSObject out=new JSObject();out.put("available",true);out.put("accountId",account);out.put("revision",state.revision());out.put("ledger",state.ledger);out.put("storage","taptap-cloudsave");out.put("atomicCompareAndSwap",false);return out;}
    private JSObject error(String reason,Integer code){JSObject out=new JSObject();out.put("available",false);out.put("written",false);out.put("reason",reason);if(code!=null)out.put("errorCode",code.intValue());return out;}
    private void finish(int id,Callback callback,JSObject out){if(!busy||generation!=id)return;busy=false;callback.result(out);}
    private int begin(Callback callback){if(busy){callback.result(error("busy",null));return -1;}busy=true;int id=++generation;main.postDelayed(()->finish(id,callback,error("cloudTimeout",null)),40000);return id;}
    private void read(int id,Callback callback,Loaded loaded){
        try{TapTapCloudSave.getArchiveList(new Callbacks(){
            @Override public void onRequestError(int code,String message){main.post(()->finish(id,callback,error("cloudUnavailable",code)));}
            @Override public void onArchiveListResult(List<ArchiveData> archives){main.post(()->{
                if(!busy||id!=generation)return;ArchiveData match=null;if(archives==null){finish(id,callback,error("invalidCloudResponse",null));return;}for(ArchiveData archive:archives)if(name().equals(archive.getName())){if(match!=null){finish(id,callback,error("duplicateLedgerArchives",null));return;}match=archive;}
                if(match==null){try{loaded.success(new State(null,TowerWeeklyLedger.empty()));}catch(Exception error){finish(id,callback,error("invalidCloudLedger",null));}return;}final ArchiveData selected=match;if(selected.getUuid()==null||selected.getUuid().isEmpty()||selected.getFileId()==null||selected.getFileId().isEmpty()||selected.getFileId().length()>1024||selected.getSaveSize()>TowerWeeklyLedger.MAX_BYTES){finish(id,callback,error("invalidCloudArchive",null));return;}
                try{TapTapCloudSave.getArchiveData(selected.getUuid(),selected.getFileId(),new Callbacks(){
                    @Override public void onRequestError(int code,String message){main.post(()->finish(id,callback,error("cloudUnavailable",code)));}
                    @Override public void onArchiveDataResult(byte[] bytes){main.post(()->{if(!busy||id!=generation)return;try{if(bytes==null||bytes.length>TowerWeeklyLedger.MAX_BYTES)throw new IllegalArgumentException();loaded.success(new State(selected,TowerWeeklyLedger.normalized(new JSONObject(new String(bytes,StandardCharsets.UTF_8)))));}catch(Exception error){finish(id,callback,error("invalidCloudLedger",null));}});}
                });}catch(Exception error){finish(id,callback,error("cloudUnavailable",null));}
            });}
        });}catch(Exception error){finish(id,callback,error("cloudUnavailable",null));}
    }
    public void load(String account,Callback callback){int id=begin(callback);if(id>=0)read(id,callback,state->finish(id,callback,response(account,state)));}
    public void write(String account,String expectedRevision,JSONObject candidate,Callback callback){
        final JSONObject ledger;try{ledger=TowerWeeklyLedger.normalized(candidate);}catch(Exception error){callback.result(error("invalidLedger",null));return;}if(expectedRevision==null||expectedRevision.length()>1024){callback.result(error("invalidRevision",null));return;}int id=begin(callback);if(id<0)return;
        read(id,callback,state->{
            if(!expectedRevision.equals(state.revision())){finish(id,callback,error("revisionConflict",null));return;}try{if(!TowerWeeklyLedger.extendsByOne(state.ledger,ledger)){finish(id,callback,error("ledgerConflict",null));return;}}catch(Exception error){finish(id,callback,error("invalidLedger",null));return;}
            if(state.ledger.toString().equals(ledger.toString())){JSObject out=response(account,state);out.put("written",true);finish(id,callback,out);return;}
            final File file;try{file=File.createTempFile("tower-weekly-",".json",context.getCacheDir());try(FileOutputStream stream=new FileOutputStream(file)){stream.write(ledger.toString().getBytes(StandardCharsets.UTF_8));stream.getFD().sync();}}catch(Exception error){finish(id,callback,error("localWriteFailed",null));return;}
            ArchiveMetadata metadata=new ArchiveMetadata.Builder().setName(name()).setSummary("秘境决斗爬塔每周领奖记录").setExtra("tower-weekly-ledger-v1").setPlaytime(0).build();
            TapCloudSaveRequestCallback upload=new Callbacks(){
                private void success(ArchiveData archive){main.post(()->{file.delete();if(archive==null||archive.getFileId()==null||archive.getFileId().isEmpty()){finish(id,callback,error("invalidCloudResponse",null));return;}JSObject out=response(account,new State(archive,ledger));out.put("written",true);finish(id,callback,out);});}
                @Override public void onArchiveCreated(ArchiveData archive){success(archive);}
                @Override public void onArchiveUpdated(ArchiveData archive){success(archive);}
                @Override public void onRequestError(int code,String message){main.post(()->{file.delete();finish(id,callback,error("cloudUnavailable",code));});}
            };
            try{if(state.archive==null)TapTapCloudSave.createArchive(metadata,file.getAbsolutePath(),null,upload);else TapTapCloudSave.updateArchive(state.archive.getUuid(),metadata,file.getAbsolutePath(),null,upload);}catch(Exception error){file.delete();finish(id,callback,error("cloudUnavailable",null));}
            // On timeout the SDK may still finish uploading. Keep its private source
            // file until that callback, then a read with the same nonce resolves uncertainty.
        });
    }
}
