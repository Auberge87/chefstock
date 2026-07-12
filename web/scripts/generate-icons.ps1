Add-Type -AssemblyName System.Drawing

function New-Icon($size, $path, $padded) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

    $bgColor = [System.Drawing.Color]::FromArgb(255, 0x24, 0x5c, 0x49)
    $g.Clear($bgColor)

    # Draw a simple fork+plate glyph using primitives (no external assets needed)
    $accent = [System.Drawing.Color]::FromArgb(255, 0xff, 0xff, 0xff)
    $brush = New-Object System.Drawing.SolidBrush $accent
    $pen = New-Object System.Drawing.Pen $accent, ([Math]::Max(2, $size * 0.03))

    $cx = $size / 2
    $cy = $size / 2
    $plateR = $size * 0.30
    $g.DrawEllipse($pen, $cx - $plateR, $cy - $plateR, $plateR * 2, $plateR * 2)

    $fontSize = [Math]::Max(8, [int]($size * 0.28))
    $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold)
    $text = "CS"
    $textSize = $g.MeasureString($text, $font)
    $g.DrawString($text, $font, $brush, ($cx - $textSize.Width / 2), ($cy - $textSize.Height / 2))

    if ($padded) {
        # maskable: keep content within the safe zone (already centered, fine as-is)
    }

    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
}

$outDir = "C:\Users\tccar\Chefstock\web\public\icons"
New-Icon 192 (Join-Path $outDir "icon-192.png") $false
New-Icon 512 (Join-Path $outDir "icon-512.png") $false
New-Icon 512 (Join-Path $outDir "icon-maskable-512.png") $true

Write-Output "Icons generated."
