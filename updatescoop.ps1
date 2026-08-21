param(
    [Parameter(Mandatory = $true)]
    [string]$Version,

    [string]$ArtifactsDir = (Join-Path $PSScriptRoot "artifacts")
)

$ErrorActionPreference = 'Stop'

# The Windows portable zip published by the release workflow (electron-builder
# win/zip target). Scoop installs this archive via bin; the manifest's hash MUST
# match this exact file (FR-008). Asset names use the short `markdownmeister`
# prefix (spec 019).
$fileName = "markdownmeister-$Version-windows-x64.zip"
$zipPath = Join-Path $ArtifactsDir $fileName

if (-not (Test-Path -LiteralPath $zipPath)) {
    throw "Unable to locate $fileName at $zipPath"
}

$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLower()
Write-Host "SHA256 of ${fileName}: $hash"

# The release download URL is deterministic: v<version>/<artifact name>. The
# tag is the exact release tag (FR-003/FR-008). The `markdownmeister` prefix has
# no spaces, so no URL encoding is needed (spec 019).
$url = "https://github.com/yetanotherchris/markdownmeister/releases/download/v$Version/markdownmeister-$Version-windows-x64.zip"
$manifestPath = Join-Path $PSScriptRoot "markdownmeister.json"

if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Unable to locate Scoop manifest at $manifestPath"
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

# FR-007 (spec 034): the release rewrite must never silently drop the Start
# Menu shortcut declaration. Fail the release loudly instead of publishing a
# definition that lost it.
if (-not $manifest.shortcuts) {
    throw "Scoop manifest has no 'shortcuts' declaration; refusing to write a definition that lost the Start Menu shortcut (spec 034, FR-007)"
}

$manifest.version = $Version
$manifest.architecture."64bit".url = $url
$manifest.architecture."64bit".hash = $hash

$json = $manifest | ConvertTo-Json -Depth 10
# ConvertTo-Json emits no trailing newline; keep the committed file LF-terminated
# so a release commit never produces a cosmetic last-line diff (release review).
$content = $json + "`n"
[System.IO.File]::WriteAllText($manifestPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Updated $manifestPath to v$Version"
