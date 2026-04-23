param(
  [string]$CatalogPath = "$env:USERPROFILE\Documents\RefxWordAddinCatalog",
  [string]$ShareName = "RefxWordAddinCatalog",
  [string]$ManifestPath = "$PSScriptRoot\..\manifest.xml"
)

$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Escape-RegistryPath {
  param([string]$Value)
  return $Value.Replace("\", "\\")
}

$resolvedManifest = Resolve-Path -LiteralPath $ManifestPath
$resolvedCatalog = [System.IO.Path]::GetFullPath($CatalogPath)
$targetManifest = Join-Path $resolvedCatalog "refx-word-addin.xml"
$catalogUrl = "\\localhost\$ShareName"

Write-Step "Preparing Word add-in catalog folder"
New-Item -ItemType Directory -Force -Path $resolvedCatalog | Out-Null
Copy-Item -LiteralPath $resolvedManifest -Destination $targetManifest -Force
Write-Host "Copied manifest to $targetManifest"

$shareReady = $false
try {
  $existingShare = Get-SmbShare -Name $ShareName -ErrorAction SilentlyContinue
  if ($existingShare) {
    $shareReady = $true
    Write-Host "SMB share already exists: $catalogUrl"
  } else {
    Write-Step "Creating local SMB share"
    New-SmbShare -Name $ShareName -Path $resolvedCatalog -ChangeAccess $env:USERNAME | Out-Null
    $shareReady = $true
    Write-Host "Created SMB share: $catalogUrl"
  }
} catch {
  Write-Warning "Could not create the SMB share automatically. This usually means PowerShell is not running as Administrator."
  Write-Host ""
  Write-Host "Manual fallback:"
  Write-Host "1. Right-click this folder in File Explorer: $resolvedCatalog"
  Write-Host "2. Open Properties > Sharing > Share."
  Write-Host "3. Share it with your Windows user."
  Write-Host "4. Use this network path as the catalog URL: $catalogUrl"
  Write-Host ""
}

Write-Step "Registering trusted Office add-in catalog"
$catalogGuid = "{" + [guid]::NewGuid().ToString() + "}"
$registryPath = "HKCU:\Software\Microsoft\Office\16.0\WEF\TrustedCatalogs\$catalogGuid"
New-Item -Path $registryPath -Force | Out-Null
New-ItemProperty -Path $registryPath -Name "Id" -Value $catalogGuid -PropertyType String -Force | Out-Null
New-ItemProperty -Path $registryPath -Name "Url" -Value $catalogUrl -PropertyType String -Force | Out-Null
New-ItemProperty -Path $registryPath -Name "Flags" -Value 1 -PropertyType DWord -Force | Out-Null

Write-Host ""
Write-Host "Trusted catalog registered:"
Write-Host "  Registry: $registryPath"
Write-Host "  Url:      $catalogUrl"
Write-Host "  Manifest: $targetManifest"
Write-Host ""

if (-not $shareReady) {
  Write-Warning "Finish the manual sharing steps above before opening Word."
}

Write-Host "Next steps:"
Write-Host "1. Close all Word windows."
Write-Host "2. Start the add-in dev server: pnpm --dir word-addin dev"
Write-Host "3. Open Word desktop."
Write-Host "4. Go to Home > Add-ins > Advanced > Shared Folder."
Write-Host "5. Choose Refx."
Write-Host ""
Write-Host "If Word still caches the old catalog, clear Office cache or change the ShareName parameter and run this script again."
