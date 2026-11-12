param(
    [ValidateSet('Release','Debug')][string]$Variant='Release',
    [ValidateSet('TapTap','Preview')][string]$Profile='TapTap'
)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
$workspaceRoot=Split-Path $taskRoot -Parent
if(-not $env:JAVA_HOME){$env:JAVA_HOME=Join-Path $workspaceRoot '.runtime-tools/android/jdk/jdk-21.0.13+9'}
if(-not $env:ANDROID_HOME){$env:ANDROID_HOME=Join-Path $workspaceRoot '.runtime-tools/android/sdk'}
if(-not $env:GRADLE_USER_HOME){$env:GRADLE_USER_HOME=Join-Path $workspaceRoot '.runtime-tools/android/gradle-cache'}
if(-not (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin/java.exe'))){throw '需要JDK21，请先配置JAVA_HOME。'}
if(-not (Test-Path -LiteralPath (Join-Path $env:ANDROID_HOME 'platforms/android-36/android.jar'))){throw '需要Android SDK36，请先配置ANDROID_HOME。'}
if($Variant -eq 'Release' -and -not (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.private/arcane-duel-release.jks'))){throw '请恢复本项目原发布签名及signing.properties；不要另生成新签名覆盖旧版本。'}
$taskJavaOptions=$env:JAVA_TOOL_OPTIONS
# Windows AF_UNIX wake-up pipes reject some short-alias TEMP paths. Keep only
# this build's sockets in a known project directory; do not change system TEMP.
$taskJavaTemp=Join-Path $workspaceRoot '.runtime-tools/java-tmp'
New-Item -ItemType Directory -Path $taskJavaTemp -Force | Out-Null
$env:JAVA_TOOL_OPTIONS=($taskJavaOptions+' "-Djdk.net.unixdomain.tmpdir='+$taskJavaTemp.Replace('\','/')+'"').Trim()
Push-Location $taskRoot
try {
    if($Profile -eq 'Preview'){
        Write-Warning '当前是内部预览包：不强制实名认证，不可作为TapTap提审包。'
    } else {
        Write-Output '当前是TapTap配置：必须完成官方实名认证后才能开始游戏。'
    }
    & node 'scripts/build-android-web.mjs'
    if($LASTEXITCODE){throw '离线资源构建失败'}
    # Keep the native first frame byte-identical to the original loading art.
    Copy-Item -LiteralPath (Join-Path $taskRoot 'dist/assets/loading/moon-loading-v1.png') -Destination (Join-Path $PSScriptRoot 'android/app/src/main/res/drawable-nodpi/realm_launch.png') -Force
    Push-Location $PSScriptRoot
    try { & node 'node_modules/@capacitor/cli/bin/capacitor' sync android; if($LASTEXITCODE){throw '安卓同步失败'} } finally { Pop-Location }
    $javaSource=Join-Path $PSScriptRoot 'native/src/com/xiaohaotian/arcaneduel'
    $javaTarget=Join-Path $PSScriptRoot 'android/app/src/main/java/com/xiaohaotian/arcaneduel'
    foreach($name in @('ArcaneBridgePlugin','LanRoomService','LanHttpServer','LanHttpClient','LanAddress','TapBattlePlugin','TapLeaderboardPlugin','TapSafetyCore','TapSafetyPlugin','TowerRunContract','TowerRankContract','TowerWeeklyLedger','TapTowerLedger','AdsPlugin','AdReceiptGate')){Copy-Item -LiteralPath (Join-Path $javaSource "$name.java") -Destination $javaTarget -Force}
    $sdkPath=$env:ANDROID_HOME.Replace('\','/')
    Set-Content -LiteralPath (Join-Path $PSScriptRoot 'android/local.properties') -Value "sdk.dir=$sdkPath" -Encoding utf8
    & (Join-Path $PSScriptRoot 'android/gradlew.bat') -p (Join-Path $PSScriptRoot 'android') ":app:assemble$Variant" "-ParcaneReleaseProfile=$($Profile.ToLowerInvariant())" --no-daemon
    if($LASTEXITCODE){throw 'APK构建失败，查看Gradle日志。'}
    Write-Output "APK完成：$(Join-Path $PSScriptRoot ('android/app/build/outputs/apk/'+$Variant.ToLower()+'/app-'+$Variant.ToLower()+'.apk'))"
} finally { Pop-Location; $env:JAVA_TOOL_OPTIONS=$taskJavaOptions }
