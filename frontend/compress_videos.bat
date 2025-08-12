@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Video Compression Script for Metropoly
echo ========================================

REM Check if ffmpeg is installed
ffmpeg -version >nul 2>&1
if errorlevel 1 (
    echo ERROR: ffmpeg is not installed or not in PATH
    echo Please download ffmpeg from https://ffmpeg.org/download.html
    echo and add it to your system PATH
    pause
    exit /b 1
)

REM Create compressed directory
if not exist "Videos\compressed" mkdir "Videos\compressed"

echo Found videos to compress:
echo.

REM Compress large videos (>50MB) - heavy compression
echo Processing LARGE videos (>50MB)...
for %%f in (Videos\*.mp4) do (
    for %%A in ("%%f") do set size=%%~zA
    set /a size_mb=!size!/1024/1024
    
    if !size_mb! gtr 50 (
        echo Compressing: %%~nxf (!size_mb!MB)
        ffmpeg -i "%%f" -c:v libx264 -preset medium -crf 25 -b:v 1500k -maxrate 2000k -bufsize 3000k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "Videos\compressed\compressed_%%~nxf"
        if !errorlevel! equ 0 (
            echo   Success: compressed_%%~nxf
        ) else (
            echo   Failed: %%f
        )
    )
)

REM Compress medium videos (20-50MB) - moderate compression
echo.
echo Processing MEDIUM videos (20-50MB)...
for %%f in (Videos\*.mp4) do (
    for %%A in ("%%f") do set size=%%~zA
    set /a size_mb=!size!/1024/1024
    
    if !size_mb! leq 50 if !size_mb! gtr 20 (
        echo Compressing: %%~nxf (!size_mb!MB)
        ffmpeg -i "%%f" -c:v libx264 -preset medium -crf 23 -b:v 1200k -maxrate 1500k -bufsize 2000k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "Videos\compressed\compressed_%%~nxf"
        if !errorlevel! equ 0 (
            echo   Success: compressed_%%~nxf
        ) else (
            echo   Failed: %%f
        )
    )
)

REM Compress small videos (<20MB) - light compression
echo.
echo Processing SMALL videos (<20MB)...
for %%f in (Videos\*.mp4) do (
    for %%A in ("%%f") do set size=%%~zA
    set /a size_mb=!size!/1024/1024
    
    if !size_mb! leq 20 (
        echo Compressing: %%~nxf (!size_mb!MB)
        ffmpeg -i "%%f" -c:v libx264 -preset medium -crf 20 -b:v 1000k -maxrate 1200k -bufsize 1500k -c:a aac -b:a 128k -ar 44100 -vf "scale=1280:720:force_original_aspect_ratio=decrease" -r 30 -movflags +faststart -y "Videos\compressed\compressed_%%~nxf"
        if !errorlevel! equ 0 (
            echo   Success: compressed_%%~nxf
        ) else (
            echo   Failed: %%f
        )
    )
)

echo.
echo ========================================
echo Compression complete!
echo ========================================
echo.
echo Compressed videos saved to: Videos\compressed\
echo.
echo Next steps:
echo 1. Review the compressed videos
echo 2. Replace original videos with compressed versions
echo 3. Update your code to reference the new files
echo 4. Commit and push to Git LFS
echo.
pause
