param([switch]$LegacyMotion)
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$release = Join-Path $workspace '发行/秘境决斗-秘境征途-campaign16'
$exe = Join-Path $release 'ArcaneDuelCampaign.exe'
$qaProfile = Join-Path $release 'resources/app/desktop/.qa-profiles/campaign16-smoke'
if (!(Test-Path -LiteralPath $exe)) { throw 'Build campaign16 first' }
if (Test-Path -LiteralPath $qaProfile) { throw 'Refusing to replace an existing QA profile' }
$process = $null
try {
    $arguments = @('--qa-instance=campaign16-smoke'); if ($LegacyMotion) { $arguments += '--legacy-motion' }; $process = Start-Process -FilePath $exe -ArgumentList $arguments -WindowStyle Hidden -PassThru
    $port = $null
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        $connection = Get-NetTCPConnection -State Listen -OwningProcess $process.Id -ErrorAction SilentlyContinue | Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1
        if ($connection) { $port = $connection.LocalPort; break }
    }
    if (!$port) { throw 'Native app did not open its loopback server' }
    $base = "http://127.0.0.1:$port"
    $paths = @('settings.css','practice.css','codex-updates.css','skills.html','src/skill-gallery.mjs','src/settings-dialog.mjs','src/audio-preferences.mjs','src/redeem-codes.mjs','src/practice-loadout.mjs','src/practice-dialog.mjs','assets/settings/settings-shell-v1.png','assets/settings/settings-controls-v1.png','assets/music/moonlit-hall.wav','assets/music/realm-journey.wav','duel.html','duel-loadout.css','src/duel-skill-data.mjs','src/duel-skill-runtime.mjs','src/duel-skill-ui.mjs','src/duel-selection-queue.mjs','src/alternate-skills.mjs','src/alternate-skill-art.mjs','assets/campaign-growth/growth-hero-bounds-v1.json','daily-quests.css','boss-hud.css','src/daily-quests.mjs','src/daily-quests-ui.mjs','src/daily-ui-art.mjs','src/blink-guard.mjs','src/enemy-ground-art.mjs','src/boss-hud-art.mjs','src/hybrid-attack-art.mjs','src/duel-view.mjs','src/camera.mjs','assets/hybrid-attacks/projectile-meta-v2.json','assets/daily-ui/asset-meta-v1.json','assets/boss-hud/boss-hud-meta-v1.json','src/character-motion-v2.mjs','src/character-rig-legacy.mjs','src/character-skin.mjs','src/character-rig.mjs','src/combat-feedback.mjs','assets/combat-feedback/feedback-meta-v1.json','assets/combat-feedback/lightning-punch-v1.png','assets/combat-feedback/landing-warning-rings-v2.png','campaign-map-menu.css','src/campaign-map-menu.mjs','summon.html','summon.css','src/summon-app.mjs','src/summon-pools.mjs','src/summon-motion.mjs','assets/summon/scene-meta-v1.json','index.html','lobby.html','campaign.html','campaign-team.css','src/campaign-team.mjs','src/campaign-platforms.mjs','src/campaign-hero-hud-art.mjs','assets/hero-hud/hero-hud-meta-v1.json','src/campaign-team-ui.mjs','src/campaign-enemy-ui.mjs','campaign-pause.css','campaign-results.css','src/campaign-passives.mjs','src/campaign-passive-ui.mjs','src/campaign-pickups.mjs','src/campaign-drop-painter.mjs','src/campaign-platform-art.mjs','src/portrait-framing.mjs','assets/enemies/portraits-v1.json','assets/world-drops/drop-meta-v1.json','assets/campaign-platforms/platforms-meta-v1.json','assets/pause/pause-meta-v1.json','assets/passives/passive-meta-v1.json','src/campaign-rewards.mjs','src/campaign-result-ui.mjs','src/campaign-companion.mjs','src/campaign-pet-painter.mjs','assets/pets/pets-meta-v3.json','assets/pets/growth-meta-v2.json','assets/pets/portrait-meta-v1.json')
    $paths += @('realm-controls.css','equipment-ui.css','src/realm-controls.mjs','src/equipment-stats.mjs','src/equipment-ui.mjs','src/fx-animation.mjs','src/training-sentinel.mjs','src/minion-fx-painter.mjs','assets/refined-skills/atlas-meta-v2.json','assets/minion-fx/integration-manifest.json','assets/realm-controls/controls-meta-v1.json','assets/training/sentinel-meta-v1.json')
    $runtime = Join-Path $release 'resources/app/dist'
    foreach ($folder in @('assets/refined-skills','assets/minion-fx','assets/realm-controls','assets/training','assets/campaign-growth','assets/daily-ui','assets/boss-hud','assets/hybrid-attacks','assets/campaign-results','assets/pets','assets/hero-hud','assets/pause','assets/passives','assets/world-drops','assets/campaign-platforms','assets/summon')) {
        foreach ($file in Get-ChildItem -LiteralPath (Join-Path $runtime $folder) -File -Filter '*.png') {
            if ($folder -in @('assets/refined-skills','assets/minion-fx','assets/realm-controls','assets/training','assets/campaign-growth','assets/daily-ui','assets/boss-hud','assets/hybrid-attacks','assets/campaign-results','assets/hero-hud','assets/pause','assets/passives','assets/world-drops','assets/campaign-platforms','assets/summon') -or $file.Name -match 'v4|form1-v2|portrait') { $paths += "$folder/$($file.Name)" }
        }
    }
    $checks = foreach ($resource in $paths) {
        $response = Invoke-WebRequest -Uri "$base/$resource" -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) { throw "Failed: $resource" }
        [pscustomobject]@{path=$resource; status=$response.StatusCode; bytes=$response.RawContentLength}
    }
    $mode = if ($LegacyMotion) { 'legacy' } else { 'v2' }; $suffix = if ($LegacyMotion) { '-legacy' } else { '' }; $process.Refresh(); $command = (Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)").CommandLine; if ($LegacyMotion -and $command -notmatch '--legacy-motion') { throw 'Legacy argument missing from native process' }; [pscustomobject]@{motionRequested=$mode; processCommandLine=$command; hiddenWindowTitle=$process.MainWindowTitle; modeBridgeVerifiedByUnitTest=$true; version='campaign16'; exe=$exe; qaInstance='campaign16-smoke'; localhostOnly=$true; checks=$checks; nativeWindowVisualQA=$false} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot "campaign16-native$suffix-startup.json") -Encoding utf8
    Write-Output "Native startup passed: $($checks.Count) resources"
} finally {
    if ($process) {
        $own = Get-Process -Id $process.Id -ErrorAction SilentlyContinue
        if ($own -and $own.Path -eq $exe) {
            $null = $own.CloseMainWindow()
            if (!$own.WaitForExit(4000)) { Stop-Process -Id $own.Id -Force }
        }
    }
    if (Test-Path -LiteralPath $qaProfile) {
        $resolvedQa = (Resolve-Path -LiteralPath $qaProfile).Path
        $expectedParent = [System.IO.Path]::GetFullPath((Join-Path $release 'resources/app/desktop/.qa-profiles'))
        if ([System.IO.Path]::GetDirectoryName($resolvedQa) -ne $expectedParent) { throw 'Unsafe QA cleanup path' }
        for ($cleanupTry = 0; $cleanupTry -lt 8; $cleanupTry++) { try { Remove-Item -LiteralPath $resolvedQa -Recurse -Force; break } catch { if ($cleanupTry -eq 7) { throw }; Start-Sleep -Milliseconds 350 } }
    }
}
