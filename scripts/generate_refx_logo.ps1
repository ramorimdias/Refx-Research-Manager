Add-Type -AssemblyName System.Drawing

function New-RoundedRectPath($x, $y, $w, $h, $r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function Draw-RefxLogo($graphics, $size) {
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $bg = [System.Drawing.ColorTranslator]::FromHtml('#24383B')
  $fg = [System.Drawing.ColorTranslator]::FromHtml('#F7F4ED')
  $teal = [System.Drawing.ColorTranslator]::FromHtml('#28D1B5')
  $teal2 = [System.Drawing.ColorTranslator]::FromHtml('#35D7B0')

  $path = New-RoundedRectPath 0 0 $size $size ([int]($size * 0.12))
  $bgBrush = New-Object System.Drawing.SolidBrush($bg)
  $fgBrush = New-Object System.Drawing.SolidBrush($fg)
  $graphics.FillPath($bgBrush, $path)

  $fontSize = $size * 0.31
  $font = New-Object System.Drawing.Font('Segoe UI', $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textRect = New-Object System.Drawing.RectangleF([float]0, [float]($size * 0.08), [float]$size, [float]($size * 0.30))
  $graphics.DrawString('Refx', $font, $fgBrush, $textRect, $format)

  $cx = $size * 0.5
  $cy = $size * 0.62
  $nodeR = $size * 0.07
  $centerR = $size * 0.04
  $arm = $size * 0.19
  $pen = New-Object System.Drawing.Pen($teal, ($size * 0.028))
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $points = @(
    @{ X = $cx - $arm; Y = $cy - $arm * 0.92 },
    @{ X = $cx + $arm; Y = $cy - $arm * 0.92 },
    @{ X = $cx - $arm; Y = $cy + $arm * 0.92 },
    @{ X = $cx + $arm; Y = $cy + $arm * 0.92 }
  )

  foreach ($point in $points) {
    $graphics.DrawLine($pen, $cx, $cy, $point.X, $point.Y)
  }

  $gradientRect = New-Object System.Drawing.Rectangle(0, 0, $size, $size)
  $gradientBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($gradientRect, $teal, $teal2, 45)

  foreach ($point in $points) {
    $graphics.FillEllipse($gradientBrush, $point.X - $nodeR, $point.Y - $nodeR, $nodeR * 2, $nodeR * 2)
  }

  $graphics.FillEllipse($gradientBrush, $cx - $centerR, $cy - $centerR, $centerR * 2, $centerR * 2)

  $gradientBrush.Dispose()
  $pen.Dispose()
  $font.Dispose()
  $format.Dispose()
  $bgBrush.Dispose()
  $fgBrush.Dispose()
  $path.Dispose()
}

function Save-Png($path, $size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-RefxLogo $graphics $size
  $graphics.Dispose()
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

function Save-Ico($path, $size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  Draw-RefxLogo $graphics $size
  $graphics.Dispose()
  $icon = [System.Drawing.Icon]::FromHandle($bitmap.GetHicon())
  $stream = [System.IO.File]::Create($path)
  $icon.Save($stream)
  $stream.Dispose()
  $icon.Dispose()
  $bitmap.Dispose()
}

$svg = @'
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="112" y1="160" x2="400" y2="416" gradientUnits="userSpaceOnUse">
      <stop stop-color="#28D1B5"/>
      <stop offset="1" stop-color="#35D7B0"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="#24383B"/>
  <text x="256" y="160" text-anchor="middle" fill="#F7F4ED" font-family="Segoe UI, Arial, sans-serif" font-size="128" font-weight="700">Refx</text>
  <g stroke="url(#g)" stroke-width="14" stroke-linecap="round">
    <line x1="256" y1="314" x2="145" y2="211"/>
    <line x1="256" y1="314" x2="367" y2="211"/>
    <line x1="256" y1="314" x2="145" y2="417"/>
    <line x1="256" y1="314" x2="367" y2="417"/>
  </g>
  <g fill="url(#g)">
    <circle cx="145" cy="211" r="35"/>
    <circle cx="367" cy="211" r="35"/>
    <circle cx="145" cy="417" r="35"/>
    <circle cx="367" cy="417" r="35"/>
    <circle cx="256" cy="314" r="21"/>
  </g>
</svg>
'@

Set-Content -Path 'public/icon.svg' -Value $svg -Encoding utf8
Save-Png 'public/icon-light-32x32.png' 32
Save-Png 'public/icon-dark-32x32.png' 32
Save-Png 'public/apple-icon.png' 180
Save-Png 'src-tauri/icons/32x32.png' 32
Save-Png 'src-tauri/icons/128x128.png' 128
Save-Png 'src-tauri/icons/128x128@2x.png' 256
Save-Ico 'src-tauri/icons/icon.ico' 256
