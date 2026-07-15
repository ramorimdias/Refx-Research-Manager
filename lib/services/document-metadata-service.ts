'use client'

import { readFile } from '@tauri-apps/plugin-fs'
import { extractPdfPageLines, extractPdfPageWords } from '@/lib/services/document-processing'
import { classifyPdfWorkType } from '@/lib/services/document-work-type-service'
import type { DbDocument, DbUpdateDocumentMetadataInput } from '@/lib/repositories/local-db'
import { getDocumentSuggestedTags, serializeSuggestedTags } from '@/lib/services/document-tag-suggestion-service'
import type {
  DocumentMetadataProvenance,
  DocumentMetadataProvenanceEntry,
  DocumentMetadataUserEditedFields,
  EditableMetadataField,
  MetadataFieldSource,
  MetadataStatus,
  SuggestedTag,
  DocumentWorkMetadata,
} from '@/lib/types'

export type LocalPdfMetadata = {
  title?: string
  authors?: string[]
  year?: number
  doi?: string
  pageCount?: number
  citationKey?: string
  abstract?: string
  suggestedTags?: SuggestedTag[]
  citationCount?: number
  provenance: DocumentMetadataProvenance
  work?: DocumentWorkMetadata
}

type MetadataMergeMode = 'fill_missing' | 'replace_unlocked'

type RawPdfMetadataSignals = {
  rawText: string
  title?: string
  authors?: string[]
  year?: number
  doi?: string
}

type FirstPageMetadataSignals = {
  title?: string
  authors?: string[]
  doi?: string
  pageCount?: number
}

function extractPresentationSignals(lines: string[], text: string) {
  const useful = lines.map(normalizeWhitespace).filter(Boolean).slice(0, 20)
  const organization = useful.find((line) => /\b(university|institute|laborator(?:y|ies)|department|company|corporation|inc\.?|ltd\.?|research cent(?:re|er))\b/i.test(line))
  const event = useful.find((line) => /\b(conference|symposium|workshop|summit|annual meeting|webinar|keynote)\b/i.test(line))
  const presentationDate = text.match(/\b(20\d{2}[-/]\d{1,2}[-/]\d{1,2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)[\s,/-]+\d{1,2}[\s,/-]+20\d{2})\b/i)?.[0]
  const location = useful.find((line) => /\b(location|venue|hosted in|held in)\s*[:\-]/i.test(line))?.replace(/^.*?[:\-]\s*/, '')
  const sourceUrl = text.match(/https?:\/\/[^\s)]+/i)?.[0]
  const visibility = /\b(confidential|do not distribute)\b/i.test(text) ? 'confidential' as const
    : /\binternal(?: use only)?\b/i.test(text) ? 'internal' as const : 'unspecified' as const
  return { organization, event, presentationDate, location, sourceUrl, visibility }
}

function extractPresentationTitleAndAuthors(pages: Array<{ lines: string[] }>) {
  const isNoise = (line: string) =>
    /\b(june|january|february|march|april|may|july|august|september|october|november|december)\b|\b(grand palais|conference|symposium|workshop)\b/i.test(line)
    || /^sia\s+powertrain\b/i.test(line)
  const isPersonOrAffiliation = (line: string) =>
    /\b(university|technologies|corporation|institute|department|company|\bAG\b|\bInc\b|\bLtd\b)\b/i.test(line)
    || /^(presenter|co-?author|speaker)\s*:/i.test(line)

  let title: string | undefined
  for (const page of [pages[1], pages[0], pages[2]].filter(Boolean)) {
    const lines = page!.lines.map(normalizeWhitespace).filter(Boolean)
    const start = lines.findIndex((line) => line.length >= 20 && !isNoise(line) && !isPersonOrAffiliation(line) && !/@/.test(line))
    if (start < 0) continue
    const parts: string[] = []
    for (const line of lines.slice(start, start + 5)) {
      if (isPersonOrAffiliation(line)) break
      if (isNoise(line) || line.length > 180) continue
      parts.push(line)
      if (parts.join(' ').length >= 60) break
    }
    const candidate = normalizeWhitespace(parts.join(' '))
    if (candidate.length >= 20) { title = candidate; break }
  }

  const authors: string[] = []
  for (const line of pages.slice(0, 3).flatMap((page) => page.lines)) {
    const explicit = line.match(/^(?:presenter|co-?author|speaker)\s*:\s*([^,;|]+)/i)?.[1]?.trim()
    const beforeAffiliation = line.match(/^([A-ZÀ-ÖØ-Ý][\p{L}.'-]+(?:\s+[A-ZÀ-ÖØ-Ý][\p{L}.'-]+){1,3})\s*,\s*[^,]+$/u)?.[1]?.trim()
    const author = explicit ?? beforeAffiliation
    if (author && !authors.some((entry) => entry.toLowerCase() === author.toLowerCase())) authors.push(author)
  }
  return { title, authors }
}

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

export function hasUsableMetadataTitle(title?: string | null) {
  const normalized = normalizeWhitespace(title ?? '')
  if (!normalized) return false

  const alphanumeric = normalized.replace(/[^a-z0-9]/gi, '')
  if (!alphanumeric) return false
  if (/^(?:copy|copie|copia)?\s*(?:of|de|do|da)?\s*(?:template|mod[eè]le|modelo)(?:\s+(?:ppt|powerpoint|presentation))?$/i.test(normalized)) return false

  const digitCount = (alphanumeric.match(/\d/g) ?? []).length
  return digitCount / alphanumeric.length < 0.7
}

function cleanPdfField(value: string) {
  return normalizeWhitespace(
    value
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\n/g, ' ')
      .replace(/^\uFEFF/, ''),
  )
}

function splitAuthors(raw?: string) {
  if (!raw) return []
  return raw
    .split(/,|;|\band\b/gi)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
}

const DOI_STOP_WORDS = [
  'received',
  'accepted',
  'available',
  'corresponding',
  'contents',
  'sciencedirect',
  'journal',
  'article',
  'published',
  'revised',
  'online',
  'homepage',
  'author',
  'address',
  'email',
  'e-mail',
  'abstract',
  'keywords',
  'introduction',
]

function trimTrailingDoiNoise(value: string) {
  let suffix = value
    .replace(/[)\]}>,;:"']+$/g, '')
    .replace(/\s+/g, '')
    .trim()

  for (const word of DOI_STOP_WORDS) {
    const pattern = new RegExp(`${word}.*$`, 'i')
    suffix = suffix.replace(pattern, '')
  }

  suffix = suffix.replace(/(?:fig|table|vol|issue|pages?)\.?$/i, '')
  suffix = suffix.replace(/[^A-Z0-9\-._;()/:]+$/i, '')
  suffix = suffix.replace(/[-._;:/()]+$/g, '')
  return suffix
}

function findDoiCandidates(input: string) {
  const matches: string[] = []
  const prefixPattern = /\b(?:doi:\s*)?(10\.\d{4,9})\s*\/\s*/gi

  for (const match of input.matchAll(prefixPattern)) {
    const prefix = match[1]
    const matchText = match[0] ?? ''
    const start = (match.index ?? 0) + matchText.length
    const tail = input.slice(start, start + 180)
    if (!tail) continue

    const compactTail = tail.replace(/[\u200B-\u200D\uFEFF]/g, '')
    const suffixMatch = compactTail.match(/^([A-Z0-9\-._;()/:/\s]{3,180})/i)?.[1] ?? ''
    const suffix = trimTrailingDoiNoise(suffixMatch)
    if (!suffix) continue

    matches.push(`${prefix}/${suffix}`)
  }

  return matches
}

export function extractNormalizedDoi(input?: string) {
  if (!input) return undefined
  const normalizedInput = input
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/https?:\/\/(?:dx\.)?doi\.org\//gi, 'doi:')
  const candidates = findDoiCandidates(normalizedInput)

  for (const candidate of candidates) {
    const slashIndex = candidate.indexOf('/')
    if (slashIndex <= 0) continue

    const prefix = candidate.slice(0, slashIndex)
    const suffix = candidate.slice(slashIndex + 1)
    if (!/^10\.\d{4,9}$/i.test(prefix) || suffix.length < 3) continue
    if (!/[a-z0-9]$/i.test(suffix)) continue

    return `${prefix}/${suffix}`
  }

  return undefined
}

function parseDoi(input?: string) {
  return extractNormalizedDoi(input)
}

function parseYear(input?: string) {
  if (!input) return undefined
  const value = input.match(/\b(19|20)\d{2}\b/)?.[0]
  if (!value) return undefined
  const year = Number(value)
  const currentYear = new Date().getFullYear() + 1
  if (!Number.isFinite(year) || year < 1900 || year > currentYear) return undefined
  return year
}

function titleFromFilePath(filePath: string) {
  const fileName = filePath.split(/[\\/]/).pop() ?? ''
  return normalizeWhitespace(fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' '))
}

function looksLikeMeaningfulFileTitle(title?: string) {
  const normalized = normalizeWhitespace(title ?? '')
  if (!hasUsableMetadataTitle(normalized)) return false
  if (normalized.length < 12 || normalized.length > 260) return false

  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length < 3) return false

  const alphanumeric = normalized.replace(/[^a-z0-9]/gi, '')
  if (alphanumeric.length === 0) return false

  const digitCount = (alphanumeric.match(/\d/g) ?? []).length
  const lowercaseCount = (normalized.match(/[a-z]/g) ?? []).length
  const separatorCount = (normalized.match(/[-_.()[\]]/g) ?? []).length

  if (digitCount / alphanumeric.length > 0.35) return false
  if (lowercaseCount === 0) return false
  if (separatorCount > Math.max(8, words.length)) return false
  if (/^(scan|document|paper|article|download|untitled|export|fulltext|pdf)(?:\s*\d*)?$/i.test(normalized)) return false
  if (/^[a-f0-9]{12,}$/i.test(alphanumeric)) return false

  return true
}

function citationKeyFor(title: string, authors: string[], year?: number) {
  const firstAuthorToken = authors[0]?.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'
  const titleToken = title.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'paper'
  return `${firstAuthorToken}${year ?? 'nd'}${titleToken}`
}

function normalizeExtractedTitle(title?: string) {
  if (!title) return undefined
  const cleaned = normalizeWhitespace(title.replace(/^title[:\s-]*/i, ''))
  if (!cleaned) return undefined
  return cleaned
}

function looksLikeStopLine(line: string) {
  return /\b(abstract|summary|keywords|index terms|introduction|resumo|sum[aá]rio)\b/i.test(line)
}

function looksLikeAuthorToken(token: string) {
  const normalized = token.trim()
  if (!normalized || normalized.length < 3 || /\d/.test(normalized)) return false
  if (/@|https?:\/\//i.test(normalized)) return false
  const words = normalized.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false
  return words.every((word) => /^[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ.'-]*$|^[A-ZÀ-ÖØ-Ý]\.?$/u.test(word))
}

function parseAuthorsFromLine(line: string) {
  const cleaned = line
    .replace(/\b(and|e)\b/gi, ',')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const candidates = cleaned
    .split(/,|;|•/)
    .map((entry) => normalizeWhitespace(entry.replace(/\d+/g, '').replace(/[*†‡]/g, '')))
    .filter(Boolean)

  if (candidates.length === 0 || candidates.length > 8) return []
  if (!candidates.every(looksLikeAuthorToken)) return []
  return candidates
}

function extractFirstPageMetadata(lines: string[], pageText: string): FirstPageMetadataSignals {
  const cleanedLines = lines
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length >= 3)
    .slice(0, 14)

  const visibleLines: string[] = []
  for (const line of cleanedLines) {
    if (looksLikeStopLine(line)) break
    visibleLines.push(line)
  }

  let title: string | undefined
  let authors: string[] = []

  for (let index = 0; index < visibleLines.length; index += 1) {
    const line = visibleLines[index]
    if (!line || /^doi\b/i.test(line) || /@/.test(line)) continue
    const parsedAuthors = parseAuthorsFromLine(line)
    if (parsedAuthors.length > 0) {
      authors = parsedAuthors
      break
    }

    if (!title && line.length >= 20 && line.length <= 240 && !/\b(university|journal|vol\.|issue|issn)\b/i.test(line)) {
      const nextLine = visibleLines[index + 1]
      const nextIsAuthorLine = nextLine ? parseAuthorsFromLine(nextLine).length > 0 : false
      title = nextIsAuthorLine && nextLine && line.length < 160
        ? normalizeExtractedTitle(`${line} ${nextLine}`.replace(/\s+/g, ' '))
        : normalizeExtractedTitle(line)
    }
  }

  if (!authors.length) {
    const authorLine = visibleLines.find((line) => parseAuthorsFromLine(line).length > 0)
    if (authorLine) {
      authors = parseAuthorsFromLine(authorLine)
    }
  }

  return {
    title,
    authors,
    doi: parseDoi(pageText),
  }
}

async function readRawPdfMetadata(filePath: string): Promise<RawPdfMetadataSignals> {
  const bytes = await readFile(filePath)
  const head = bytes.slice(0, 360_000)
  const tail = bytes.slice(Math.max(0, bytes.length - 360_000))
  const text = new TextDecoder('latin1', { fatal: false }).decode(
    head.length === bytes.length ? head : new Uint8Array([...head, ...tail]),
  )

  const rawTitle = text.match(/\/Title\s*\(([\s\S]{1,300}?)\)/)?.[1]
  const rawAuthor = text.match(/\/Author\s*\(([\s\S]{1,300}?)\)/)?.[1]
  const rawCreationDate = text.match(/\/CreationDate\s*\(([\s\S]{1,80}?)\)/)?.[1]

  return {
    rawText: text,
    title: rawTitle ? cleanPdfField(rawTitle) : undefined,
    authors: splitAuthors(rawAuthor ? cleanPdfField(rawAuthor) : undefined),
    // Never derive a year from arbitrary PDF bytes: compressed streams routinely
    // contain accidental values such as 2016/2018 that are not document dates.
    year: rawCreationDate ? parseYear(cleanPdfField(rawCreationDate)) : undefined,
    doi: parseDoi(text),
  }
}

function provenanceEntry(source: MetadataFieldSource, detail?: string, confidence?: number): DocumentMetadataProvenanceEntry {
  return {
    source,
    extractedAt: new Date(),
    ...(detail ? { detail } : {}),
    ...(typeof confidence === 'number' ? { confidence } : {}),
  }
}

function parseAuthorsValue(value: string) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value.trim())
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  } catch {
    return splitAuthors(value)
  }
}

export function parseMetadataProvenance(value?: string | DocumentMetadataProvenance) {
  if (!value) return {} as DocumentMetadataProvenance
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value.trim()) : value
  } catch {
    return {} as DocumentMetadataProvenance
  }
  if (!parsed || typeof parsed !== 'object') {
    return {} as DocumentMetadataProvenance
  }
  const entries = Object.entries(parsed ?? {})
  return Object.fromEntries(
    entries
      .filter(([, entry]) => entry && typeof entry === 'object')
      .map(([field, entry]) => [
        field,
        {
          ...(entry as Omit<DocumentMetadataProvenanceEntry, 'extractedAt'>),
          extractedAt: new Date((entry as { extractedAt?: string | Date }).extractedAt ?? new Date()),
        },
      ]),
  ) as DocumentMetadataProvenance
}

export function parseMetadataUserEditedFields(value?: string | DocumentMetadataUserEditedFields) {
  if (!value) return {} as DocumentMetadataUserEditedFields
  let parsed: unknown
  try {
    parsed = typeof value === 'string' ? JSON.parse(value.trim()) : value
  } catch {
    return {} as DocumentMetadataUserEditedFields
  }
  return typeof parsed === 'object' && parsed ? parsed as DocumentMetadataUserEditedFields : {}
}

export function serializeMetadataProvenance(provenance: DocumentMetadataProvenance) {
  return JSON.stringify(provenance)
}

export function serializeMetadataUserEditedFields(fields: DocumentMetadataUserEditedFields) {
  return JSON.stringify(fields)
}

export function deriveMetadataStatus(input: {
  title?: string
  authors?: string[]
  year?: number
  doi?: string
  workType?: import('@/lib/types').WorkType
  organization?: string
}): MetadataStatus {
  if (input.workType === 'presentation') {
    if (hasUsableMetadataTitle(input.title) && ((input.authors?.length ?? 0) > 0 || Boolean(input.organization))) return 'complete'
    return hasUsableMetadataTitle(input.title) || Boolean(input.organization) ? 'partial' : 'missing'
  }
  const signalCount = [
    hasUsableMetadataTitle(input.title) ? 1 : 0,
    input.authors && input.authors.length > 0 ? 1 : 0,
    input.year ? 1 : 0,
    input.doi ? 1 : 0,
  ].reduce((sum, value) => sum + value, 0)

  if (signalCount >= 3) return 'complete'
  if (signalCount >= 1) return 'partial'
  return 'missing'
}

export async function extractLocalPdfMetadata(filePath: string, titleFallbackPath?: string): Promise<LocalPdfMetadata> {
  const rawMetadata = await readRawPdfMetadata(filePath)
  let firstPageMetadata: FirstPageMetadataSignals = {}
  let work: DocumentWorkMetadata | undefined
  let presentationIdentity: ReturnType<typeof extractPresentationTitleAndAuthors> | undefined
  let visibleOpeningYear: number | undefined

  try {
    const pages = await extractPdfPageLines(filePath)
    const firstPage = pages[0]
    firstPageMetadata = {
      ...extractFirstPageMetadata(firstPage?.lines ?? [], firstPage?.text ?? ''),
      pageCount: pages.length,
    }
    visibleOpeningYear = parseYear(pages.slice(0, 3).map((page) => page.text).join('\n'))
    const classified = classifyPdfWorkType({
      pages: await extractPdfPageWords(filePath),
      embeddedProducer: rawMetadata.rawText,
      fileName: titleFallbackPath ?? filePath,
    })
    work = {
      ...classified,
      presentation: classified.workType === 'presentation'
        ? extractPresentationSignals(pages.slice(0, 3).flatMap((page) => page.lines), pages.slice(0, 3).map((page) => page.text).join('\n'))
        : undefined,
    }
    if (classified.workType === 'presentation') presentationIdentity = extractPresentationTitleAndAuthors(pages.slice(0, 3))
  } catch (error) {
    console.info('First-page metadata extraction skipped:', error)
  }

  const fileNameTitle = titleFromFilePath(titleFallbackPath ?? filePath)
  const provenance: DocumentMetadataProvenance = {}

  const embeddedTitle = normalizeExtractedTitle(rawMetadata.title)
  const meaningfulFileNameTitle = looksLikeMeaningfulFileTitle(fileNameTitle) ? fileNameTitle : undefined
  const firstPageTitle = normalizeExtractedTitle(firstPageMetadata.title)
  const presentationTitle = normalizeExtractedTitle(presentationIdentity?.title)
  const title = hasUsableMetadataTitle(embeddedTitle)
    ? embeddedTitle
    : work?.workType === 'presentation'
      ? (hasUsableMetadataTitle(presentationTitle) ? presentationTitle : hasUsableMetadataTitle(firstPageTitle) ? firstPageTitle : meaningfulFileNameTitle)
      : meaningfulFileNameTitle
        ?? (hasUsableMetadataTitle(firstPageTitle) ? firstPageTitle : undefined)
      ?? fileNameTitle

  if (title) {
    provenance.title = title === embeddedTitle
      ? provenanceEntry('embedded_pdf_metadata', 'Embedded PDF title metadata.', 0.9)
      : title === meaningfulFileNameTitle
        ? provenanceEntry('filename_fallback', 'Meaningful filename title.', 0.72)
      : title === firstPageTitle
        ? provenanceEntry('first_page_heuristic', 'First-page title heuristic.', 0.75)
        : provenanceEntry('filename_fallback', 'Filename fallback.', 0.25)
  }

  const authors = work?.workType === 'presentation' && presentationIdentity?.authors.length
    ? presentationIdentity.authors
    : rawMetadata.authors && rawMetadata.authors.length > 0
      ? rawMetadata.authors
      : (firstPageMetadata.authors ?? [])

  if (authors.length > 0) {
    provenance.authors = provenanceEntry(
      work?.workType === 'presentation' && presentationIdentity?.authors.length ? 'first_page_heuristic' : rawMetadata.authors && rawMetadata.authors.length > 0 ? 'embedded_pdf_metadata' : 'first_page_heuristic',
      work?.workType === 'presentation' && presentationIdentity?.authors.length ? 'Presenter labels from the opening slides.' : rawMetadata.authors && rawMetadata.authors.length > 0 ? 'Embedded PDF author metadata.' : 'First-page author heuristic.',
      work?.workType === 'presentation' && presentationIdentity?.authors.length ? 0.92 : rawMetadata.authors && rawMetadata.authors.length > 0 ? 0.9 : 0.8,
    )
  }

  const year = work?.workType === 'presentation'
    ? (visibleOpeningYear ?? rawMetadata.year)
    : (rawMetadata.year ?? visibleOpeningYear)
  if (year) {
    provenance.year = provenanceEntry(
      year === visibleOpeningYear ? 'first_page_heuristic' : 'embedded_pdf_metadata',
      year === visibleOpeningYear ? 'Year extracted from the opening slides.' : 'Embedded PDF date metadata.',
      year === visibleOpeningYear ? 0.9 : 0.7,
    )
  }

  const doi = rawMetadata.doi ?? firstPageMetadata.doi
  if (doi) {
    provenance.doi = provenanceEntry(
      'doi_regex',
      rawMetadata.doi ? 'DOI regex over PDF byte sample.' : 'DOI regex over first-page text.',
      rawMetadata.doi ? 0.92 : 0.88,
    )
  }

  if (firstPageMetadata.pageCount) {
    provenance.pageCount = provenanceEntry('first_page_heuristic', 'Page count derived from PDF page scan.', 1)
  }
  if (work) provenance.work = work

  const normalizedTitle = title || undefined
  return {
    title: normalizedTitle,
    authors,
    year,
    doi,
    pageCount: firstPageMetadata.pageCount,
    citationKey: normalizedTitle ? citationKeyFor(normalizedTitle, authors, year) : undefined,
    provenance,
    work,
  }
}

export function mergeExtractedMetadataIntoDocument(
  document: Pick<DbDocument, 'title' | 'authors' | 'year' | 'doi' | 'citationKey' | 'pageCount' | 'abstractText' | 'tagSuggestions' | 'metadataProvenance' | 'metadataUserEditedFields'>,
  metadata: LocalPdfMetadata,
  mode: MetadataMergeMode = 'replace_unlocked',
) {
  const userEdited = parseMetadataUserEditedFields(document.metadataUserEditedFields)
  const provenance = parseMetadataProvenance(document.metadataProvenance)
  if (metadata.work && !provenance.work?.detection.locked) provenance.work = metadata.work
  const currentAuthors = parseAuthorsValue(document.authors)
  const updates: DbUpdateDocumentMetadataInput = {}

  const canWriteField = (field: EditableMetadataField) => {
    if (mode === 'replace_unlocked') return true
    return !userEdited[field]
  }
  const canReplaceFieldValue = (field: EditableMetadataField, currentValue: unknown) => {
    if (!canWriteField(field)) return false
    if (mode === 'replace_unlocked') return true
    if (Array.isArray(currentValue)) return currentValue.length === 0
    if (typeof currentValue === 'string') return currentValue.trim().length === 0
    return currentValue === undefined || currentValue === null
  }

  if (metadata.title && canReplaceFieldValue('title', document.title)) {
    updates.title = metadata.title
    if (metadata.provenance.title) provenance.title = metadata.provenance.title
  }

  if (metadata.authors && metadata.authors.length > 0 && canReplaceFieldValue('authors', currentAuthors)) {
    updates.authors = JSON.stringify(metadata.authors)
    if (metadata.provenance.authors) provenance.authors = metadata.provenance.authors
  }

  if (metadata.year && canReplaceFieldValue('year', document.year)) {
    updates.year = metadata.year
    if (metadata.provenance.year) provenance.year = metadata.provenance.year
  }

  if (metadata.doi && canReplaceFieldValue('doi', document.doi)) {
    updates.doi = metadata.doi
    if (metadata.provenance.doi) provenance.doi = metadata.provenance.doi
  }

  if (metadata.pageCount && metadata.pageCount > 0 && (mode === 'replace_unlocked' || !document.pageCount)) {
    updates.pageCount = metadata.pageCount
    if (metadata.provenance.pageCount) provenance.pageCount = metadata.provenance.pageCount
  }

  if (
    metadata.citationKey
    && canWriteField('title')
    && canWriteField('authors')
    && canWriteField('year')
    && (mode === 'replace_unlocked' || !document.citationKey)
  ) {
    updates.citationKey = metadata.citationKey
  }

  if (metadata.abstract && canReplaceFieldValue('abstract', document.abstractText)) {
    updates.abstractText = metadata.abstract
  }

  if (metadata.suggestedTags && metadata.suggestedTags.length > 0) {
    const existingSuggestedTags = getDocumentSuggestedTags({
      tagSuggestions: document.tagSuggestions,
    })
    const mergedSuggestedTags: SuggestedTag[] = [...existingSuggestedTags]

    for (const tag of metadata.suggestedTags) {
      if (mergedSuggestedTags.some((entry) => entry.name === tag.name)) continue
      mergedSuggestedTags.push(tag)
    }

    if (mergedSuggestedTags.length > 0) {
      updates.tagSuggestions = serializeSuggestedTags(mergedSuggestedTags.slice(0, 12))
    }
  }

  const effectiveTitle = updates.title ?? document.title
  const effectiveAuthors = updates.authors ? parseAuthorsValue(updates.authors) : currentAuthors
  const effectiveYear = updates.year ?? document.year
  const effectiveDoi = updates.doi ?? document.doi

  updates.metadataStatus = deriveMetadataStatus({
    title: effectiveTitle,
    authors: effectiveAuthors,
    year: effectiveYear,
    doi: effectiveDoi,
    workType: provenance.work?.workType,
    organization: provenance.work?.presentation?.organization,
  })
  updates.metadataProvenance = serializeMetadataProvenance(provenance)

  return updates
}

export function markMetadataFieldsAsUserEdited(
  existingValue: string | undefined,
  fields: EditableMetadataField[],
) {
  const edited = parseMetadataUserEditedFields(existingValue)
  for (const field of fields) {
    edited[field] = true
  }
  return serializeMetadataUserEditedFields(edited)
}

export function markMetadataFieldProvenanceAsUser(
  existingValue: string | undefined,
  fields: EditableMetadataField[],
) {
  const provenance = parseMetadataProvenance(existingValue)
  for (const field of fields) {
    if (field === 'abstract' || field === 'isbn' || field === 'publisher' || field === 'citationKey') continue
    provenance[field as import('@/lib/types').DocumentMetadataField] = provenanceEntry('user', 'Edited manually in the document details view.', 1)
  }
  return serializeMetadataProvenance(provenance)
}
