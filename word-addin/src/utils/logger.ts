const DEBUG_ENABLED = new URLSearchParams(globalThis.location?.search ?? '').get('debug') === '1'

function timestamp() {
  return new Date().toISOString()
}

export function debugLog(message: string, details?: unknown) {
  if (!DEBUG_ENABLED) return
  if (details === undefined) {
    console.debug(`[Refx Word ${timestamp()}] ${message}`)
    return
  }
  console.debug(`[Refx Word ${timestamp()}] ${message}`, details)
}

export async function logOperation<T>(label: string, action: () => Promise<T>): Promise<T> {
  debugLog(`${label} start`)
  try {
    const result = await action()
    debugLog(`${label} end`)
    return result
  } catch (error) {
    debugLog(`${label} failed`, error)
    throw error
  }
}
