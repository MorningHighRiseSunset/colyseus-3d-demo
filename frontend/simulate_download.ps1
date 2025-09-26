$downloadName = "ecmascript-core-v5.0.0.tgz"
$totalSeconds = 5 * 60 * 60  # 5 hours
$interval = 1  # seconds
$progressBarLength = 50

for ($elapsed = 0; $elapsed -lt $totalSeconds; $elapsed += $interval) {
    $percent = [math]::Round(($elapsed / $totalSeconds) * 100)
    $filled = [math]::Floor(($percent / 100) * $progressBarLength)
    $bar = ('#' * $filled).PadRight($progressBarLength, '-')
    Write-Host ("`rDownloading $downloadName [$bar] $percent%") -NoNewline
    Start-Sleep -Seconds $interval
}
Write-Host "`n`nDownload finished!"
Write-Host "🎉🎉🎉 You can now apply this to your JavaScript! 🎉🎉🎉"

# powershell -ExecutionPolicy Bypass -File ./frontend/simulate_download.ps1