param()
$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '../..')).Path
$release = Join-Path $workspace '发行/秘境决斗-秘境征途-campaign7'
$exe = Join-Path $release 'ArcaneDuelCampaign.exe'
$qaProfile = Join-Path $release 'resources/app/desktop/.qa-profiles/campaign7-smoke'
if (!(Test-Path -LiteralPath $exe)) { throw 'Build campaign7 first' }
if (Test-Path -LiteralPath $qaProfile) { throw 'Refusing to replace an existing QA profile' }
$process = $null
try {
    $process = Start-Process -FilePath $exe -ArgumentList '--qa-instance=campaign7-smoke' -WindowStyle Hidden -PassThru
    $port = $null
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        Start-Sleep -Milliseconds 250
        $connection = Get-NetTCPConnection -State Listen -OwningProcess $process.Id -ErrorAction SilentlyContinue | Where-Object LocalAddress -eq '127.0.0.1' | Select-Object -First 1
        if ($connection) { $port = $connection.LocalPort; break }
    }
    if (!$port) { throw 'Native app did not open its loopback server' }
    $base = "http://127.0.0.1:$port"
    $paths = @('index.html','lobby.html','campaign.html','campaign-team.css','src/campaign-team.mjs','src/campaign-platforms.mjs','src/campaign-hero-hud-art.mjs','assets/hero-hud/hero-hud-meta-v1.json','src/campaign-team-ui.mjs','src/campaign-enemy-ui.mjs','src/campaign-rewards.mjs','src/campaign-result-ui.mjs','src/campaign-companion.mjs','src/campaign-pet-painter.mjs','assets/pets/pets-meta-v3.json','assets/pets/growth-meta-v2.json','assets/pets/portrait-meta-v1.json')
    $runtime = Join-Path $release 'resources/app/dist'
    foreach ($folder in @('assets/campaign-results','assets/pets','assets/hero-hud')) {
        foreach ($file in Get-ChildItem -LiteralPath (Join-Path $runtime $folder) -File -Filter '*.png') {
            if ($folder -in @('assets/campaign-results','assets/hero-hud') -or $file.Name -match 'v4|form1-v2|portrait') { $paths += "$folder/$($file.Name)" }
        }
    }
    $checks = foreach ($resource in $paths) {
        $response = Invoke-WebRequest -Uri "$base/$resource" -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) { throw "Failed: $resource" }
        [pscustomobject]@{path=$resource; status=$response.StatusCode; bytes=$response.RawContentLength}
    }
    [pscustomobject]@{version='campaign7'; exe=$exe; qaInstance='campaign7-smoke'; localhostOnly=$true; checks=$checks; nativeWindowVisualQA=$false} | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'campaign7-native-startup.json') -Encoding utf8
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
        Remove-Item -LiteralPath $resolvedQa -Recurse -Force
    }
}
