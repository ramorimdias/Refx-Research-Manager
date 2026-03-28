import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = process.cwd()
const packageJsonPath = join(repoRoot, 'package.json')
const tauriConfigPath = join(repoRoot, 'src-tauri', 'tauri.conf.json')

const nextVersion = process.argv[2]?.trim()

if (!nextVersion) {
  console.error('Usage: pnpm release <version>')
  process.exit(1)
}

const semverPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/

if (!semverPattern.test(nextVersion)) {
  console.error(`Invalid version "${nextVersion}". Use semver like 0.1.1 or 1.0.0-beta.1`)
  process.exit(1)
}

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'))

const currentPackageVersion = packageJson.version
const currentTauriVersion = tauriConfig.version

packageJson.version = nextVersion
tauriConfig.version = nextVersion

writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`)
writeFileSync(tauriConfigPath, `${JSON.stringify(tauriConfig, null, 2)}\n`)

console.log(`Updated REFX version to ${nextVersion}`)
console.log(`- package.json: ${currentPackageVersion} -> ${packageJson.version}`)
console.log(`- src-tauri/tauri.conf.json: ${currentTauriVersion} -> ${tauriConfig.version}`)
console.log('')
console.log('Next steps:')
console.log('1. pnpm tauri:build')
console.log('2. git add package.json src-tauri/tauri.conf.json')
console.log(`3. git commit -m "Release v${nextVersion}"`)
console.log(`4. git tag v${nextVersion}`)
console.log('5. git push origin main --tags')
