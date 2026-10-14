import 'server-only'

import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_QWEN_API_BASE_URL = 'https://llm.667764.xyz/v1'
const DEFAULT_QWEN_MODEL = 'qwen3.6:35b'
const MAX_CHAT_REQUEST_BYTES = 2 * 1024 * 1024
const DEFAULT_DESKTOP_ORIGINS = [
  'http://localhost:3001',
  'tauri://localhost',
  'http://tauri.localhost',
  'https://tauri.localhost',
]

type RouteContext = { params: Promise<{ path: string[] }> }

function jsonError(message: string, status: number, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers)
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8')
  responseHeaders.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify({ error: { message } }), { status, headers: responseHeaders })
}

function getConfiguredProxyPassword() {
  return process.env.QWEN_ENABLER_PASSWORD?.trim()
    || process.env.QWEN_enabler_password?.trim()
    || ''
}

function isSameSecret(candidate: string, expected: string) {
  const candidateBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes)
}

function getAllowedOrigins() {
  const configuredOrigins = (process.env.QWEN_PROXY_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
  return new Set([...DEFAULT_DESKTOP_ORIGINS, ...configuredOrigins])
}

function getCorsHeaders(request: Request) {
  const headers = new Headers({ Vary: 'Origin' })
  const origin = request.headers.get('Origin')
  if (!origin) return { allowed: true, headers }

  let sameOrigin = false
  try {
    const requestUrl = new URL(request.url)
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
      || request.headers.get('host')
    const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
      || requestUrl.protocol.replace(/:$/, '')
    const requestOrigin = forwardedHost
      ? `${forwardedProtocol}://${forwardedHost}`
      : requestUrl.origin
    sameOrigin = requestOrigin === origin
  } catch {
    sameOrigin = false
  }

  if (!sameOrigin && !getAllowedOrigins().has(origin)) return { allowed: false, headers }

  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, X-Qwen-Proxy-Password')
  headers.set('Access-Control-Expose-Headers', 'X-Qwen-Default-Model')
  headers.set('Access-Control-Max-Age', '600')
  return { allowed: true, headers }
}

function getUpstreamCredentials() {
  // The dashed names are accepted temporarily for the existing local .env.local file.
  const clientId = process.env.CF_ACCESS_CLIENT_ID?.trim()
    || process.env['CF-Access-Client-Id']?.trim()
    || ''
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim()
    || process.env['CF-Access-Client-Secret']?.trim()
    || ''
  return { clientId, clientSecret }
}

function getUpstreamBaseUrl() {
  const value = process.env.QWEN_API_BASE_URL?.trim() || DEFAULT_QWEN_API_BASE_URL
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('QWEN_API_BASE_URL must be a valid URL.')
  }
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !localHttp) {
    throw new Error('QWEN_API_BASE_URL must use HTTPS, except for a local development server.')
  }
  return url.toString().replace(/\/+$/, '')
}

async function getRouteName(context: RouteContext) {
  const { path } = await context.params
  return path.join('/')
}

async function handleQwenRequest(request: NextRequest, context: RouteContext, method: 'GET' | 'POST') {
  const cors = getCorsHeaders(request)
  if (!cors.allowed) return jsonError('This app origin is not allowed to use the Qwen proxy.', 403, cors.headers)

  const routeName = await getRouteName(context)
  const isModelsRequest = method === 'GET' && routeName === 'models'
  const isChatRequest = method === 'POST' && routeName === 'chat/completions'
  if (!isModelsRequest && !isChatRequest) {
    return jsonError('This Qwen API operation is not supported by the app proxy.', 404, cors.headers)
  }

  const configuredPassword = getConfiguredProxyPassword()
  if (!configuredPassword) {
    return jsonError('The Qwen feature password is not configured on the app server.', 503, cors.headers)
  }
  const suppliedPassword = request.headers.get('X-Qwen-Proxy-Password') ?? ''
  if (!isSameSecret(suppliedPassword, configuredPassword)) {
    return jsonError('The Qwen feature password was rejected by the app server.', 401, cors.headers)
  }

  const { clientId, clientSecret } = getUpstreamCredentials()
  if (!clientId || !clientSecret) {
    return jsonError('Cloudflare Access credentials are missing from the app server environment.', 503, cors.headers)
  }

  let baseUrl: string
  try {
    baseUrl = getUpstreamBaseUrl()
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : 'The Qwen upstream URL is invalid.', 500, cors.headers)
  }

  let body: string | undefined
  if (isChatRequest) {
    const declaredLength = Number(request.headers.get('Content-Length') ?? '0')
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CHAT_REQUEST_BYTES) {
      return jsonError('The Qwen chat request is too large.', 413, cors.headers)
    }
    body = await request.text()
    if (Buffer.byteLength(body, 'utf8') > MAX_CHAT_REQUEST_BYTES) {
      return jsonError('The Qwen chat request is too large.', 413, cors.headers)
    }
    try {
      const payload = JSON.parse(body)
      if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) {
        return jsonError('The Qwen chat request must include a messages array.', 400, cors.headers)
      }
      if (typeof payload.model !== 'string' || !payload.model.trim()) {
        payload.model = process.env.QWEN_MODEL?.trim() || DEFAULT_QWEN_MODEL
      }
      body = JSON.stringify(payload)
    } catch {
      return jsonError('The Qwen chat request must contain valid JSON.', 400, cors.headers)
    }
  }

  const headers = new Headers({
    Authorization: 'Bearer ollama',
    'CF-Access-Client-Id': clientId,
    'CF-Access-Client-Secret': clientSecret,
  })
  if (isChatRequest) headers.set('Content-Type', 'application/json')

  let upstream: Response
  try {
    upstream = await fetch(`${baseUrl}/${routeName}`, {
      method,
      headers,
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(120_000),
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return jsonError('The Qwen upstream request timed out.', 504, cors.headers)
    }
    return jsonError('The app server could not reach the configured Qwen upstream.', 502, cors.headers)
  }

  const responseHeaders = new Headers(cors.headers)
  responseHeaders.set('Cache-Control', 'no-store')
  responseHeaders.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json; charset=utf-8')
  if (isModelsRequest) {
    responseHeaders.set('X-Qwen-Default-Model', process.env.QWEN_MODEL?.trim() || DEFAULT_QWEN_MODEL)
  }

  if (upstream.status === 401 || upstream.status === 403) {
    return jsonError('Cloudflare Access rejected the app server request. Check its service token and Service Auth policy.', upstream.status, responseHeaders)
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export async function OPTIONS(request: NextRequest) {
  const cors = getCorsHeaders(request)
  if (!cors.allowed) return jsonError('This app origin is not allowed to use the Qwen proxy.', 403, cors.headers)

  const requestedHeaders = (request.headers.get('Access-Control-Request-Headers') ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean)
  const allowedHeaders = new Set(['content-type', 'x-qwen-proxy-password'])
  if (requestedHeaders.some((header) => !allowedHeaders.has(header))) {
    return jsonError('The browser requested headers not allowed by the Qwen proxy.', 403, cors.headers)
  }

  return new Response(null, { status: 204, headers: cors.headers })
}

export async function GET(request: NextRequest, context: RouteContext) {
  return handleQwenRequest(request, context, 'GET')
}

export async function POST(request: NextRequest, context: RouteContext) {
  return handleQwenRequest(request, context, 'POST')
}
