import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function readLocalEnvValue(name) {
  const path = resolve(process.cwd(), '.env.local')
  if (!existsSync(path)) return ''
  const line = readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`))
  return line?.slice(line.indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '') ?? ''
}

const name = 'NEXT_PUBLIC_SEMANTIC_SCHOLAR_API_KEY'
const value = (process.env[name] ?? readLocalEnvValue(name)).trim()

if (!value) {
  console.error(`Release build stopped: ${name} is not configured.`)
  console.error('Local builds may set it in .env.local. GitHub release builds must set the repository Actions secret with the same name.')
  process.exit(1)
}

console.log('Semantic Scholar built-in API access is configured for this release build.')
