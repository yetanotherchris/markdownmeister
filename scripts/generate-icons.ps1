# Derives the product icon asset set from the committed master artwork.
# Zero external dependencies (GDI+ via System.Drawing).
#
# The master is assets/icon/master.png: the maintainer-approved artwork,
# committed verbatim at its native size. This script never writes it; it
# only produces the derived raster set below.
#
#   pwsh -File scripts/generate-icons.ps1 [-RepoRoot <path>]
#
# Outputs (tracked in git; idempotent, safe to re-run):
#   resources/icon.ico                multi-resolution Windows icon (PNG-encoded entries)
#   resources/icon.icns               macOS ic07/ic08/ic09/ic10 chunks (PNG-encoded)
#   resources/icon.png                512x512 convenience master for electron-builder
#   resources/icons/{16,20,24,32,40,48,64,96,128,256,512}.png
#   resources/appx/StoreLogo.png       50x50  Windows Store package logo
#   resources/appx/Square44x44Logo.png 44x44  small tile
#   resources/appx/Square150x150Logo.png 150x150 medium tile
#   resources/appx/LargeTile.png       310x310 large tile
#   resources/appx/SmallTile.png       71x71  small tile
#   resources/appx/Wide310x150Logo.png 310x150 wide tile (mark centred on transparent canvas)
#
# The resources/appx files are named exactly as app-builder-lib's AppxTarget
# expects. When one is missing it substitutes a generic SampleAppx image, which
# is what Store certification rejects (spec 067). electron-builder.yml points
# directories.buildResources at resources/ so the appx target finds appx/.
#
# Do not write generated icons to build/, which is ignored by Git.
param(
    [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

# The ladder and the ICO frame list share every size below 512 so each ICO
# payload stays a byte copy of its committed ladder file. The intermediates
# (20, 40, 96) exist because Windows shells request those exact sizes at
# fractional display scales and in Explorer's large-icons view.
$LadderSizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256, 512)
$IcoSizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)
$IcnsChunks = @(
    @{ Type = 'ic07'; Size = 128 },
    @{ Type = 'ic08'; Size = 256 },
    @{ Type = 'ic09'; Size = 512 },
    @{ Type = 'ic10'; Size = 1024 }
)

# Windows Store appx tile assets. The names are fixed by app-builder-lib's
# AppxTarget; a missing file makes it substitute a generic SampleAppx image,
# which Store certification rejects (spec 067).
$AppxSquareTiles = @(
    @{ Name = 'StoreLogo.png'; Size = 50 },
    @{ Name = 'Square44x44Logo.png'; Size = 44 },
    @{ Name = 'Square150x150Logo.png'; Size = 150 },
    @{ Name = 'LargeTile.png'; Size = 310 },
    @{ Name = 'SmallTile.png'; Size = 71 }
)
# The wide tile is a composition, not a downscale: the square mark is scaled to
# a safe area and centred on a transparent canvas so Windows composites it over
# the tile background colour (appx.backgroundColor) without distortion.
$WideTile = @{ Name = 'Wide310x150Logo.png'; Width = 310; Height = 150; Padding = 20 }

# The master must satisfy the committed contract before anything derives
# from it: square, at least 1024x1024, 8-bit-per-channel truecolour with
# alpha. Parsed from the raw bytes so the check cannot be fooled by a
# decoder's pixel-format normalisation.
function Read-PngUInt32BigEndian {
    # PNG multi-byte header fields are big-endian.
    param([byte[]]$Bytes, [int]$Offset)
    $b0 = [uint32]$Bytes[$Offset]
    $b1 = [uint32]$Bytes[$Offset + 1]
    $b2 = [uint32]$Bytes[$Offset + 2]
    $b3 = [uint32]$Bytes[$Offset + 3]
    return ($b0 -shl 24) -bor ($b1 -shl 16) -bor ($b2 -shl 8) -bor $b3
}

function Assert-MasterPng {
    param([string]$Path)
    $bytes = [System.IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 26) { throw "$Path is too short to contain a PNG header" }
    $signature = [byte[]](0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A)
    for ($i = 0; $i -lt 8; $i++) {
        if ($bytes[$i] -ne $signature[$i]) { throw "$Path is not a PNG file" }
    }
    if ([System.Text.Encoding]::ASCII.GetString($bytes, 12, 4) -ne 'IHDR') {
        throw "$Path has no leading IHDR chunk"
    }
    $width = Read-PngUInt32BigEndian -Bytes $bytes -Offset 16
    $height = Read-PngUInt32BigEndian -Bytes $bytes -Offset 20
    $bitDepth = $bytes[24]
    $colourType = $bytes[25]
    if ($width -ne $height) { throw "$Path must be square (got ${width}x${height})" }
    if ($width -lt 1024) { throw "$Path must be at least 1024x1024 (got ${width}x${height})" }
    if ($bitDepth -ne 8 -or $colourType -ne 6) {
        throw "$Path must be 8-bit RGBA (got bitDepth=$bitDepth colourType=$colourType)"
    }
}

function Resize-Master {
    param([System.Drawing.Bitmap]$Master, [int]$TargetSize)
    $pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    $resized = New-Object System.Drawing.Bitmap($TargetSize, $TargetSize, $pixelFormat)
    $g = [System.Drawing.Graphics]::FromImage($resized)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $g.DrawImage($Master, 0, 0, $TargetSize, $TargetSize)
        return $resized
    }
    finally {
        $g.Dispose()
    }
}

function Save-Png {
    param([System.Drawing.Bitmap]$Bmp, [string]$Path)
    $dir = Split-Path -Parent $Path
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $Bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Save-WideTile {
    # Compose the non-square wide tile: the square master scaled to fit a safe
    # area and centred on a transparent canvas. Stretching the master would
    # distort the mark, which spec 067 forbids.
    param([System.Drawing.Bitmap]$Master, [string]$Path, [int]$Width, [int]$Height, [int]$Padding)
    $bmp = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $g.Clear([System.Drawing.Color]::Transparent)
        $mark = [Math]::Min($Width - (2 * $Padding), $Height - (2 * $Padding))
        $x = [int](($Width - $mark) / 2)
        $y = [int](($Height - $mark) / 2)
        $g.DrawImage($Master, $x, $y, $mark, $mark)
        Save-Png -Bmp $bmp -Path $Path
    }
    finally {
        $g.Dispose()
        $bmp.Dispose()
    }
}

function Get-PngBytes {
    # Encode a bitmap to PNG bytes in memory (no file side effect).
    param([System.Drawing.Bitmap]$Bmp)
    $ms = New-Object System.IO.MemoryStream
    try {
        $Bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        return $ms.ToArray()
    }
    finally {
        $ms.Dispose()
    }
}

function Write-Ico {
    param([string]$Path, [hashtable]$PngBytesBySize)
    $ms = New-Object System.IO.MemoryStream
    $bw = New-Object System.IO.BinaryWriter($ms)
    try {
        $count = $IcoSizes.Count
        $bw.Write([uint16]0)      # reserved
        $bw.Write([uint16]1)      # type: icon
        $bw.Write([uint16]$count) # image count
        $offset = 6 + (16 * $count)
        foreach ($size in $IcoSizes) {
            $bytes = $PngBytesBySize[$size]
            $dim = if ($size -ge 256) { [byte]0 } else { [byte]$size }
            $bw.Write($dim)          # width (0 = 256)
            $bw.Write($dim)          # height (0 = 256)
            $bw.Write([byte]0)       # palette count
            $bw.Write([byte]0)       # reserved
            $bw.Write([uint16]1)     # color planes
            $bw.Write([uint16]32)    # bits per pixel
            $bw.Write([uint32]$bytes.Length)
            $bw.Write([uint32]$offset)
            $offset += $bytes.Length
        }
        foreach ($size in $IcoSizes) {
            $bw.Write($PngBytesBySize[$size])
        }
        [System.IO.File]::WriteAllBytes($Path, $ms.ToArray())
    }
    finally {
        $bw.Dispose()
        $ms.Dispose()
    }
}

function Write-Icns {
    param([string]$Path, [hashtable]$PngBytesBySize)
    $chunks = New-Object System.Collections.Generic.List[byte[]]
    $total = 8
    foreach ($chunk in $IcnsChunks) {
        $png = $PngBytesBySize[[int]$chunk.Size]
        $chunkLen = 8 + $png.Length
        $header = [System.Text.Encoding]::ASCII.GetBytes($chunk.Type)
        $lenBytes = [BitConverter]::GetBytes([uint32]$chunkLen)
        [array]::Reverse($lenBytes)
        $body = New-Object byte[] $chunkLen
        [Array]::Copy($header, 0, $body, 0, 4)
        [Array]::Copy($lenBytes, 0, $body, 4, 4)
        [Array]::Copy($png, 0, $body, 8, $png.Length)
        $chunks.Add($body)
        $total += $chunkLen
    }
    $magic = [System.Text.Encoding]::ASCII.GetBytes('icns')
    $totalBytes = [BitConverter]::GetBytes([uint32]$total)
    [array]::Reverse($totalBytes)
    $out = New-Object System.Collections.Generic.List[byte]
    $out.AddRange($magic)
    $out.AddRange($totalBytes)
    foreach ($body in $chunks) { $out.AddRange($body) }
    [System.IO.File]::WriteAllBytes($Path, $out.ToArray())
}

# --- main ---

$assetsDir = Join-Path $RepoRoot 'assets\icon'
$iconsDir = Join-Path $RepoRoot 'resources\icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

$masterPath = Join-Path $assetsDir 'master.png'
if (-not (Test-Path -LiteralPath $masterPath)) {
    throw "assets/icon/master.png is missing; it is the canonical artwork source."
}
Assert-MasterPng -Path $masterPath

$master = New-Object System.Drawing.Bitmap($masterPath)
try {
    $pngBytes = @{}
    foreach ($size in $LadderSizes) {
        $resized = Resize-Master -Master $master -TargetSize $size
        try {
            $path = Join-Path $iconsDir "${size}x${size}.png"
            Save-Png -Bmp $resized -Path $path
            $pngBytes[$size] = [System.IO.File]::ReadAllBytes($path)
            Write-Host "  wrote resources\icons\${size}x${size}.png"
        }
        finally {
            $resized.Dispose()
        }
    }

    $ladder512 = Join-Path $iconsDir '512x512.png'
    Copy-Item -LiteralPath $ladder512 -Destination (Join-Path $RepoRoot 'resources\icon.png') -Force
    Write-Host '  wrote resources\icon.png'

    Write-Ico -Path (Join-Path $RepoRoot 'resources\icon.ico') -PngBytesBySize $pngBytes
    Write-Host '  wrote resources\icon.ico'

    $icnsBytes = @{} + $pngBytes
    $icns1024 = Resize-Master -Master $master -TargetSize 1024
    try {
        $icnsBytes[1024] = Get-PngBytes -Bmp $icns1024
    }
    finally {
        $icns1024.Dispose()
    }
    Write-Icns -Path (Join-Path $RepoRoot 'resources\icon.icns') -PngBytesBySize $icnsBytes
    Write-Host '  wrote resources\icon.icns'

    $appxDir = Join-Path $RepoRoot 'resources\appx'
    New-Item -ItemType Directory -Force -Path $appxDir | Out-Null
    foreach ($tile in $AppxSquareTiles) {
        $resized = Resize-Master -Master $master -TargetSize $tile.Size
        try {
            Save-Png -Bmp $resized -Path (Join-Path $appxDir $tile.Name)
            Write-Host "  wrote resources\appx\$($tile.Name)"
        }
        finally {
            $resized.Dispose()
        }
    }
    Save-WideTile -Master $master -Path (Join-Path $appxDir $WideTile.Name) `
        -Width $WideTile.Width -Height $WideTile.Height -Padding $WideTile.Padding
    Write-Host "  wrote resources\appx\$($WideTile.Name)"
}
finally {
    $master.Dispose()
}

Write-Host 'Icon generation complete.'
