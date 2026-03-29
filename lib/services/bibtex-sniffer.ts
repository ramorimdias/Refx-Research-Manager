'use client'

import { readFile } from '@tauri-apps/plugin-fs'
import type { SuggestedTag } from '@/lib/types'

export type SniffedPdfMetadata = {
  title?: string
  authors?: string[]
  year?: number
  doi?: string
  citationKey?: string
  bibtex?: string
  abstract?: string
  suggestedTags?: SuggestedTag[]
  citationCount?: number
  source?: 'offline' | 'crossref' | 'semantic_scholar' | 'openalex'
}

export type OnlineMetadataMatchStrategy = 'doi' | 'title'

export type OnlineMetadataMatch = SniffedPdfMetadata & {
  matchedBy: OnlineMetadataMatchStrategy
  source: 'crossref' | 'semantic_scholar' | 'openalex'
}

export type CrossrefLookupConfig = {
  contactEmail?: string
}

export type SemanticScholarLookupConfig = {
  apiKey?: string
}

type CrossrefAuthor = {
  given?: string
  family?: string
  name?: string
}

type CrossrefWork = {
  title?: string[]
  DOI?: string
  author?: CrossrefAuthor[]
  issued?: { 'date-parts'?: number[][] }
  published?: { 'date-parts'?: number[][] }
}

type SemanticScholarAuthor = {
  name?: string
}

type SemanticScholarPaper = {
  title?: string
  year?: number
  authors?: SemanticScholarAuthor[]
  abstract?: string
  citationCount?: number
  fieldsOfStudy?: string[]
  externalIds?: {
    DOI?: string
  }
  tldr?: {
    text?: string
  }
}

type OpenAlexAuthor = {
  author?: {
    display_name?: string
  }
}

type OpenAlexWork = {
  title?: string
  publication_year?: number
  authorships?: OpenAlexAuthor[]
  doi?: string
  abstract_inverted_index?: Record<string, number[]>
  cited_by_count?: number
  keywords?: Array<{ display_name?: string; score?: number }>
  topics?: Array<{ display_name?: string; score?: number }>
  concepts?: Array<{ display_name?: string; score?: number }>
}

type OpenAlexWorksResponse = {
  results?: OpenAlexWork[]
}

function cleanPdfField(value: string) {
  return value
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitAuthors(raw?: string) {
  if (!raw) return []
  return raw
    .split(/,|;|\band\b/gi)
    .map((part) => part.trim())
    .filter(Boolean)
}

function parseDoi(input: string) {
  return input.match(/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i)?.[0]
}

function parseYear(input: string) {
  const value = input.match(/\b(19|20)\d{2}\b/)?.[0]
  if (!value) return undefined
  const year = Number(value)
  return Number.isFinite(year) ? year : undefined
}

function parseTitleFromName(filePath: string) {
  const fileName = filePath.split(/[\\/]/).pop() ?? ''
  return fileName
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function citationKeyFor(title: string, authors: string[], year?: number) {
  const firstAuthorToken = authors[0]?.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'
  const titleToken = title.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'paper'
  return `${firstAuthorToken}${year ?? 'nd'}${titleToken}`
}

function bibtexFor(meta: Required<Pick<SniffedPdfMetadata, 'title'>> & SniffedPdfMetadata) {
  const key = meta.citationKey || citationKeyFor(meta.title, meta.authors ?? [], meta.year)
  const fields = [
    `  title={${meta.title}}`,
    meta.authors?.length ? `  author={${meta.authors.join(' and ')}}` : null,
    meta.year ? `  year={${meta.year}}` : null,
    meta.doi ? `  doi={${meta.doi}}` : null,
  ].filter(Boolean)

  return `@article{${key},\n${fields.join(',\n')}\n}`
}

function parseCrossrefYear(work: CrossrefWork) {
  return work.issued?.['date-parts']?.[0]?.[0] ?? work.published?.['date-parts']?.[0]?.[0]
}

function parseCrossrefAuthors(work: CrossrefWork) {
  return (work.author ?? [])
    .map((author) => {
      const named = [author.given, author.family].filter(Boolean).join(' ').trim()
      return named || author.name || ''
    })
    .filter(Boolean)
}

function parseSemanticScholarAuthors(paper: SemanticScholarPaper) {
  return (paper.authors ?? [])
    .map((author) => author.name?.trim() ?? '')
    .filter(Boolean)
}

function parseOpenAlexAuthors(work: OpenAlexWork) {
  return (work.authorships ?? [])
    .map((entry) => entry.author?.display_name?.trim() ?? '')
    .filter(Boolean)
}

function normalizeSuggestedTagName(input?: string) {
  if (!input) return ''
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function uniqueSuggestedTags(tags: SuggestedTag[]) {
  const seen = new Set<string>()
  return tags.filter((tag) => {
    const normalized = normalizeSuggestedTagName(tag.name)
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function parseSemanticScholarSuggestedTags(paper: SemanticScholarPaper): SuggestedTag[] {
  const fields = (paper.fieldsOfStudy ?? [])
    .map((entry) => normalizeSuggestedTagName(entry))
    .filter(Boolean)

  return uniqueSuggestedTags(
    fields.slice(0, 8).map((name) => ({
      name,
      confidence: 0.7,
    })),
  )
}

function reconstructOpenAlexAbstract(work: OpenAlexWork) {
  const index = work.abstract_inverted_index
  if (!index) return undefined

  const positionedWords: string[] = []
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) {
      positionedWords[position] = word
    }
  }

  const abstract = positionedWords.filter(Boolean).join(' ').trim()
  return abstract || undefined
}

function parseOpenAlexSuggestedTags(work: OpenAlexWork): SuggestedTag[] {
  const fromKeywords = (work.keywords ?? []).map((entry) => ({
    name: normalizeSuggestedTagName(entry.display_name),
    confidence: typeof entry.score === 'number' ? Math.max(0.4, Math.min(0.95, entry.score)) : 0.75,
  }))

  const fromTopics = (work.topics ?? []).map((entry) => ({
    name: normalizeSuggestedTagName(entry.display_name),
    confidence: typeof entry.score === 'number' ? Math.max(0.45, Math.min(0.95, entry.score)) : 0.8,
  }))

  const fromConcepts = (work.concepts ?? []).map((entry) => ({
    name: normalizeSuggestedTagName(entry.display_name),
    confidence: typeof entry.score === 'number' ? Math.max(0.35, Math.min(0.9, entry.score)) : 0.65,
  }))

  return uniqueSuggestedTags(
    [...fromKeywords, ...fromTopics, ...fromConcepts]
      .filter((entry) => entry.name.length >= 3)
      .slice(0, 8),
  )
}

async function fetchJsonWithTimeout(
  url: string,
  options?: {
    headers?: HeadersInit
    timeoutMs?: number
  },
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort('timeout'), options?.timeoutMs ?? 6000)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
    })

    if (!response.ok) return null
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function isAbortLikeError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function appendCrossrefContactEmail(url: string, config?: CrossrefLookupConfig) {
  if (!config?.contactEmail?.trim()) {
    return url
  }

  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}mailto=${encodeURIComponent(config.contactEmail.trim())}`
}

async function fetchCrossrefByDoi(doi: string, config?: CrossrefLookupConfig): Promise<CrossrefWork | null> {
  const encoded = encodeURIComponent(doi)
  const result = await fetchJsonWithTimeout(appendCrossrefContactEmail(`https://api.crossref.org/works/${encoded}`, config))
  return result?.message ?? null
}

async function fetchCrossrefByQuery(title: string, author?: string, config?: CrossrefLookupConfig): Promise<CrossrefWork | null> {
  const parts = [title, author].filter(Boolean)
  if (!parts.length) return null

  const query = encodeURIComponent(parts.join(' '))
  const url = appendCrossrefContactEmail(`https://api.crossref.org/works?rows=1&query.bibliographic=${query}`, config)
  const result = await fetchJsonWithTimeout(url)
  return result?.message?.items?.[0] ?? null
}

function semanticScholarHeaders(config?: SemanticScholarLookupConfig): HeadersInit | undefined {
  const apiKey = config?.apiKey?.trim()
  if (!apiKey) return undefined
  return {
    'x-api-key': apiKey,
  }
}

async function fetchSemanticScholarByDoi(
  doi: string,
  config?: SemanticScholarLookupConfig,
): Promise<SemanticScholarPaper | null> {
  const fields = encodeURIComponent('title,authors,year,abstract,citationCount,fieldsOfStudy,tldr,externalIds')
  const encoded = encodeURIComponent(`DOI:${doi}`)
  return fetchJsonWithTimeout(
    `https://api.semanticscholar.org/graph/v1/paper/${encoded}?fields=${fields}`,
    { headers: semanticScholarHeaders(config) },
  ) as Promise<SemanticScholarPaper | null>
}

async function fetchSemanticScholarByQuery(
  title: string,
  config?: SemanticScholarLookupConfig,
): Promise<SemanticScholarPaper[]> {
  const query = encodeURIComponent(title)
  const fields = encodeURIComponent('title,authors,year,abstract,citationCount,fieldsOfStudy,tldr,externalIds')
  const result = await fetchJsonWithTimeout(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${query}&limit=4&fields=${fields}`,
    { headers: semanticScholarHeaders(config) },
  ) as { data?: SemanticScholarPaper[] } | null

  return result?.data?.slice(0, 4) ?? []
}

async function fetchOpenAlexByDoi(doi: string): Promise<OpenAlexWork | null> {
  const rawDoi = doi.replace(/^doi:\s*/i, '').trim()
  const doiVariants = [
    rawDoi,
    rawDoi.toLowerCase(),
    `https://doi.org/${rawDoi}`,
    `http://doi.org/${rawDoi}`,
  ]

  for (const variant of doiVariants) {
    const filter = encodeURIComponent(`doi:${variant}`)
    const result = await fetchJsonWithTimeout(
      `https://api.openalex.org/works?filter=${filter}&per-page=1`,
    ) as OpenAlexWorksResponse | null

    const work = result?.results?.[0] ?? null
    if (work) return work
  }

  return null
}

async function fetchOpenAlexByQuery(title: string, author?: string): Promise<OpenAlexWork[]> {
  const cleanTitle = title.trim()
  if (!cleanTitle) return []

  const titleSearch = encodeURIComponent(`title.search:${cleanTitle}`)
  const titleOnlyResult = await fetchJsonWithTimeout(
    `https://api.openalex.org/works?filter=${titleSearch}&per-page=4`,
  ) as OpenAlexWorksResponse | null

  const lowerAuthor = author?.trim().toLowerCase()
  const titleOnlyMatches = (titleOnlyResult?.results ?? []).filter((work) => {
    if (!lowerAuthor) return true
    return parseOpenAlexAuthors(work).some((name) => name.toLowerCase().includes(lowerAuthor))
  })

  if (titleOnlyMatches.length > 0) return titleOnlyMatches.slice(0, 4)

  const broadQuery = [cleanTitle, author?.trim()].filter(Boolean).join(' ')
  const search = encodeURIComponent(broadQuery)
  const result = await fetchJsonWithTimeout(
    `https://api.openalex.org/works?search=${search}&per-page=4`,
  ) as OpenAlexWorksResponse | null

  const broadMatches = (result?.results ?? []).filter((work) => {
    if (!lowerAuthor) return true
    return parseOpenAlexAuthors(work).some((name) => name.toLowerCase().includes(lowerAuthor))
  })

  return (broadMatches.length > 0 ? broadMatches : (result?.results ?? [])).slice(0, 4)
}

function normalizeMetadata(metadata: SniffedPdfMetadata): SniffedPdfMetadata {
  if (!metadata.title) return metadata
  const authors = metadata.authors ?? []
  const citationKey = metadata.citationKey || citationKeyFor(metadata.title, authors, metadata.year)

  return {
    ...metadata,
    authors,
    citationKey,
    bibtex: metadata.bibtex || bibtexFor({ ...metadata, citationKey, authors, title: metadata.title }),
  }
}

export async function lookupCrossrefMetadata(
  metadata: SniffedPdfMetadata,
  config?: CrossrefLookupConfig,
): Promise<OnlineMetadataMatch | null> {
  const base = normalizeMetadata(metadata)
  if (!base.doi) return null

  const work = await fetchCrossrefByDoi(base.doi, config)
  const matchedBy: OnlineMetadataMatchStrategy | null = work ? 'doi' : null

  if (!work || !matchedBy) return null

  const title = work.title?.[0]?.trim() || base.title
  const authors = parseCrossrefAuthors(work)
  const year = parseCrossrefYear(work) ?? base.year
  const doi = work.DOI || base.doi

  return {
    ...normalizeMetadata({
      ...base,
      title,
      authors: authors.length ? authors : base.authors,
      year,
      doi,
      source: 'crossref',
    }),
    matchedBy,
    source: 'crossref',
  }
}

export async function lookupSemanticScholarMetadata(
  metadata: SniffedPdfMetadata,
  config?: SemanticScholarLookupConfig,
): Promise<OnlineMetadataMatch | null> {
  const matches = await lookupSemanticScholarMetadataCandidates(metadata, config)
  return matches[0] ?? null
}

export async function lookupSemanticScholarMetadataCandidates(
  metadata: SniffedPdfMetadata,
  config?: SemanticScholarLookupConfig,
): Promise<OnlineMetadataMatch[]> {
  const base = normalizeMetadata(metadata)
  const matches: OnlineMetadataMatch[] = []

  if (base.doi) {
    const paper = await fetchSemanticScholarByDoi(base.doi, config)
    if (paper) {
      const authors = parseSemanticScholarAuthors(paper)
      matches.push({
        ...normalizeMetadata({
          ...base,
          title: paper.title?.trim() || base.title,
          authors: authors.length ? authors : base.authors,
          year: paper.year ?? base.year,
          doi: paper.externalIds?.DOI || base.doi,
          abstract: paper.abstract?.trim() || paper.tldr?.text?.trim() || base.abstract,
          suggestedTags: parseSemanticScholarSuggestedTags(paper),
          citationCount: paper.citationCount,
          source: 'semantic_scholar',
        }),
        matchedBy: 'doi',
        source: 'semantic_scholar',
      })
    }
  }

  if (matches.length === 0 && base.title) {
    const papers = await fetchSemanticScholarByQuery(base.title, config)
    for (const paper of papers.slice(0, 4)) {
      const authors = parseSemanticScholarAuthors(paper)
      matches.push({
        ...normalizeMetadata({
          ...base,
          title: paper.title?.trim() || base.title,
          authors: authors.length ? authors : base.authors,
          year: paper.year ?? base.year,
          doi: paper.externalIds?.DOI || base.doi,
          abstract: paper.abstract?.trim() || paper.tldr?.text?.trim() || base.abstract,
          suggestedTags: parseSemanticScholarSuggestedTags(paper),
          citationCount: paper.citationCount,
          source: 'semantic_scholar',
        }),
        matchedBy: 'title',
        source: 'semantic_scholar',
      })
    }
  }

  return matches
}

export async function lookupOpenAlexMetadata(
  metadata: SniffedPdfMetadata,
): Promise<OnlineMetadataMatch | null> {
  const matches = await lookupOpenAlexMetadataCandidates(metadata)
  return matches[0] ?? null
}

export async function lookupOpenAlexMetadataCandidates(
  metadata: SniffedPdfMetadata,
): Promise<OnlineMetadataMatch[]> {
  const base = normalizeMetadata(metadata)
  const matches: OnlineMetadataMatch[] = []

  if (base.doi) {
    const work = await fetchOpenAlexByDoi(base.doi)
    if (work) {
      const authors = parseOpenAlexAuthors(work)
      matches.push({
        ...normalizeMetadata({
          ...base,
          title: work.title?.trim() || base.title,
          authors: authors.length ? authors : base.authors,
          year: work.publication_year ?? base.year,
          doi: work.doi || base.doi,
          abstract: reconstructOpenAlexAbstract(work) || base.abstract,
          suggestedTags: parseOpenAlexSuggestedTags(work),
          citationCount: work.cited_by_count,
          source: 'openalex',
        }),
        matchedBy: 'doi',
        source: 'openalex',
      })
    }
  }

  if (matches.length === 0 && base.title) {
    const works = await fetchOpenAlexByQuery(base.title, base.authors?.[0])
    for (const work of works.slice(0, 4)) {
      const authors = parseOpenAlexAuthors(work)
      matches.push({
        ...normalizeMetadata({
          ...base,
          title: work.title?.trim() || base.title,
          authors: authors.length ? authors : base.authors,
          year: work.publication_year ?? base.year,
          doi: work.doi || base.doi,
          abstract: reconstructOpenAlexAbstract(work) || base.abstract,
          suggestedTags: parseOpenAlexSuggestedTags(work),
          citationCount: work.cited_by_count,
          source: 'openalex',
        }),
        matchedBy: 'title',
        source: 'openalex',
      })
    }
  }

  return matches
}

export async function enrichWithCrossrefMetadata(
  metadata: SniffedPdfMetadata,
  config?: CrossrefLookupConfig,
): Promise<SniffedPdfMetadata> {
  const matched = await lookupCrossrefMetadata(metadata, config)
  return matched ?? normalizeMetadata(metadata)
}

export async function sniffPdfMetadataOffline(filePath: string): Promise<SniffedPdfMetadata> {
  try {
    const bytes = await readFile(filePath)
    const sample = bytes.slice(0, 240_000)
    const text = new TextDecoder('latin1', { fatal: false }).decode(sample)

    const rawTitle = text.match(/\/Title\s*\(([\s\S]{1,300}?)\)/)?.[1]
    const rawAuthor = text.match(/\/Author\s*\(([\s\S]{1,300}?)\)/)?.[1]

    const titleFromPdf = rawTitle ? cleanPdfField(rawTitle) : undefined
    const authorsFromPdf = splitAuthors(rawAuthor ? cleanPdfField(rawAuthor) : undefined)

    const fileNameTitle = parseTitleFromName(filePath)
    const title = titleFromPdf && titleFromPdf.length > 2 ? titleFromPdf : fileNameTitle

    const doi = parseDoi(text) ?? parseDoi(filePath)
    const year = parseYear(text) ?? parseYear(filePath)

    return normalizeMetadata({
      title,
      authors: authorsFromPdf,
      year,
      doi,
      source: 'offline',
    })
  } catch (error) {
    console.warn('Metadata sniff failed, using file name fallback:', error)
    const title = parseTitleFromName(filePath)
    return normalizeMetadata({
      title,
      authors: [],
      source: 'offline',
    })
  }
}

export async function sniffPdfMetadata(filePath: string): Promise<SniffedPdfMetadata> {
  const offline = await sniffPdfMetadataOffline(filePath)

  try {
    return await enrichWithCrossrefMetadata(offline)
  } catch (error) {
    if (isAbortLikeError(error)) {
      console.info('Crossref enrichment timed out, using offline metadata only.')
    } else {
      console.warn('Crossref enrichment failed, using offline metadata only:', error)
    }
    return offline
  }
}
