const DEFAULT_BRIDGE_URL = 'http://127.0.0.1:38474'

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  return trimmed.replace(/\/+$/, '')
}

export const addinEnvironment = import.meta.env.VITE_REFX_ADDIN_ENV
  ?? (import.meta.env.PROD ? 'production' : 'development')

export const bridgeBaseUrl = normalizeUrl(import.meta.env.VITE_REFX_BRIDGE_URL)
  ?? DEFAULT_BRIDGE_URL

export const isProductionAddin = addinEnvironment === 'production'
