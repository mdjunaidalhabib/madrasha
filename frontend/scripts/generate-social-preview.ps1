# Regenerate the static social card on Windows; no runtime dependencies.
# Run from any directory: powershell -File frontend/scripts/generate-social-preview.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$image = New-Object System.Drawing.Bitmap 1200, 630
$canvas = [System.Drawing.Graphics]::FromImage($image)
$canvas.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$canvas.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

function Fill-Box($color, $x, $y, $width, $height) {
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
    try { $canvas.FillRectangle($brush, $x, $y, $width, $height) } finally { $brush.Dispose() }
}
function Fill-Round($color, $x, $y, $width, $height, $radius = 16) {
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc(($x + $width - $diameter), $y, $diameter, $diameter, 270, 90)
    $path.AddArc(($x + $width - $diameter), ($y + $height - $diameter), $diameter, $diameter, 0, 90)
    $path.AddArc($x, ($y + $height - $diameter), $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
    try { $canvas.FillPath($brush, $path) } finally { $brush.Dispose(); $path.Dispose() }
}
function Draw-Text($value, $size, $color, $x, $y, $bold = $false) {
    $style = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $font = New-Object System.Drawing.Font 'Segoe UI', $size, $style, ([System.Drawing.GraphicsUnit]::Pixel)
    $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml($color))
    try { $canvas.DrawString($value, $font, $brush, [single]$x, [single]$y) } finally { $font.Dispose(); $brush.Dispose() }
}

try {
    Fill-Box '#0B1F2A' 0 0 1200 630
    Fill-Box '#10B981' 0 0 1200 8
    Fill-Round '#102F39' 710 62 444 510 48
    Fill-Round '#153B43' 1040 490 160 160 60

    Fill-Round '#173B42' 64 52 204 40 20
    Draw-Text 'A product of Hikmah IT' 17 '#A7F3D0' 80 60
    Draw-Text 'EMS' 104 '#FFFFFF' 56 101 $true
    Draw-Text 'Education Management System' 25 '#5EE4B1' 65 224 $true
    Draw-Text 'Run your institution.' 40 '#FFFFFF' 61 288 $true
    Draw-Text 'Simplify every day.' 40 '#FFFFFF' 61 339 $true
    Draw-Text 'Madrasa / School / College / Kindergarten' 21 '#B3C9D1' 65 414

    Fill-Box '#29434C' 65 488 568 1
    Draw-Text 'ONE PLATFORM. EVERY ESSENTIAL.' 15 '#7EDBB8' 65 512 $true
    Draw-Text 'qms.hikmahit.com' 23 '#FFFFFF' 65 541 $true

    # A schematic interface communicates the product without invented statistics.
    Fill-Round '#07191F' 747 104 372 394 22
    Fill-Round '#F3F8F7' 737 94 372 394 22
    Fill-Round '#FFFFFF' 751 108 344 60 12
    Fill-Round '#059669' 767 120 38 36 9
    Draw-Text 'E' 24 '#FFFFFF' 777 120 $true
    Draw-Text 'EMS Workspace' 20 '#16353F' 817 118 $true
    Draw-Text 'Everything in one place' 13 '#65818A' 818 144

    Fill-Round '#DEF5EA' 757 187 328 67 12
    Draw-Text 'Your institution, connected.' 20 '#076348' 773 198 $true
    Draw-Text 'From admission to achievement' 15 '#327A65' 773 226

    $tiles = @(
        @{ Label = 'Admission'; Detail = 'A simpler start'; X = 757; Y = 270; Accent = '#059669' },
        @{ Label = 'Attendance'; Detail = 'Every day counts'; X = 927; Y = 270; Accent = '#0891B2' },
        @{ Label = 'Results'; Detail = 'Progress made clear'; X = 757; Y = 370; Accent = '#6366F1' },
        @{ Label = 'Accounts'; Detail = 'Stay in control'; X = 927; Y = 370; Accent = '#D97706' }
    )
    foreach ($tile in $tiles) {
        Fill-Round '#FFFFFF' $tile.X $tile.Y 158 87 12
        Fill-Round $tile.Accent ($tile.X + 14) ($tile.Y + 14) 26 5 2
        Draw-Text $tile.Label 18 '#16353F' ($tile.X + 12) ($tile.Y + 28) $true
        Draw-Text $tile.Detail 12 '#65818A' ($tile.X + 12) ($tile.Y + 57)
    }
    Fill-Round '#059669' 799 509 270 42 21
    Draw-Text 'SMARTER EDUCATION, TOGETHER' 13 '#FFFFFF' 818 520 $true

    $output = Join-Path $PSScriptRoot '../public/images/ems-social-preview-v1.png'
    $image.Save([System.IO.Path]::GetFullPath($output), [System.Drawing.Imaging.ImageFormat]::Png)
} finally {
    $canvas.Dispose()
    $image.Dispose()
}
