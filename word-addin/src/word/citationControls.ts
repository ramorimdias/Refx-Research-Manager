import type { CitationGroup } from './types'
import { debugLog, logOperation } from '../utils/logger'

export const CITATION_TAG = 'refx-citation'
export const BIBLIOGRAPHY_TAG = 'refx-bibliography'

export function createId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

function wrapCitationLabel(text: string, container: 'square' | 'round' | 'none' = 'square') {
  if (container === 'none') return text
  return container === 'round' ? `(${text})` : `[${text}]`
}

export function renderCitationLabel(numbers: number[], container: 'square' | 'round' | 'none' = 'square') {
  return wrapCitationLabel(numbers.join(', '), container)
}

function formatFirstAuthor(source?: { authors?: string[] }) {
  if (!source) return ''
  return source.authors?.[0]?.split(',')[0]?.trim() || source.authors?.[0]?.trim() || ''
}

function formatAuthorYearComma(source?: { authors?: string[]; year?: number | null }) {
  const firstAuthor = formatFirstAuthor(source)
  const year = source?.year ? String(source.year) : ''
  return [firstAuthor, year].filter(Boolean).join(', ')
}

function formatAuthorYearParen(source?: { authors?: string[]; year?: number | null }) {
  const firstAuthor = formatFirstAuthor(source)
  const year = source?.year ? String(source.year) : ''
  if (firstAuthor && year) return `${firstAuthor} (${year})`
  return firstAuthor || year
}

export function renderSingleCitationLabel(
  number: number,
  source?: { authors?: string[]; year?: number | null },
  options: {
    textCitationStyle: 'number' | 'authorYearParen' | 'authorYearComma' | 'author'
    citationContainer: 'square' | 'round' | 'none'
  } = { textCitationStyle: 'number', citationContainer: 'square' },
) {
  if (options.textCitationStyle === 'authorYearParen') {
    const authorYear = formatAuthorYearParen(source)
    return wrapCitationLabel(authorYear || String(number), options.citationContainer)
  }
  if (options.textCitationStyle === 'authorYearComma') {
    const authorYear = formatAuthorYearComma(source)
    return wrapCitationLabel(authorYear || String(number), options.citationContainer)
  }
  if (options.textCitationStyle === 'author') {
    const author = formatFirstAuthor(source)
    return wrapCitationLabel(author || String(number), options.citationContainer)
  }
  return wrapCitationLabel(String(number), options.citationContainer)
}

export function serializeCitationGroupTitle(group: CitationGroup) {
  return `refx:${JSON.stringify({ id: group.id, sourceIds: group.sourceIds })}`
}

export function parseCitationGroupTitle(title: string): CitationGroup | null {
  if (!title.startsWith('refx:')) return null
  try {
    const parsed = JSON.parse(title.slice(5))
    if (!parsed?.id || !Array.isArray(parsed.sourceIds)) return null
    return {
      id: String(parsed.id),
      sourceIds: parsed.sourceIds.map(String),
    }
  } catch {
    return null
  }
}

export function isWordWebHost() {
  return String(Office.context.platform ?? '').toLowerCase() === 'officeonline'
}

export async function insertCitationControl(group: CitationGroup, initialLabel = '[?]') {
  return logOperation('insert citation content control', () => Word.run(async (context) => {
    const range = context.document.getSelection()
    const control = range.insertContentControl()
    control.tag = CITATION_TAG
    control.title = serializeCitationGroupTitle(group)
    control.insertText(initialLabel, Word.InsertLocation.replace)
    control.load('id')
    await context.sync()
    return String(control.id)
  }))
}

export async function getCitationControlsInOrder() {
  return Word.run(async (context) => {
    const controls = context.document.contentControls.getByTag(CITATION_TAG)
    controls.load('items/id,title,text')
    await context.sync()
    return controls.items.map((control: any) => ({
      id: String(control.id),
      title: control.title,
      text: control.text,
    }))
  })
}

export async function updateCitationControlLabels(labelsByControlId: Map<string, string>) {
  await logOperation('update citation labels', () => Word.run(async (context: any) => {
    const controls = context.document.contentControls.getByTag(CITATION_TAG)
    controls.load('items/id,text')
    await context.sync()

    let writeCount = 0
    for (const control of controls.items) {
      const label = labelsByControlId.get(String(control.id))
      if (label && control.text !== label) {
        control.insertText(label, Word.InsertLocation.replace)
        writeCount += 1
      }
    }

    debugLog('update citation labels queued writes', { writeCount, controlCount: controls.items.length })
    if (writeCount > 0) {
      await context.sync()
    }
  }))
}

export async function upsertBibliographyControl(text: string) {
  await logOperation('upsert bibliography content control', () => Word.run(async (context) => {
    const controls = context.document.contentControls.getByTag(BIBLIOGRAPHY_TAG)
    controls.load('items/id,text')
    await context.sync()

    const duplicateControls = controls.items.slice(1)
    const hasDuplicates = duplicateControls.length > 0

    if (controls.items[0]) {
      for (const duplicate of duplicateControls) {
        duplicate.delete(false)
      }
      if (controls.items[0].text === text) {
        debugLog('bibliography unchanged', { duplicateCount: duplicateControls.length })
        if (hasDuplicates) {
          await context.sync()
        }
        return
      }
      debugLog('bibliography replace queued', { duplicateCount: duplicateControls.length })
      controls.items[0].insertText(text, Word.InsertLocation.replace)
      await context.sync()
      return
    }

    debugLog('bibliography create queued')
    const control = context.document.body
      .insertParagraph('\n', Word.InsertLocation.end)
      .getRange()
      .insertContentControl()
    control.tag = BIBLIOGRAPHY_TAG
    control.title = 'Refx bibliography'
    control.insertText(text, Word.InsertLocation.replace)
    await context.sync()
  }))
}


