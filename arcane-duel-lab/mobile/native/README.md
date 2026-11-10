# Android 原生桥接（T47）

本目录是原生插件的集中源码。`mobile/build-android.ps1` 把 `src/com/xiaohaotian/arcaneduel/*.java` 复制到 Android app 同包目录；不要在生成目录单独修复。

## 工程接入

包名固定 `com.xiaohaotian.arcaneduel`。在 `MainActivity.onCreate()` 的 `super.onCreate()` 之前注册：

```java
registerPlugin(ArcaneBridgePlugin.class);
registerPlugin(TapBattlePlugin.class);
```

Gradle 使用 `google()`、`mavenCentral()`：

```groovy
android {
    buildFeatures { buildConfig true }
    defaultConfig {
        minSdkVersion 28
        buildConfigField 'String', 'TAP_CLIENT_ID', '""'
        buildConfigField 'String', 'TAP_CLIENT_TOKEN', '""'
    }
}
dependencies {
    implementation 'org.nanohttpd:nanohttpd:2.3.1'
    implementation 'com.taptap.sdk:tap-core:4.11.0'
    implementation 'com.taptap.sdk:tap-login:4.11.0'
    implementation 'com.taptap.sdk:tap-battle:4.11.0'
}
```

所需权限为 `INTERNET`、`ACCESS_NETWORK_STATE`；LAN客户端使用严格私有IPv4 Socket HTTP，不放开全局cleartext或WebView混合内容。文件导入导出使用系统文档选择器，不申请存储读写权限。签名和 TapTap 客户端配置由主工程读取 `mobile/.private/`，不提交真实凭证。

## ArcaneBridge 接口

通过 Capacitor `registerPlugin('ArcaneBridge')` 使用。

| 方法 | 输入 | 返回 |
| --- | --- | --- |
| state / host / connect / reset | `host({port:44174})`、`connect({address})` | 状态对象 |
| insets | 无 | `{top,right,bottom,left}`，CSS dp |
| request | `{path,method,body,token}` | `{status,data}` |
| exportSave | `{text,filename}` | `{saved:true}`，取消拒绝 `cancelled` |
| importSave | 无 | `{text}`，取消拒绝 `cancelled` |
| saveBackup | `{data: JSON字符串或对象}` | `{saved:true,location}` |
| quit | 无 | 关闭界面，停止原生主机及未完成请求 |

状态对象为：

```json
{
  "platform": "android",
  "mode": "host",
  "target": "http://127.0.0.1:44174",
  "port": 44174,
  "addresses": [{"name":"wlan0","ip":"192.168.1.4","address":"192.168.1.4:44174"}],
  "testMode": false,
  "build": "android1-crossplay-v2"
}
```

`mode` 也可为 `guest`、`offline`；离线 `target` 为 null。`host()` 才会监听 `0.0.0.0`，服务仅接受私有 IPv4 / loopback。连接先检查 `/lan-info` 的协议和构建版本，禁止公共地址、账号密码、路径、查询、跳转及 IPv6。

`LanRoomService` 对齐 `server/rooms.mjs`：房间凭证、两席位、准备、选英雄与每行技能、三秒倒计时、先三分获胜、离开/返回/掉线判负及有序 relay。战斗仍由共享 JS Worker 模拟。单机装备、宠物和本地存档不进入房间状态。

HTTP 限定 GET / POST JSON，正文上限 220000 字节，socket 超时 5 秒；最多 8 个工作线程和 16 个等候连接。拒绝接近上限的正文前会有界读完，防止未读字节造成 Windows TCP 复位。房间状态同步访问、返回副本；最多 64 个房间、24 小时过期。`reset` 和销毁会停服、取消 HTTP 连接，不能在切后台时静默创建主机。

存档导入接口只读取文件。版本、校验、导入前调用备份和整档替换由共享 JS 存档模块执行。备份采用 `AtomicFile`，位置为应用私有目录 `saves/before-import.json`，8 MiB 上限。系统文档选择器允许用户自行选择分享位置。

## TapBattle 接口

使用官方 TapSDK 4.11.0 的实际类型，已从 Maven Central AAR 用 `javap` 核对接口。没有反射或假 SDK。插件状态不调用初始化；仅在用户明确同意后调用 `login({privacyAccepted:true})` 才初始化并等待真实初始化回调。未配置客户端 ID / Token 时，`status()` 返回 `configured:false`，其他方法拒绝 `notConfigured`。

| 方法 | 输入 / 返回 |
| --- | --- |
| status | `{configured,privacyAccepted,initialized,loggedIn,connected,playerId,room,frameActive,frameSyncId,sdkVersion,build}` |
| login | `{privacyAccepted:true}` → `{openId,name,avatar}` |
| connect | → `{playerId}` |
| create | `{name,properties,player:{status,properties}}` → `{room}` |
| join | `{roomId,player:{status,properties}}` → `{room}` |
| properties | `{scope:'room'/'player'/'status',name?,properties?,status?}` |
| sendCustom | `{data:字符串}`，2048 UTF-8 字节上限 |
| startFrame / stopFrame | 房主发起，`frameStart` 事件才表示已开始 |
| sendFrame | `{data:字符串,frameId,frameSyncId}`，1024 UTF-8 字节上限，必须匹配最新SDK帧信用 |
| leave / disconnect | 成功后清理本地房间或连接状态 |

所有通知为 Capacitor `battle` 事件，由 `type` 区分：

- `custom`: `{playerId,data}`
- `frame`: `{id,inputs:[{playerId,data,serverTime}]}`
- `frameStart`: `{room,frameSyncId,seed,serverTime}`
- `frameStop`: `{roomId,frameSyncId,reason}`
- `entered`: `{roomId,player}`
- `left` / `offline`: `{roomId,ownerId,playerId}`
- `kicked`: `{roomId,playerId}`
- `roomProperties`: `{roomId,name,properties}`
- `playerProperties`: `{playerId,properties}`
- `playerStatus`: `{playerId,status}`
- `disconnected`: `{code,message}`
- `serviceError`

`room` 字段为 `{id,name,type,ownerId,status,properties,maxPlayerCount,players,createTime}`；每个玩家为 `{id,status,customStatus,properties}`。properties 保持 SDK 的字符串格式，由 JS 解码。玩家属性、状态和 custom 共用每秒 12 次保守限流；properties 上限为 1536 UTF-8 字节。帧输入每个新SDK服务frameId最多5条且最多5条尚未完成调用；不会无限排队。控制请求有超时及排队上限。

TapTap 会自动变更房主；JS 必须在进行中的战斗收到房主离开/掉线时结束对局，不能直接把新房主当作原权威模拟。不同网络、账号授权、真实传输丢包、断线恢复和服务额度尚需实际应用配置及两台手机验证。

## 已验证与待验证

- LAN 三类真实 JVM 编译通过，五份 Java 在主工程 `compileReleaseJavaWithJavac` 构建通过（由主 Agent 记录）。
- `tests/t47-native-room.test.mjs` 比较 Java 与 Node 权威流程、校验规则集/六英雄血量/36 技能、验证 relay 和凭证，并实际启动 NanoHTTPD 由 Node HTTP 客户端接入。
- HTTP 实测覆盖两客户端并发加入，6 轮连续超限拒绝、跨域拒绝、合法创建，无测试重试。
- 整套五项测试连续五次通过，见 `validation/t47-native-repeat.json`。这些是本机协议测试，不代表安卓真机局域网或 TapTap 异地验收。
- 真机仍需验证文档选择器、覆盖安装、切后台、安全边距、手机对手机/电脑轮流做房主；TapTap 配置及异地实测未完成。

JVM 测试需要本机 JDK 21，以及放在本目录 `.cache/` 的官方 `org.json:json:20240303` 和 `org.nanohttpd:nanohttpd:2.3.1` JAR。缓存、SDK AAR/JAR 和测试 class 不打包、不提交。运行 `node --test tests/t47-native-room.test.mjs`。

参考：[TapTap Android 集成](https://developer.taptap.cn/docs/sdk/integration-guides/android/)、[登录](https://developer.taptap.cn/docs/sdk/taptap-login/development-guide/android-native/)、[联机房间](https://developer.taptap.cn/docs/sdk/tap-online-battle/guide/room/)、[NanoHTTPD 官方源码](https://github.com/NanoHttpd/nanohttpd)。官方文档可能更新 patch 号，本次统一固定 4.11.0 供同一构建验证。

- 原生LAN客户端另见tests/t47-native-client.test.mjs：真实Node/NanoHTTPD、分块解析、超时、取消与并发边界7项连续3轮通过；空token视为未提供，创建/加入仍无需凭证。
