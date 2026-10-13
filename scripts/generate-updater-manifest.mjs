import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

const repoRoot = process.cwd()
const tauriConfigPath = resolve(repoRoot, 'src-tauri', 'tauri.conf.json')
const bundleDir = resolve(repoRoot, 'src-tauri', 'target', 'release', 'bundle')

function normalizeRepoReleaseBase(endpoint, version) {
  const match = endpoint.match(/^(https:\/\/github\.com\/[^/]+\/[^/]+)\/releases\/latest\/download\/latest\.json$/)
  if (!match) {
    throw new Error(`Unsupported updater endpoint format: ${endpoint}`)
  }

  return `${match[1]}/releases/download/v${version}`
}

function findWindowsArtifact(bundleType, productName, version, extension) {
  const bundleTypeDir = join(bundleDir, bundleType)
  if (!existsSync(bundleTypeDir)) {
    throw new Error(`Bundle directory not found: ${bundleTypeDir}`)
  }

  const prefix = `${productName}_${version}_`
  const installer = readdirSync(bundleTypeDir).find((file) => file.startsWith(prefix) && file.endsWith(extension))
  if (!installer) {
    throw new Error(`No ${bundleType.toUpperCase()} installer found for ${productName} ${version}`)
  }

  const signatureFile = `${installer}.sig`
  const signaturePath = join(bundleTypeDir, signatureFile)
  if (!existsSync(signaturePath)) {
    throw new Error(`Missing updater signature for ${installer}`)
  }

  return {
    installer,
    installerPath: join(bundleTypeDir, installer),
    signature: readFileSync(signaturePath, 'utf8').trim(),
  }
}

const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'))
const productName = tauriConfig.productName
const version = tauriConfig.version
const endpoint = tauriConfig.plugins?.updater?.endpoints?.[0]

if (!productName || !version || !endpoint) {
  throw new Error('Missing productName, version, or updater endpoint in tauri.conf.json')
}

const msiArtifact = findWindowsArtifact('msi', productName, version, '.msi')
const nsisArtifact = findWindowsArtifact('nsis', productName, version, '.exe')
const releaseBase = normalizeRepoReleaseBase(endpoint, version)

const manifest = {
  version,
  notes: `Refx ${version} is available.`,
  pub_date: new Date().toISOString(),
  platforms: {
    // Keep the legacy key pointed at MSI for builds that predate bundle-type selection.
    'windows-x86_64': {
      signature: msiArtifact.signature,
      url: `${releaseBase}/${encodeURIComponent(basename(msiArtifact.installerPath))}`,
    },
    'windows-x86_64-msi': {
      signature: msiArtifact.signature,
      url: `${releaseBase}/${encodeURIComponent(basename(msiArtifact.installerPath))}`,
    },
    'windows-x86_64-nsis': {
      signature: nsisArtifact.signature,
      url: `${releaseBase}/${encodeURIComponent(basename(nsisArtifact.installerPath))}`,
    },
  },
}

const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`
const manifestTargets = [
  join(bundleDir, 'latest.json'),
  join(dirname(msiArtifact.installerPath), 'latest.json'),
]

for (const target of manifestTargets) {
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, manifestJson)
}

console.log(`Generated updater manifest:`)
for (const target of manifestTargets) {
  console.log(`- ${target}`)
}
