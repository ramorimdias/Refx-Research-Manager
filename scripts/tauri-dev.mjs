import { spawnSync } from 'node:child_process'
import { createTauriQwenCspConfig } from './tauri-qwen-csp.mjs'

const repoRoot = process.cwd()
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
const env = { ...process.env }

const buildIcons = spawnSync(pnpmCommand, ['tauri:icons'], {
  cwd: repoRoot,
  env,
  stdio: 'inherit',
  shell: true,
})
if ((buildIcons.status ?? 1) !== 0) process.exit(buildIcons.status ?? 1)

const tauriConfigOverride = createTauriQwenCspConfig(repoRoot, env)
let tauriDev
try {
  tauriDev = spawnSync(pnpmCommand, ['exec', 'tauri', 'dev', '--config', tauriConfigOverride.path], {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
    shell: true,
  })
} finally {
  tauriConfigOverride.cleanup()
}

process.exit(tauriDev.status ?? 1)
