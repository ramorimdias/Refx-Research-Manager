import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

const DEFAULT_DEV_PROXY_URL = 'http://localhost:3001'

function readLocalProxyUrl(repoRoot) {
  const envPath = resolve(repoRoot, '.env.local')
  if (!existsSync(envPath)) return ''

  const line = readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .find((entry) => /^\s*(?:export\s+)?NEXT_PUBLIC_QWEN_PROXY_URL\s*=/.test(entry))
  if (!line) return ''

  const value = line.replace(/^\s*(?:export\s+)?NEXT_PUBLIC_QWEN_PROXY_URL\s*=\s*/, '').trim()
  return value.replace(/^(["'])(.*)\1$/, '$2').trim()
}

export function createTauriQwenCspConfig(repoRoot, env = process.env, options = {}) {
  const configuredProxyUrl = env.NEXT_PUBLIC_QWEN_PROXY_URL?.trim() || readLocalProxyUrl(repoRoot)
  const proxyUrl = configuredProxyUrl || (options.requireProxyUrl ? '' : DEFAULT_DEV_PROXY_URL)
  if (!proxyUrl) {
    throw new Error('Set NEXT_PUBLIC_QWEN_PROXY_URL to the deployed Next.js app origin before building a Tauri package.')
  }

  let proxyOrigin
  try {
    const parsedUrl = new URL(proxyUrl)
    const isLocalHttp = parsedUrl.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
    if (parsedUrl.protocol !== 'https:' && !isLocalHttp) {
      throw new Error('The Qwen proxy URL must use HTTPS, except for a local development server.')
    }
    proxyOrigin = parsedUrl.origin
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('The Qwen proxy URL')) throw error
    throw new Error('NEXT_PUBLIC_QWEN_PROXY_URL must be a valid HTTPS URL (or a localhost URL for development).')
  }

  const configPath = resolve(repoRoot, 'src-tauri', 'tauri.conf.json')
  const tauriConfig = JSON.parse(readFileSync(configPath, 'utf8'))
  const csp = tauriConfig?.app?.security?.csp
  if (typeof csp !== 'string') throw new Error('Tauri CSP must be a string to add the configured Qwen proxy.')

  let foundConnectSource = false
  const nextCsp = csp.replace(/(^|;\s*)connect-src\s+([^;]*)(?=;|$)/, (directive, prefix, sources) => {
    foundConnectSource = true
    const allowedSources = sources.trim().split(/\s+/)
    return allowedSources.includes(proxyOrigin)
      ? directive
      : `${prefix}connect-src ${sources.trim()} ${proxyOrigin}`
  })
  if (!foundConnectSource) throw new Error('Tauri CSP is missing a connect-src directive.')

  const tempDirectory = mkdtempSync(join(tmpdir(), 'refx-tauri-qwen-csp-'))
  const overridePath = resolve(tempDirectory, 'qwen-csp.conf.json')
  writeFileSync(overridePath, JSON.stringify({ app: { security: { csp: nextCsp } } }), 'utf8')

  return {
    path: overridePath,
    cleanup() {
      rmSync(tempDirectory, { recursive: true, force: true })
    },
  }
}
