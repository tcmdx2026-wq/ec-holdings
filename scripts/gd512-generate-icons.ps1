# GĐ 512 (Agent Desktop) — Sinh bộ icon webapp EC-HOLDINGS từ LogoEC.jpg (PA-1 ĐH chốt)
# Khung cam viền trắng + chữ "EC" (crop bỏ dải chữ xanh dưới) → 10 size + apple-touch 180
# + favicon-64 + favicon.ico (PNG-in-ICO 32) + maskable 192/512 (nội dung 75% giữa, nền trắng).
# Chạy: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\gd512-generate-icons.ps1
$ErrorActionPreference = "Stop"
$roots = @('\\GIONGPC\DuLieuChung\CUONG_2026\ec-holdings', 'D:\DuLieuChung\CUONG_2026\ec-holdings')
$root = $roots | Where-Object { Test-Path (Join-Path $_ 'public\LogoEC.jpg') } | Select-Object -First 1
if (-not $root) { throw "Khong tim thay LogoEC.jpg (UNC + D:\ deu khong co)" }
$srcPath = Join-Path $root 'public\LogoEC.jpg'
$outDir  = Join-Path $root 'public\icons'

Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile($srcPath)
Write-Host ("Logo goc: {0}x{1}" -f $src.Width, $src.Height)

# ── 1) Crop: tìm đáy khung CAM (quét từ dưới lên, bỏ qua dải chữ XANH) ──
$bottom = $src.Height - 1
for ($y = $src.Height - 1; $y -ge [int]($src.Height * 0.5); $y--) {
  $rowHasOrange = $false
  for ($x = 0; $x -lt $src.Width; $x += 8) {
    $p = $src.GetPixel($x, $y)
    if ($p.R -gt 140 -and $p.G -lt 130 -and $p.B -lt 100) { $rowHasOrange = $true; break }
  }
  if ($rowHasOrange) { $bottom = $y; break }
}
$margin = [int]($src.Width * 0.015)
$rect = New-Object System.Drawing.Rectangle 0, 0, $src.Width, ([Math]::Min($bottom + $margin, $src.Height - 1))
Write-Host ("Crop khung cam: y 0..{0} (goc {1}x{2})" -f $rect.Height, $rect.Width, $rect.Height)

# Màu cam đại diện (đo vùng cam đặc phía trên chữ EC — tránh viền trắng) — để vẽ favicon.svg
$probe = $src.GetPixel([int]($src.Width * 0.5), [int]($rect.Height * 0.18))
$hex = "#{0:X2}{1:X2}{2:X2}" -f $probe.R, $probe.G, $probe.B
Write-Host ("Mau cam do duoc cho favicon.svg: " + $hex)

function New-SquareIcon([int]$size, [double]$contentScale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::White)
  # crop giữ tỷ lệ, fit vào contentScale*size (maskable: 0.75 để nằm trọn vòng tròn 80%)
  $fit = [Math]::Min($size * $contentScale / $rect.Width, $size * $contentScale / $rect.Height)
  $w = [int]($rect.Width * $fit); $h = [int]($rect.Height * $fit)
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle (($size - $w) / 2), (($size - $h) / 2), $w, $h), $rect, [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $bmp
}

$sizes = @(72, 96, 128, 144, 152, 192, 384, 512)
foreach ($s in $sizes) {
  $b = New-SquareIcon $s 0.92
  $b.Save((Join-Path $outDir "icon-$s.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose(); Write-Host "icon-$s.png OK"
}
# apple-touch 180 + favicon-64
$b = New-SquareIcon 180 0.92; $b.Save((Join-Path $outDir 'icon-180.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); Write-Host 'icon-180.png OK (apple-touch)'
$b = New-SquareIcon 64  0.92; $b.Save((Join-Path $root 'public\favicon-64.png'), [System.Drawing.Imaging.ImageFormat]::Png); $b.Dispose(); Write-Host 'favicon-64.png OK'

# maskable 192/512: nội dung 75% giữa, nền trắng full
foreach ($s in @(192, 512)) {
  $b = New-SquareIcon $s 0.75
  $b.Save((Join-Path $outDir "icon-$s-maskable.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $b.Dispose(); Write-Host "icon-$s-maskable.png OK"
}
# favicon.ico: ICONDIR + ICONDIRENTRY + PNG 32 (Windows Vista+ hỗ trợ PNG-in-ICO)
$b32 = New-SquareIcon 32 0.92
$ms = New-Object System.IO.MemoryStream
$b32.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $b32.Dispose()
$png = $ms.ToArray(); $ms.Dispose()
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)          # ICONDIR: 1 ảnh
$w.Write([byte]32); $w.Write([byte]32)                                 # w, h (32px)
$w.Write([byte]0); $w.Write([byte]0)                                   # colors, reserved
$w.Write([uint16]1); $w.Write([uint16]32)                              # planes, bitcount
$w.Write([uint32]$png.Length); $w.Write([uint32]22)                    # size, offset
$w.Write($png); $w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $root 'public\favicon.ico'), $ico.ToArray())
$w.Dispose(); $ico.Dispose(); Write-Host 'favicon.ico OK (PNG 32)'
$src.Dispose()
Write-Host 'DONE — toan bo icon sinh xong'
