<#
PowerShell downloader to continuously fetch model files from the repository's raw GitHub URLs.
Default: runs for 4 hours, looping through the known token model paths and retrying downloads.
Usage (from repo root):
  powershell -ExecutionPolicy Bypass -File .\scripts\download_models.ps1 -DurationHours 4
Or run in background (hidden window):
  Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File .\scripts\download_models.ps1 -DurationHours 4' -WindowStyle Hidden
#>
param(
    [int]$DurationHours = 4,
    [int]$BaseIntervalSec = 60,
    [string]$OutputDir = ".\downloaded_models",
    [string]$RepoOwner = "MorningHighRiseSunset",
    [string]$RepoName = "colyseus-3d-demo",
    [string]$Branch = "main",
    [int]$PerFileRetries = 3
)

# Files to download (relative to repo root)
$files = @(
    'frontend/Models/RollsRoyce/rollsRoyceCarAnim.glb',
    'frontend/Models/Helicopter/helicopter.glb',
    'frontend/Models/Football/football.glb',
    'frontend/Models/Cheeseburger/cheeseburger.glb',
    'frontend/Models/Shoe/shoe.glb',
    'frontend/Models/WhiteGirlIdle/WhiteGirlIdle.glb'
)

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$endTime = (Get-Date).AddHours($DurationHours)
Write-Host "[DL] Starting model downloader: will run until $($endTime) (approx $DurationHours hour(s))"
Write-Host "[DL] Saving files to: $OutputDir"

function Download-WithRetries($url, $outPath, $maxRetries = 3) {
    $try = 0
    while ($try -lt $maxRetries) {
        $try++
        try {
            Write-Host "[DL] Attempt $try/$maxRetries -> $url"
            # Use a 60s timeout per request
            Invoke-WebRequest -Uri $url -OutFile $outPath -UseBasicParsing -TimeoutSec 60 -ErrorAction Stop
            Write-Host "[DL] SUCCESS: $url -> $outPath"
            return $true
        } catch {
            Write-Host "[DL] FAILED: $url (attempt $try) - $($_.Exception.Message)"
            if ($try -lt $maxRetries) { Start-Sleep -Seconds (5 * $try) }
        }
    }
    return $false
}

while ((Get-Date) -lt $endTime) {
    foreach ($f in $files) {
        try {
            $url = "https://raw.githubusercontent.com/$RepoOwner/$RepoName/$Branch/$f"
            $leaf = Split-Path $f -Leaf
            $out = Join-Path $OutputDir $leaf

            # If file exists and is large enough, skip unless you want to force redownload
            if (Test-Path $out) {
                $size = (Get-Item $out).Length
                if ($size -gt 1024) {
                    Write-Host "[DL] Skipping (exists): $leaf ($([Math]::Round($size/1024,1)) KB)"
                    continue
                }
            }

            $ok = Download-WithRetries -url $url -outPath $out -maxRetries $PerFileRetries
            if (-not $ok) {
                Write-Host "[DL] Giving up on this pass for $leaf (will try again later)"
            }
        } catch {
            Write-Host "[DL] Unexpected error handling ${f}: $($_.Exception.Message)"
        }

        Start-Sleep -Milliseconds 500
    }

    # Wait between passes (exponential-ish is handled inside background loop if you want; keep simple here)
    Write-Host "[DL] Pass complete. Waiting $BaseIntervalSec seconds before next pass. Current time: $(Get-Date)"
    Start-Sleep -Seconds $BaseIntervalSec
}

Write-Host "[DL] Finished background download loop. Time: $(Get-Date)"
