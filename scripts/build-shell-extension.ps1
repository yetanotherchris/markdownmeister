param(
  [ValidateSet('Debug', 'Release')][string]$Configuration = 'Release',
  [ValidateSet('x64', 'arm64')][string]$Arch = 'x64'
)

$ErrorActionPreference = 'Stop'

function Fail([string]$message) {
  Write-Error @"
build-shell-extension: $message

Building the shell extension requires:
  - Visual Studio 2022 with the 'Desktop development with C++' workload
  - Windows 11 SDK (10.0.22621 or newer)
Install them via the Visual Studio Installer, then re-run this script.
The Microsoft Store workflow (.github/workflows/build-store.yml) provides these on windows-latest.
"@
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path -LiteralPath $vswhere)) {
  Fail 'vswhere.exe was not found (no Visual Studio installer detected).'
  exit 1
}

$vsPath = & $vswhere -latest -products * `
  -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
  -requires Microsoft.VisualStudio.Component.Windows11SDK.22621 `
  -property installationPath
if (-not $vsPath) {
  # Fall back to any Windows SDK component so newer SDK versions also match.
  $vsPath = & $vswhere -latest -products * `
    -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 `
    -property installationPath
}
if (-not $vsPath) {
  Fail 'Visual Studio 2022 with MSVC v143 and a Windows 11 SDK was not found.'
  exit 1
}
Write-Host "Using Visual Studio at: $vsPath"

# --- locate CMake ------------------------------------------------------------
$cmakeCandidates = @(
  (Join-Path $vsPath 'Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe'),
  (Get-Command cmake.exe -ErrorAction SilentlyContinue)?.Source
) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
if (-not $cmakeCandidates) {
  Fail 'CMake was not found (neither the Visual Studio-bundled copy nor one on PATH).'
  exit 1
}
$cmake = @($cmakeCandidates)[0]

# --- confirm a Windows 11 SDK is installed -----------------------------------
# The regex matches SDK folders 10.0.22621.* and newer (build numbers starting
# 222xx-229xx, plus every later series up to 99xxx); older Windows 11 SDKs
# such as 10.0.22000 do not meet the documented minimum.
$sdkRoots = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\Include' -Directory `
  -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -match '^10\.0\.2(2[2-9]|[3-9][0-9])[0-9]{2}\.' }
if (-not $sdkRoots) {
  Fail 'No Windows 11 SDK (10.0.22621+) was found under the Windows Kits directory.'
  exit 1
}
Write-Host "Windows SDK found: $($sdkRoots[-1].Name)"

# --- configure and build ------------------------------------------------------
$sourceDir = Join-Path $PSScriptRoot '..\native\shell-extension'
$buildDir = Join-Path $sourceDir "out\$Arch"
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

& $cmake -S $sourceDir -B $buildDir -A $Arch
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

& $cmake --build $buildDir --config $Configuration
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$dll = Join-Path $buildDir "$Configuration\MarkdownMeisterShellExtension.dll"
if (-not (Test-Path -LiteralPath $dll)) {
  Fail "Build reported success but the DLL is missing: $dll"
  exit 1
}
Write-Host "Shell extension built: $dll"
