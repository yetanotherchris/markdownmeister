# Generates the product icon asset set from a single programmatic source.
# Zero external dependencies (GDI+ via System.Drawing).
#
# The canonical editable artwork is assets/icon/master.svg. This script renders
# the identical geometry (tile gradient, rounded corners, "M" stroke skeleton)
# into the committed raster masters and every derived platform asset, so the
# whole set regenerates deterministically from one entrypoint:
#
#   pwsh -File scripts/generate-icon-master.ps1 [-RepoRoot <path>]
#
# Outputs (tracked in git; idempotent, safe to re-run):
#   assets/icon/master.png            1024x1024 RGBA master artwork (lossless PNG)
#   resources/icon.ico                multi-resolution Windows icon (PNG-encoded entries)
#   resources/icon.icns               macOS ic07/ic08/ic09/ic10 chunks (PNG-encoded)
#   resources/icon.png                512x512 convenience master for electron-builder
#   resources/icons/{16,24,32,48,64,128,256,512}.png
#
# NOTE: never output into build/ - it is gitignored in this repository.
param(
    [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$MasterSize = 1024
$LadderSizes = @(16, 24, 32, 48, 64, 128, 256, 512)
$IcoSizes = @(16, 24, 32, 48, 64, 128, 256)
$IcnsChunks = @(
    @{ Type = 'ic07'; Size = 128 },
    @{ Type = 'ic08'; Size = 256 },
    @{ Type = 'ic09'; Size = 512 },
    @{ Type = 'ic10'; Size = 1024 }
)

# Geometry constants mirrored 1:1 from assets/icon/master.svg (viewBox 0 0 1024 1024).
$TileInsetRatio = 0.085
$TileRadiusRatio = 0.225
$StrokeWidthRatio = 0.078
$MarkPoints = @(
    @{ X = 0.295; Y = 0.705 },
    @{ X = 0.295; Y = 0.335 },
    @{ X = 0.500; Y = 0.575 },
    @{ X = 0.705; Y = 0.335 },
    @{ X = 0.705; Y = 0.705 }
)
$TileTopColor = [System.Drawing.Color]::FromArgb(255, 38, 49, 78)     # #26314E
$TileBottomColor = [System.Drawing.Color]::FromArgb(255, 19, 26, 43)  # #131A2B
$MarkColor = [System.Drawing.Color]::FromArgb(255, 249, 250, 252)     # #F9FAFC

function New-RoundedRectPath {
    param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $R * 2
    $path.AddArc($X, $Y, $d, $d, 180, 90)
    $path.AddArc($X + $W - $d, $Y, $d, $d, 270, 90)
    $path.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90)
    $path.AddArc($X, $Y + $H - $d, $d, $d, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-MasterBitmap {
    param([int]$Size)

    $bmp = New-Object System.Drawing.Bitmap($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half

        $g.Clear([System.Drawing.Color]::Transparent)

        $inset = [math]::Round($Size * $TileInsetRatio)
        $tileW = $Size - ($inset * 2)
        $radius = [math]::Round($Size * $TileRadiusRatio)
        $tilePath = New-RoundedRectPath -X $inset -Y $inset -W $tileW -H $tileW -R $radius

        $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
            ([System.Drawing.PointF]::new(0, $inset)),
            ([System.Drawing.PointF]::new(0, $inset + $tileW)),
            $TileTopColor,
            $TileBottomColor
        )
        $g.FillPath($gradient, $tilePath)

        [System.Drawing.PointF[]]$points = $MarkPoints | ForEach-Object {
            [System.Drawing.PointF]::new($_.X * $Size, $_.Y * $Size)
        }
        $pen = New-Object System.Drawing.Pen($MarkColor, ($Size * $StrokeWidthRatio))
        $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
        $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
        $g.DrawLines($pen, $points)
        return $bmp
    }
    finally {
        $g.Dispose()
    }
}

function Resize-Master {
    param([System.Drawing.Bitmap]$Master, [int]$TargetSize)
    $resized = New-Object System.Drawing.Bitmap($TargetSize, $TargetSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
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
New-Item -ItemType Directory -Force -Path $assetsDir, $iconsDir | Out-Null

if (-not (Test-Path -LiteralPath (Join-Path $assetsDir 'master.svg'))) {
    throw "assets/icon/master.svg is missing; it is the canonical artwork source."
}

Write-Host "Rendering ${MasterSize}x${MasterSize} master..."
$master = New-MasterBitmap -Size $MasterSize
try {
    $masterPath = Join-Path $assetsDir 'master.png'
    Save-Png -Bmp $master -Path $masterPath
    Write-Host "  wrote assets\icon\master.png"

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

    Copy-Item -LiteralPath (Join-Path $iconsDir '512x512.png') -Destination (Join-Path $RepoRoot 'resources\icon.png') -Force
    Write-Host '  wrote resources\icon.png'

    Write-Ico -Path (Join-Path $RepoRoot 'resources\icon.ico') -PngBytesBySize $pngBytes
    Write-Host '  wrote resources\icon.ico'

    $icnsBytes = @{} + $pngBytes
    $icnsBytes[1024] = [System.IO.File]::ReadAllBytes($masterPath)
    Write-Icns -Path (Join-Path $RepoRoot 'resources\icon.icns') -PngBytesBySize $icnsBytes
    Write-Host '  wrote resources\icon.icns'
}
finally {
    $master.Dispose()
}

Write-Host 'Icon generation complete.'
