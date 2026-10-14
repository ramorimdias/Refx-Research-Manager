'use client'

import * as repo from '@/lib/repositories/local-db'
import { getDocumentPlainText, readPersistedDocumentText } from '@/lib/services/document-text-service'
import { extractNormalizedDoi } from '@/lib/services/document-metadata-service'
import { extractPdfPageWords, type PdfWord } from '@/lib/services/document-processing'
import { isTauri } from '@/lib/tauri/client'

export type DocumentDoiOccurrence = {
  doi: string
  pageNumber?: number
  contextBefore: string
  contextAfter: string
  hasEarlierText: boolean
  hasLaterText: boolean
  rects: Array<Pick<PdfWord, 'left' | 'top' | 'width' | 'height'>>
}

type DoiScanPage = {
  pageNumber?: number
  text: string
  words?: PdfWord[]
}

function normalizeDoi(input: string) {
  return input
    .trim()
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .replace(/[.,;:)\]}"]+$/g, '')
    .toLowerCase()
}

function isCompleteDoi(input: string) {
  const normalized = normalizeDoi(input)
  const slashIndex = normalized.indexOf('/')
  if (slashIndex <= 0) return false

  const prefix = normalized.slice(0, slashIndex)
  const suffix = normalized.slice(slashIndex + 1)

  if (!/^10\.\d{4,9}$/i.test(prefix)) return false
  if (suffix.length < 6) return false
  if (!/[a-z0-9]$/i.test(suffix)) return false
  if (!/[a-z]/i.test(suffix) && !/\d{3,}/.test(suffix)) return false

  return true
}

function scanDoiPage(page: DoiScanPage): DocumentDoiOccurrence[] {
  const occurrences: DocumentDoiOccurrence[] = []
  const doiPattern = /10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi

  for (const match of page.text.matchAll(doiPattern)) {
    const rawDoi = match[0] ?? ''
    const doi = extractNormalizedDoi(rawDoi)
    if (!doi || !isCompleteDoi(doi)) continue

    const rawStart = match.index ?? 0
    const doiOffset = rawDoi.toLowerCase().indexOf(doi.toLowerCase())
    const start = rawStart + Math.max(0, doiOffset)
    const end = start + doi.length
    const contextStart = Math.max(0, start - 76)
    const contextEnd = Math.min(page.text.length, end + 76)
    const rects: DocumentDoiOccurrence['rects'] = []

    if (page.words?.length) {
      let cursor = 0
      for (const word of page.words) {
        const wordStart = cursor
        const wordEnd = wordStart + word.text.length
        if (wordEnd > start && wordStart < end) {
          rects.push({ left: word.left, top: word.top, width: word.width, height: word.height })
        }
        cursor = wordEnd + 1
      }
    }

    occurrences.push({
      doi,
      pageNumber: page.pageNumber,
      contextBefore: `${contextStart > 0 ? '…' : ''}${page.text.slice(contextStart, start)}`,
      contextAfter: `${page.text.slice(end, contextEnd)}${contextEnd < page.text.length ? '…' : ''}`,
      hasEarlierText: contextStart > 0,
      hasLaterText: contextEnd < page.text.length,
      rects,
    })
  }

  return occurrences
}

export async function scanDocumentForDoiOccurrences(document: {
  id: string
  extractedTextPath?: string
  searchText?: string
  filePath?: string
}): Promise<DocumentDoiOccurrence[]> {
  let pdfPages: DoiScanPage[] = []
  if (isTauri() && document.filePath) {
    try {
      pdfPages = await extractPdfPageWords(document.filePath)
    } catch {
      // Stored page text below still lets the user select a DOI when PDF rendering is unavailable.
    }
  }

  let persisted = null
  if (isTauri()) {
    try {
      persisted = await readPersistedDocumentText(document)
    } catch {
      persisted = null
    }
  }

  const pdfOccurrences = pdfPages.flatMap((page) => scanDoiPage(page))
  const pageKeys = new Set(pdfOccurrences.map((entry) => `${entry.doi.toLowerCase()}:${entry.pageNumber ?? ''}`))
  const persistedPages = persisted?.pages ?? []
  const persistedOccurrences = persistedPages
    .filter((page) => page.text)
    .flatMap((page) => scanDoiPage(page))
    .filter((entry) => !pageKeys.has(`${entry.doi.toLowerCase()}:${entry.pageNumber ?? ''}`))

  if (pdfOccurrences.length > 0 || persistedOccurrences.length > 0) {
    return [...pdfOccurrences, ...persistedOccurrences]
  }

  const fallbackText = (document.searchText ?? '').trim()
  if (!fallbackText) return []

  const fallbackPages = fallbackText.split(/\n{2,}/).filter(Boolean)
  return fallbackPages.flatMap((text, index) => scanDoiPage({
    pageNumber: fallbackPages.length > 1 ? index + 1 : undefined,
    text,
  }))
}

export async function scanDocumentForDoiReferences(
  document: Pick<repo.DbDocument, 'id' | 'doi' | 'extractedTextPath' | 'searchText'>,
) {
  const text = await getDocumentPlainText(document)
  if (!text.trim()) {
    return [] as string[]
  }

  const ownDoi = normalizeDoi(document.doi ?? '')
  const found = new Set<string>()

  for (const match of text.matchAll(/10\.\d{4,9}\/[-._;()/:A-Z0-9]+/gi)) {
    const normalized = normalizeDoi(extractNormalizedDoi(match[0] ?? '') ?? '')
    if (!normalized || normalized === ownDoi || !isCompleteDoi(normalized)) continue
    found.add(normalized)
  }

  return Array.from(found)
}
