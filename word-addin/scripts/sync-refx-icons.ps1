param(
  [string]$SourceIcon = "$PSScriptRoot\..\..\public\iconHD.png",
  [string]$OutputDir = "$PSScriptRoot\..\public\assets"
)

$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$resolvedSource = Resolve-Path -LiteralPath $SourceIcon
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$source = [System.Drawing.Image]::FromFile($resolvedSource)
try {
  foreach ($size in @(16, 32, 64, 80)) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    try {
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($source, 0, 0, $size, $size)
        $bitmap.Save((Join-Path $resolvedOutput "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $graphics.Dispose()
      }
    } finally {
      $bitmap.Dispose()
    }
  }
} finally {
  $source.Dispose()
}

Write-Host "Synced Refx icons into $resolvedOutput"
