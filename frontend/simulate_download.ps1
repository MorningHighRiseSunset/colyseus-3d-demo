
$filesToDownload = @(
    @{ Name = "awesome-library-v1.2.3.js"; Type = "JavaScript" },
    @{ Name = "data-analysis-v0.9.8.py"; Type = "Python" }
)
$totalSeconds = 3 * 60 * 60  # 3 hours
$interval = 1  # seconds
$progressBarLength = 50

foreach ($file in $filesToDownload) {
    $downloadName = $file.Name
    for ($elapsed = 0; $elapsed -lt $totalSeconds; $elapsed += $interval) {
        $percent = [math]::Round(($elapsed / $totalSeconds) * 100)
        $filled = [math]::Floor(($percent / 100) * $progressBarLength)
        $bar = ('#' * $filled).PadRight($progressBarLength, '-')
        Write-Host ("`rDownloading $downloadName [$bar] $percent%") -NoNewline
        Start-Sleep -Seconds $interval
    }
    Write-Host "`n`nDownload of $downloadName finished!"
    if ($file.Type -eq "JavaScript") {
        Write-Host "🎉🎉🎉 You can now apply this to your JavaScript! 🎉🎉🎉"
    } elseif ($file.Type -eq "Python") {
        Write-Host "🐍🐍🐍 You can now use this in your Python scripts! 🐍🐍🐍"
    }
    Start-Sleep -Seconds 2
}

# powershell -ExecutionPolicy Bypass -File ./frontend/simulate_download.ps1