const DEFAULT_QWEN_MODEL = 'qwen3.6:35b'

export function getQwenDefaultModel() {
  return process.env.NEXT_PUBLIC_QWEN_MODEL?.trim() || DEFAULT_QWEN_MODEL
}

function getQwenProxyUrl(path: string) {
  const normalizedPath = path.replace(/^\/+/, '')
  if (normalizedPath !== 'models' && normalizedPath !== 'chat/completions') {
    throw new Error('This Qwen API operation is not supported by the app proxy.')
  }

  const proxyBaseUrl = process.env.NEXT_PUBLIC_QWEN_PROXY_URL?.trim().replace(/\/+$/, '')
  const apiPath = `/api/qwen/v1/${normalizedPath}`
  if (!proxyBaseUrl) return apiPath

  let baseUrl: URL
  try {
    baseUrl = new URL(proxyBaseUrl)
  } catch {
    throw new Error('The configured Qwen proxy URL is invalid.')
  }
  if (baseUrl.protocol !== 'https:' && !(baseUrl.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(baseUrl.hostname))) {
    throw new Error('The Qwen proxy URL must use HTTPS, except for a local development server.')
  }
  return new URL(apiPath, baseUrl).toString()
}

export async function requestQwenOpenAi(path: string, proxyPassword: string, init: RequestInit = {}) {
  if (!proxyPassword.trim()) {
    throw new Error('Enter the Qwen feature password in Settings to enable Qwen.')
  }

  const headers = new Headers(init.headers)
  headers.set('X-Qwen-Proxy-Password', proxyPassword.trim())
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(getQwenProxyUrl(path), {
      ...init,
      headers,
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('Could not reach the app’s Qwen proxy. Check that the app backend is running and that this build has the correct proxy URL.')
  }

  if (response.status === 401 || response.status === 403) {
    let message = 'The Qwen feature password was rejected by the app backend.'
    try {
      const payload = await response.clone().json()
      if (typeof payload?.error === 'string') message = payload.error
      else if (typeof payload?.error?.message === 'string') message = payload.error.message
    } catch {
      // Keep the safe default message when the proxy response is not JSON.
    }
    throw new Error(message)
  }

  if (!response.ok) {
    let message = `Qwen proxy request failed (HTTP ${response.status}).`
    try {
      const payload = await response.clone().json()
      if (typeof payload?.error === 'string') message = payload.error
      else if (typeof payload?.error?.message === 'string') message = payload.error.message
    } catch {
      // Keep the safe default message when the proxy response is not JSON.
    }
    throw new Error(message)
  }

  return response
}
