# 秘境决斗 Android

T47～49 / android1-crossplay-v2，包名 `com.xiaohaotian.arcaneduel`，当前0.1.2（versionCode3）。共用 `dist` 的模拟、成长和原始美术。Android工程不从原Sites加载游戏。正式签名、Tap应用与广告凭据不入Git。当前不提交TapTap审核或公开发布。

## 构建

1. 安装Node22+、JDK21、Android SDK36/build-tools36，配置JAVA_HOME与ANDROID_HOME。
2. 在本目录运行 `npm ci`。锁文件固定Capacitor8、App插件和构建工具版本。
3. 恢复本机 `.private/arcane-duel-release.jks` 与 `.private/signing.properties`。后者包含storePassword、keyAlias、keyPassword；首个试玩包已经使用这份密钥，后续必须一致。
4. PowerShell运行 `./build-android.ps1 -Variant Release`。脚本只重建mobile/web和Android生成资源，原始dist不删不压图；复制native/src中规范Java源，执行Capacitor同步和Gradle。
5. 输出 `android/app/build/outputs/apk/release/app-release.apk`。发布前核验apksigner签名、包名、版本、asset-manifest，实际安装覆盖并检查存档。

本次工具链隔离在工作区 `.runtime-tools/android`，不依赖修改全局Java/SDK设置。已有构建目录含中文，Gradle使用官方路径检查覆盖项；编译结果另见validation。

## 原生模块

- `native/src/` 是原生规范源；Android app同名文件为构建复制。MainActivity单独维护，先注册ArcaneBridge、TapBattle及ArcaneAds再super.onCreate。
- `ArcaneBridge` 在明确创建时开启44174局域网房间服务；Java房间协议与Node一致，手机版HTTP通过原生桥接请求，HTTPS本地资源不放开任意混合内容。
- `TapBattle` 使用真实TapSDK4.11.0 core/login/battle，未配置和未同意隐私时不初始化。`TapDuelLink`映射相同公平对局流程；战斗走有界帧输入/压缩状态分包，房间控制限频。后台应用草稿和本机配置已准备，实际双账号异网仍未验收，不能宣称异地已可玩。
- Tap配置文件 `.private/taptap.properties`：`clientId=...`、`clientToken=...`。后台APK包名与正式签名需一致；空配置包保留离线及LAN。
- `ArcaneAds` 使用官方TapADN5.3.2.0 AAR；`.private/dirichlet.properties`包含mediaId/mediaName/mediaKey/rewardedPlacement/interstitialPlacement/testMode。当前仅测试媒体、testMode=true，不开放正式变现。status只读，玩家主动确认广告隐私后才初始化。可选标识/应用列表/传感器采集关闭；真验证回调与正常关闭后才给完成收据，游戏再防重保存奖励。结算插屏/复活等完整玩家入口仍须单独验收，不能因原生接口存在就算完成。

手机设置可调触控透明度、画质及9种战斗按键位置，编辑时清输入/暂停战斗。首次新档提供跨页面教学，旧档不强制重做；教程23独立于20主线和2挑战，500金币首结仅一次。

## 存档与升级

设置→存档迁移：导出带版本和SHA256校验的整档；导入先备份，再整档替换，写入失败回滚，不合并首通/抽卡/挑战奖励。Android调用系统文档选择器，无广泛存储权限。原始WebView本地存档保留在固定HTTPS localhost来源；应用卸载会删除本机数据，先导出。

请把整个 `.private` 目录另行保管到私密备份位置。不要将签名私钥、密码或Tap配置上传到Git、公开网盘或商店材料。当前交付说明只公开证书指纹，不附密码。

## 验证边界

自动机制测试、桌面浏览器触控/布局、Android Java编译、APK签名检查和真机结果分别记录。模拟端点不能证明Tap官方网络质量；桌面触控不能证明手机发热/60帧。vivo X200 Pro及其他设备、同Wi-Fi两端轮流房主、Wi-Fi与移动数据异地仍必须实测。旧Windows、旧Sites及正式存档不覆盖。
