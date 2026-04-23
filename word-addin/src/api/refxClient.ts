import { debugLog, logOperation } from '../utils/logger'
import { bridgeBaseUrl } from '../config/environment'

export type RefxReference = {
  id: string
  sourceType: 'document' | 'reference' | string
  citationKey?: string | null
  title: string
  authors: string[]
  year?: number | null
  journal?: string | null
  booktitle?: string | null
  publisher?: string | null
  volume?: string | null
  issue?: string | null
  pages?: string | null
  doi?: string | null
  url?: string | null
  bibtex?: string | null
}

export type RefxWork = {
  id: string
  title: string
  authors: string[]
  year?: number | null
  referenceCount: number
}

const ENABLE_MOCK_FALLBACK = new URLSearchParams(globalThis.location?.search ?? '').get('mock') === '1'
const REQUEST_TIMEOUT_MS = 3000
const RETRY_DELAY_MS = 250

const mockReferences: RefxReference[] = [
  {
    id: 'mock:A',
    sourceType: 'mock',
    citationKey: 'smith2024',
    title: 'Mocked reference A',
    authors: ['Smith, Jane'],
    year: 2024,
    journal: 'Refx Mock Journal',
    doi: '10.0000/refx-a',
  },
  {
    id: 'mock:B',
    sourceType: 'mock',
    citationKey: 'lee2025',
    title: 'Mocked reference B',
    authors: ['Lee, Min'],
    year: 2025,
    journal: 'Refx Mock Journal',
  },
]

const mockWorks: RefxWork[] = [
  {
    id: 'mock-work',
    title: 'Mock thesis or manuscript',
    authors: ['Refx User'],
    year: 2026,
    referenceCount: mockReferences.length,
  },
]

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function requestJson<T>(path: string, attempt = 0): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(`${bridgeBaseUrl}${path}`, { signal: controller.signal })
  } catch (error) {
    window.clearTimeout(timeoutId)
    if (attempt < 1) {
      debugLog('bridge request retry', { path, attempt: attempt + 1 })
      await delay(RETRY_DELAY_MS)
      return requestJson<T>(path, attempt + 1)
    }
    throw error
  }
  window.clearTimeout(timeoutId)

  if (!response.ok) {
    throw new Error(await response.text() || `Refx bridge returned ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function isMockModeEnabled() {
  return ENABLE_MOCK_FALLBACK
}

export function getBridgeBaseUrl() {
  return bridgeBaseUrl
}

export async function checkRefxBridge() {
  return logOperation('bridge health', () => requestJson<{ ok: boolean; app: string; version: string }>('/health'))
}

export async function searchWorks(query: string, useMockFallback = ENABLE_MOCK_FALLBACK) {
  try {
    return await logOperation('load works', () => requestJson<RefxWork[]>(`/works?query=${encodeURIComponent(query)}`))
  } catch (error) {
    if (!useMockFallback) throw error
    const normalized = query.trim().toLowerCase()
    return mockWorks.filter((work) => {
      if (!normalized) return true
      return [
        work.title,
        work.authors.join(' '),
        work.year ? String(work.year) : '',
      ].join(' ').toLowerCase().includes(normalized)
    })
  }
}

export async function searchReferences(workId: string, query: string, useMockFallback = ENABLE_MOCK_FALLBACK) {
  try {
    return await logOperation('load references', () => requestJson<RefxReference[]>(`/works/${encodeURIComponent(workId)}/references?query=${encodeURIComponent(query)}`))
  } catch (error) {
    if (!useMockFallback) throw error
    const normalized = query.trim().toLowerCase()
    return mockReferences.filter((reference) => {
      if (!normalized) return true
      return [
        reference.title,
        reference.citationKey ?? '',
        reference.authors.join(' '),
        reference.year ? String(reference.year) : '',
        reference.doi ?? '',
      ].join(' ').toLowerCase().includes(normalized)
    })
  }
}

export async function getReference(id: string, useMockFallback = ENABLE_MOCK_FALLBACK) {
  try {
    return await logOperation('load reference', () => requestJson<RefxReference>(`/references/${encodeURIComponent(id)}`))
  } catch (error) {
    if (!useMockFallback) throw error
    const mock = mockReferences.find((reference) => reference.id === id)
    if (!mock) throw error
    return mock
  }
}

export async function listWorkReferences(workId: string, useMockFallback = ENABLE_MOCK_FALLBACK) {
  return searchReferences(workId, '', useMockFallback)
}
