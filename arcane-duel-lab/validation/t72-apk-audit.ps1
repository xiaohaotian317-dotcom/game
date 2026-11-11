$ErrorActionPreference='Stop'
$taskProject=Split-Path $PSScriptRoot -Parent
$taskWorkspace=Split-Path $taskProject -Parent
$env:JAVA_HOME=Join-Path $taskWorkspace '.runtime-tools/android/jdk/jdk-21.0.13+9'
$taskTools=Join-Path $taskWorkspace '.runtime-tools/android/sdk/build-tools/36.0.0'
$taskApk='mobile/android/app/build/outputs/apk/release/app-release.apk'
Push-Location $taskProject
try {
    & (Join-Path $taskTools 'aapt.exe') dump badging $taskApk > validation/t72-release-badging.txt
    if($LASTEXITCODE){throw 'APK version inspection failed'}
    & (Join-Path $taskTools 'aapt.exe') dump permissions $taskApk > validation/t72-release-permissions.txt
    if($LASTEXITCODE){throw 'APK permission inspection failed'}
    & (Join-Path $taskTools 'apksigner.bat') verify --verbose --print-certs $taskApk > validation/t72-release-signature.txt
    if($LASTEXITCODE){throw 'APK signature inspection failed'}
    & (Join-Path $taskTools 'zipalign.exe') -c -P 16 -v 4 $taskApk > validation/t72-release-alignment.txt
    if($LASTEXITCODE){throw 'APK alignment inspection failed'}
    & 'C:/Users/xiaohaotian/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe' scripts/package-android.py > validation/t72-apk-audit-run.txt
    if($LASTEXITCODE){throw 'APK resource or delivery verification failed'}
    Write-Output 'Signed APK, selected icon, original launch art and bundled resources verified.'
} finally {Pop-Location}
