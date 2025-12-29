<#
Generate low-quality conversion commands for .glb models under frontend/Models.

This script will scan for .glb files and print recommended `npx` commands
using `@gltf-transform/cli` to produce `.low.glb` variants (Draco compression
and texture resize). It does NOT execute the conversion by default — to run
the commands, re-run the script with the `-Run` switch (careful: that will
execute `npx` commands and may install packages).

Prerequisites:
- Node.js (v16+ recommended) and npm available in PATH.

Example usage:
.
    # Print commands only
    .\generate_low_quality_commands.ps1

    # Print and run the conversions (will call npx for each file)
    .\generate_low_quality_commands.ps1 -Run

Notes:
- The generated commands use `npx @gltf-transform/cli` with a recommended
  Draco compression step. You may need to `npm install -g @gltf-transform/cli`
  or allow npx to install it on first run.
- Adjust texture max size or quantization parameters in the printed commands
  to tune quality vs size.
#>

param(
    [switch]$Run
)

Set-Location -Path (Split-Path -Parent $MyInvocation.MyCommand.Definition)

$modelsDir = "..\frontend\Models"
if (-not (Test-Path $modelsDir)) {
    Write-Error "Models directory not found: $modelsDir"
    exit 1
}

$glbFiles = Get-ChildItem -Path $modelsDir -Recurse -Include *.glb | Where-Object { -not $_.FullName.ToLower().EndsWith('.low.glb') -and -not $_.FullName.ToLower().EndsWith('.draco.glb') }
if ($glbFiles.Count -eq 0) {
    Write-Output "No .glb files found under $modelsDir"
    exit 0
}

Write-Output "Found $($glbFiles.Count) .glb files. Generating recommended commands...`n"

# Recommended pipeline (customize as needed):
# 1) Resize textures / re-encode (not included here — uses default draco settings)
# 2) Apply Draco compression with moderate quantization settings

foreach ($f in $glbFiles) {
    $in = $f.FullName
    $out = [System.IO.Path]::ChangeExtension($in, '.low.glb')

    # Use npx to run gltf-transform draco compression. You can tune quantize values.
    $cmd = "npx @gltf-transform/cli draco `"$in`" `"$out`" --quantizePosition=14 --quantizeNormal=10 --quantizeTexcoord=12"

    Write-Output $cmd

    if ($Run) {
        Write-Output "\nRunning: $cmd`n"
        try {
            iex $cmd
        } catch {
            Write-Warning "Command failed for $in : $_"
        }
    }
}

Write-Output "\nDone. Review the generated .low.glb files and commit them to your static host (if desired)."
