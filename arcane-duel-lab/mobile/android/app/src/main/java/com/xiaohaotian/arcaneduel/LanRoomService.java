package com.xiaohaotian.arcaneduel;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.Random;
import java.util.function.LongSupplier;

/** In-memory LAN equivalent of server/rooms.mjs. No simulation or solo save data. */
public final class LanRoomService {
    public static final String PROTOCOL = "arcane-duel-lan-v1";
    public static final String BUILD = "android1-crossplay-v2";
    public static final String RULESET = "duel-skill6-v5";
    public static final int WIN_SCORE = 3;
    private static final String[] HEROES = {"fire", "nature", "frost", "lightning", "shadow", "star"};
    private static final String[] SCENES = {"moon", "lava", "garden"};
    private static final String[] KEYS = {"q", "e", "r"};
    private static final long TTL = 86400000L;
    private static final int MAX_ROOMS = 64;
    private final Map<String, Room> rooms = new HashMap<>();
    private final LongSupplier clock;
    private final Random random;

    public static final class Result {
        public final int status;
        public final JSONObject data;
        public Result(int status, JSONObject data) { this.status = status; this.data = data; }
    }
    private static final class Problem extends RuntimeException {
        final int status;
        Problem(String message, int status) { super(message); this.status = status; }
    }
    private static final class Room {
        String code, hostToken, guestToken;
        JSONObject data, snapshot, input, offer, answer;
        long revision, expires, hostSeen, guestSeen, hostSeq, guestSeq;
    }
    public LanRoomService() { this(System::currentTimeMillis, new Random()); }
    public LanRoomService(LongSupplier clock, Random random) { this.clock = clock; this.random = random; }
    public synchronized void clear() { rooms.clear(); }

    // Serialize state mutations and clone every returned object; worker threads cannot alias room state.
    public synchronized Result handle(String method, String path, String token, JSONObject body) {
        try {
            if (!method.equals("GET") && !method.equals("POST")) fail("不支持的请求方法", 405);
            if (path.equals("/lan-info") && method.equals("GET")) return ok(obj("protocol", PROTOCOL, "build", BUILD, "name", "秘境决斗局域网主机"));
            if (!path.startsWith("/api/duel/")) fail("接口不存在", 404);
            String[] parts = path.substring(10).replaceAll("^/+|/+$", "").split("/");
            if (method.equals("POST") && parts.length == 1 && parts[0].equals("rooms")) return ok(create(body));
            if (method.equals("POST") && parts.length == 1 && parts[0].equals("join")) return ok(join(body));
            if (parts.length >= 2 && parts[0].equals("rooms")) {
                Room row = room(parts[1]); int seat = seat(row, token);
                if (parts.length == 2 && method.equals("GET")) return ok(obj("room", view(row, seat)));
                if (parts.length == 3 && method.equals("POST")) {
                    if (parts[2].equals("action")) return ok(action(row, seat, body));
                    if (parts[2].equals("sync")) return ok(sync(row, seat, body));
                }
            }
            fail("接口不存在", 404); return null;
        } catch (Problem e) { return new Result(e.status, obj("error", e.getMessage())); }
        catch (Exception e) { return new Result(503, obj("error", "房间服务暂时不可用，请稍后重试")); }
    }
    private JSONObject create(JSONObject body) throws JSONException {
        String wanted = code(body.opt("code"));
        if (!wanted.isEmpty() && !wanted.matches("[A-Z0-9]{4,8}")) fail("房间号需要 4～8 位字母或数字", 400);
        long now = clock.getAsLong(); rooms.entrySet().removeIf(e -> e.getValue().expires < now);
        if (rooms.size() >= MAX_ROOMS) fail("主机房间数量已满，请重新开启主机", 503);
        for (int attempt = 0; attempt < 8; attempt++) {
            String code = wanted.isEmpty() ? String.valueOf(100000 + random.nextInt(900000)) : wanted;
            if (rooms.containsKey(code)) { if (!wanted.isEmpty()) fail("这个房间号已被使用，请换一个", 409); continue; }
            Room r = new Room(); r.code = code; r.hostToken = id(); r.hostSeen = now; r.expires = now + TTL;
            r.data = obj("ruleset", RULESET, "phase", "waiting", "winScore", WIN_SCORE,
                "slots", arr(slot(body), JSONObject.NULL), "score", arr(0, 0), "round", 1,
                "roundSerial", 0, "epoch", id(), "scene", JSONObject.NULL, "startAt", 0,
                "winner", JSONObject.NULL, "lastWinner", JSONObject.NULL, "reason", JSONObject.NULL);
            rooms.put(code, r); return obj("token", r.hostToken, "room", view(r, 0));
        }
        fail("暂时无法创建房间，请重试", 503); return null;
    }
    private JSONObject join(JSONObject body) throws JSONException {
        Room r = room(code(body.opt("code")));
        if (!phase(r).equals("waiting")) fail("这场决斗已经开始，请等待房主返回房间", 409);
        if (!r.data.getJSONArray("slots").isNull(1) || r.guestToken != null) fail("房间已满，最多两位玩家", 409);
        r.data.getJSONArray("slots").put(1, slot(body)); r.guestToken = id(); r.guestSeen = clock.getAsLong(); touch(r);
        return obj("token", r.guestToken, "room", view(r, 1));
    }
    private JSONObject action(Room row, int seat, JSONObject body) throws JSONException {
        // Node RoomService mutations are transactional; operate on a copy until validation succeeds.
        JSONObject r = copy(row.data), s = r.getJSONArray("slots").optJSONObject(seat);
        if (s == null) fail("你已离开房间", 403);
        JSONArray slots = r.getJSONArray("slots"), score = r.getJSONArray("score");
        String phase = r.getString("phase"), type = body.optString("type");
        boolean clearGuest = false, resetRelay = false;
        switch (type) {
            case "leave":
                if (isBattle(phase)) { r.put("winner", 1-seat); score.put(1-seat, WIN_SCORE); r.put("phase", "finished").put("reason", "opponentLeft"); s.put("returned", true).put("left", true); }
                else if (seat == 0) r.put("phase", "closed").put("reason", "hostLeft");
                else { slots.put(1, JSONObject.NULL); clearGuest = true; }
                break;
            case "ready":
                if (!phase.equals("waiting")) fail("当前不能切换房间准备状态", 409);
                s.put("ready", Boolean.TRUE.equals(body.opt("ready"))); break;
            case "start":
                if (seat != 0) fail("只有房主可以开始游戏", 403);
                if (!phase.equals("waiting")) fail("游戏已经开始", 409);
                if (slots.isNull(1)) fail("等待另一位玩家加入房间", 409);
                if (!slots.getJSONObject(1).optBoolean("ready")) fail("玩家还未准备", 409);
                r.put("phase", "selecting").put("winScore", WIN_SCORE).put("epoch", id()).put("score", arr(0,0))
                    .put("round",1).put("roundSerial",0).put("scene",SCENES[random.nextInt(3)]).put("winner",JSONObject.NULL).put("reason",JSONObject.NULL);
                for (int i=0;i<2;i++) slots.getJSONObject(i).put("locked",false).put("returned",false);
                resetRelay = true; break;
            case "hero":
                String hero = body.optString("hero");
                if (!phase.equals("selecting") || !validHero(hero)) fail("当前不能选择这个英雄",409);
                if (!hero.equals(s.getString("hero"))) { s.put("hero",hero).put("loadout",defaultLoadout(hero)); unlock(slots); } break;
            case "loadout":
                if (!phase.equals("selecting")) fail("只能在开战前选择技能",409);
                JSONObject selected = checkedLoadout(s.getString("hero"),body.optJSONObject("loadout"));
                if (!selected.toString().equals(s.getJSONObject("loadout").toString())) { s.put("loadout",selected); unlock(slots); } break;
            case "lock":
                if (!phase.equals("selecting")) fail("当前不在英雄选择阶段",409);
                boolean ready = Boolean.TRUE.equals(body.opt("ready"));
                if (ready) { JSONObject loadout = checkedLoadout(s.getString("hero"),body.has("loadout")&&!body.isNull("loadout")?body.optJSONObject("loadout"):s.getJSONObject("loadout"));
                    if (!loadout.toString().equals(s.getJSONObject("loadout").toString())) {s.put("loadout",loadout);unlock(slots);} }
                s.put("locked",ready);
                if (slots.getJSONObject(0).optBoolean("locked") && slots.getJSONObject(1).optBoolean("locked")) r.put("phase","countdown").put("roundSerial",1).put("startAt",clock.getAsLong()+3000);
                break;
            case "round":
                if (seat != 0) fail("只有本局主机可以提交回合结果",403);
                if (!body.optString("epoch").equals(r.getString("epoch")) || !equalNumber(body.opt("roundSerial"),r.getInt("roundSerial")) || !(phase.equals("countdown")||phase.equals("active"))) break;
                if (clock.getAsLong()<r.getLong("startAt")) fail("倒计时还未结束",409);
                JSONArray hp=body.optJSONArray("hp");
                if (hp==null||hp.length()!=2) fail("无效的回合结果",400);
                for(int i=0;i<2;i++){Object n=hp.opt(i); if(!(n instanceof Number)||!Double.isFinite(((Number)n).doubleValue())||((Number)n).doubleValue()<0||((Number)n).doubleValue()>maxHealth(slots.getJSONObject(i).getString("hero")))fail("无效的回合结果",400);}
                int winner=hp.getDouble(0)<=0&&hp.getDouble(1)<=0?-1:hp.getDouble(0)<=0?1:hp.getDouble(1)<=0?0:-2;
                if(winner==-2||(winner==-1?!body.has("winner")||!body.isNull("winner"):!equalNumber(body.opt("winner"),winner)))fail("回合尚未结束",409);
                r.put("lastWinner",winner==-1?JSONObject.NULL:winner);if(winner>=0)score.put(winner,score.getInt(winner)+1);
                if(score.getInt(0)>=WIN_SCORE||score.getInt(1)>=WIN_SCORE)r.put("winner",score.getInt(0)>=WIN_SCORE?0:1).put("phase","finished").put("reason","score");
                else r.put("round",1+score.getInt(0)+score.getInt(1)).put("roundSerial",r.getInt("roundSerial")+1).put("phase","countdown").put("startAt",clock.getAsLong()+3000);
                break;
            case "return":
                if(!phase.equals("finished"))fail("本场决斗还未结束",409);s.put("returned",true);
                if(slots.getJSONObject(0).optBoolean("returned")&&slots.getJSONObject(1).optBoolean("returned")) {
                    if(slots.getJSONObject(0).optBoolean("left"))r.put("phase","closed").put("reason","hostLeft");
                    else if(slots.getJSONObject(1).optBoolean("left")){slots.put(1,JSONObject.NULL);r.put("phase","waiting");slots.getJSONObject(0).put("ready",false);clearGuest=true;}
                    else {r.put("phase","waiting");for(int i=0;i<2;i++)slots.getJSONObject(i).put("ready",false).put("locked",false).put("returned",false);}
                }break;
            case "forfeit":
                long otherSeen=seat==0?row.guestSeen:row.hostSeen;
                if(!isBattle(phase)||clock.getAsLong()-otherSeen<30000)fail("对方仍在线，暂不能结束对局",409);
                r.put("winner",seat).put("phase","finished").put("reason","disconnect");score.put(seat,WIN_SCORE);slots.getJSONObject(1-seat).put("left",true).put("returned",true);break;
            default:fail("未知的房间操作",400);
        }
        row.data=r;if(clearGuest)row.guestToken=null;
        if(resetRelay){row.snapshot=row.input=row.offer=row.answer=null;row.hostSeq=row.guestSeq=0;}
        touch(row);return obj("room",view(row,seat));
    }
    private JSONObject sync(Room row,int seat,JSONObject body) throws JSONException {
        if(seat==0)row.hostSeen=clock.getAsLong();else row.guestSeen=clock.getAsLong();
        if(body.optString("epoch").equals(row.data.getString("epoch"))) {
            JSONObject signal=body.optJSONObject("signal");if(signal!=null){if(signal.toString().length()>30000)fail("连接信息过大",400);if(seat==0)row.offer=copy(signal);else row.answer=copy(signal);}
            Object rawSeq=body.opt("seq");double numeric=rawSeq instanceof Number?((Number)rawSeq).doubleValue():-1;
            long seq=Double.isFinite(numeric)&&numeric>=0&&numeric<=9007199254740991d&&numeric==Math.floor(numeric)?(long)numeric:0;
            JSONObject snap=body.optJSONObject("snapshot");
            if(seat==0&&snap!=null){if(snap.has("ruleset")&&!snap.optString("ruleset").isEmpty()&&!snap.optString("ruleset").equals(RULESET))fail("双方战斗版本不一致，请使用同一版客户端",409);
                if(!snap.optString("epoch").equals(row.data.getString("epoch"))||!equalNumber(snap.opt("roundSerial"),row.data.getInt("roundSerial")))fail("已进入新的回合",409);
                if(snap.toString().length()>180000)fail("战斗数据过大",400);if(seq>row.hostSeq){row.snapshot=copy(snap);row.hostSeq=seq;}}
            JSONObject input=body.optJSONObject("input");if(seat==1&&input!=null){if(input.toString().length()>12000)fail("输入数据过大",400);if(seq>row.guestSeq){row.input=copy(input);row.guestSeq=seq;}}
        }
        return obj("room",view(row,seat),"relaySeq",seat==0?row.hostSeq:row.guestSeq,"input",seat==0?row.input:null,
            "snapshot",seat==1||body.optBoolean("resume")?row.snapshot:null,"signal",seat==0?row.answer:row.offer);
    }
    private Room room(String code) {Room r=rooms.get(code(code));if(r==null||r.expires<clock.getAsLong())fail("房间不存在或已过期",404);return r;}
    private int seat(Room r,String token){if(token!=null&&token.equals(r.hostToken))return 0;if(token!=null&&token.equals(r.guestToken))return 1;fail("房间凭证无效，请重新加入",403);return -1;}
    private JSONObject view(Room r,int seat)throws JSONException {JSONObject out=copy(r.data);return out.put("code",r.code).put("seat",seat).put("revision",r.revision).put("serverTime",clock.getAsLong()).put("seen",arr(r.hostSeen,r.guestSeen));}
    private static JSONObject slot(JSONObject b)throws JSONException {String hero=b.optString("hero");if(!validHero(hero))hero="fire";String name=b.optString("name","冒险者").replaceAll("[<>\\x00-\\x1f]","").trim();if(name.length()>16)name=name.substring(0,16);if(name.isEmpty())name="冒险者";return obj("name",name,"hero",hero,"loadout",defaultLoadout(hero),"ready",false,"locked",false,"returned",false);}
    public static JSONObject defaultLoadout(String hero){return obj("q",hero+"-0-0","e",hero+"-1-0","r",hero+"-2-0");}
    private static JSONObject checkedLoadout(String hero,JSONObject input){if(input==null||input.length()!=3)fail("请在F、E、R每行各选择一个技能",400);JSONObject result=new JSONObject();for(int row=0;row<3;row++){String key=KEYS[row],v=input.optString(key);if(!v.equals(hero+"-"+row+"-0")&&!v.equals(hero+"-"+row+"-1"))fail("技能必须属于当前英雄，并放入对应的F、E、R格",400);put(result,key,v);}return result;}
    private static void unlock(JSONArray slots)throws JSONException{for(int i=0;i<2;i++)slots.getJSONObject(i).put("locked",false);}
    private void touch(Room r){r.revision++;r.expires=clock.getAsLong()+TTL;}
    private static String phase(Room r){return r.data.optString("phase");}
    private static boolean isBattle(String phase){return phase.equals("selecting")||phase.equals("countdown")||phase.equals("active");}
    private static boolean validHero(String hero){for(String h:HEROES)if(h.equals(hero))return true;return false;}
    private static int maxHealth(String hero){return hero.equals("frost")||hero.equals("shadow")?165:hero.equals("star")?173:180;}
    private static boolean equalNumber(Object value,int expected){return value instanceof Number&&((Number)value).doubleValue()==expected;}
    private static String code(Object value){return value==null||value==JSONObject.NULL?"":String.valueOf(value).trim().toUpperCase(java.util.Locale.ROOT);}
    private static String id(){return UUID.randomUUID().toString();}
    private static void fail(String message,int status){throw new Problem(message,status);}
    private static Result ok(JSONObject data){return new Result(200,data);}
    public static JSONObject obj(Object...pairs){JSONObject o=new JSONObject();for(int i=0;i<pairs.length;i+=2)put(o,String.valueOf(pairs[i]),pairs[i+1]);return o;}
    public static JSONArray arr(Object...values){JSONArray a=new JSONArray();for(Object v:values)a.put(v==null?JSONObject.NULL:v);return a;}
    public static JSONObject copy(JSONObject value)throws JSONException{return value==null?null:new JSONObject(value.toString());}
    private static void put(JSONObject o,String key,Object value){try{o.put(key,value==null?JSONObject.NULL:value);}catch(JSONException e){throw new IllegalArgumentException(e);}}
}
