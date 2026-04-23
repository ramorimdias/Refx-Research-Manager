import { emptyCitationState, type RefxCitationState } from './types'
import { debugLog, logOperation } from '../utils/logger'

const NAMESPACE = 'https://refx.app/word-citations/v1'
const ROOT_TAG = 'refxCitationState'
type CustomXmlPart = {
  getXmlAsync: (callback: (result: { status: string; value: string; error?: unknown }) => void) => void
  deleteAsync: (callback: (result: { status: string; error?: unknown }) => void) => void
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function unescapeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function serializeState(state: RefxCitationState) {
  return `<${ROOT_TAG} xmlns="${NAMESPACE}">${escapeXml(JSON.stringify(state))}</${ROOT_TAG}>`
}

function normalizeState(value: unknown): RefxCitationState {
  const empty = emptyCitationState()
  if (!value || typeof value !== 'object') return empty

  const parsed = value as Partial<RefxCitationState>
  const settings = parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}
  const sources = parsed.sources && typeof parsed.sources === 'object' && !Array.isArray(parsed.sources)
    ? parsed.sources
    : {}
  const citationGroups = Array.isArray(parsed.citationGroups)
    ? parsed.citationGroups.filter((group) => (
      group
      && typeof group === 'object'
      && typeof group.id === 'string'
      && Array.isArray(group.sourceIds)
      && group.sourceIds.every((sourceId) => typeof sourceId === 'string')
    ))
    : []

  const rawSettings = settings as Partial<RefxCitationState['settings']>
  const bibliographyOrder = rawSettings.bibliographyOrder === 'refxWorkOrder'
    ? 'refxWorkOrder'
    : 'firstAppearance'
  const textCitationStyle = (
    rawSettings.textCitationStyle === 'authorYearParen'
    || rawSettings.textCitationStyle === 'authorYearComma'
    || rawSettings.textCitationStyle === 'author'
    || rawSettings.textCitationStyle === 'number'
  ) ? rawSettings.textCitationStyle : empty.settings.textCitationStyle
  const citationContainer = (
    rawSettings.citationContainer === 'round'
    || rawSettings.citationContainer === 'none'
    || rawSettings.citationContainer === 'square'
  ) ? rawSettings.citationContainer : empty.settings.citationContainer

  return {
    version: 1,
    sources: sources as RefxCitationState['sources'],
    citationGroups: citationGroups as RefxCitationState['citationGroups'],
    settings: {
      ...empty.settings,
      workDocumentId: typeof rawSettings.workDocumentId === 'string' ? rawSettings.workDocumentId : undefined,
      workTitle: typeof rawSettings.workTitle === 'string' ? rawSettings.workTitle : undefined,
      bibliographyOrder,
      textCitationStyle,
      citationContainer,
      style: 'numeric',
    },
  }
}

function parseState(xml: string): RefxCitationState {
  const match = xml.match(new RegExp(`<${ROOT_TAG}[^>]*>([\\s\\S]*)<\\/${ROOT_TAG}>`))
  if (!match) return emptyCitationState()
  try {
    const parsed = JSON.parse(unescapeXml(match[1]))
    return normalizeState(parsed)
  } catch {
    return emptyCitationState()
  }
}

function getRefxXmlParts(): Promise<CustomXmlPart[]> {
  return new Promise((resolve, reject) => {
    if (!Office.context.document.customXmlParts?.getByNamespaceAsync) {
      resolve([])
      return
    }

    Office.context.document.customXmlParts.getByNamespaceAsync(NAMESPACE, (result) => {
      if (result.status !== 'succeeded') {
        reject(result.error)
        return
      }
      resolve(Array.from(result.value ?? []) as CustomXmlPart[])
    })
  })
}

function readXmlPart(part: CustomXmlPart): Promise<string> {
  return new Promise((resolve, reject) => {
    part.getXmlAsync((result) => {
      if (result.status !== 'succeeded') {
        reject(result.error)
        return
      }
      resolve(result.value)
    })
  })
}

function addXmlPart(xml: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!Office.context.document.customXmlParts?.addAsync) {
      reject(new Error('Custom XML parts are not available in this Word host.'))
      return
    }

    Office.context.document.customXmlParts.addAsync(xml, (result) => {
      if (result.status !== 'succeeded') {
        reject(result.error)
        return
      }
      resolve()
    })
  })
}

function deleteXmlPart(part: CustomXmlPart): Promise<void> {
  return new Promise((resolve, reject) => {
    part.deleteAsync((result) => {
      if (result.status !== 'succeeded') {
        reject(result.error)
        return
      }
      resolve()
    })
  })
}

export async function loadCitationState(): Promise<RefxCitationState> {
  return logOperation('load custom XML', async () => {
    const parts = await getRefxXmlParts()
    debugLog('custom XML parts found', { count: parts.length })
    return parts[0] ? parseState(await readXmlPart(parts[0])) : emptyCitationState()
  })
}

export async function saveCitationState(state: RefxCitationState): Promise<void> {
  await logOperation('save custom XML', async () => {
    const nextXml = serializeState(normalizeState(state))
    const existingParts = await getRefxXmlParts()
    const existing = existingParts[0] ?? null
    const duplicateParts = existingParts.slice(1)
    if (existing) {
      const currentXml = await readXmlPart(existing)
      if (currentXml === nextXml) {
        debugLog('custom XML unchanged', { duplicateCount: duplicateParts.length })
        for (const duplicate of duplicateParts) {
          await deleteXmlPart(duplicate)
        }
        return
      }
      debugLog('custom XML changed', { duplicateCount: duplicateParts.length })
      await deleteXmlPart(existing)
    }
    for (const duplicate of duplicateParts) {
      await deleteXmlPart(duplicate)
    }
    await addXmlPart(nextXml)
  })
}
