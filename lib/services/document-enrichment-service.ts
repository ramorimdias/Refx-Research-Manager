'use client'

import type { DbDocument } from '@/lib/repositories/local-db'
import { getResolvedSemanticScholarApiKey, loadAppSettings, type StoredAppSettings } from '@/lib/app-settings'
import {
  lookupCrossrefMetadata,
  lookupOpenAlexMetadata,
  lookupOpenAlexMetadataCandidates,
  lookupSemanticScholarMetadata,
  lookupSemanticScholarMetadataCandidates,
  type OnlineMetadataMatch,
  type OnlineMetadataMatchStrategy,
  type SniffedPdfMetadata,
} from '@/lib/services/bibtex-sniffer'
import { deriveMetadataStatus, type LocalPdfMetadata } from '@/lib/services/document-metadata-service'
import type { DocumentMetadataProvenanceEntry, MetadataFieldSource } from '@/lib/types'

export type OnlineMetadataEnrichmentSettings = Pick<
  StoredAppSettings,
  'crossrefContactEmail' | 'semanticScholarApiKey'
>

export type DocumentMetadataEnrichmentResult = {
  matches: Array<{
    matchedBy: OnlineMetadataMatchStrategy
    source: 'crossref' | 'semantic_scholar' | 'openalex'
  }>
  metadata: LocalPdfMetadata
}

export type DocumentMetadataCandidate = {
  authors: string[]
  bibtex?: string
  citationKey?: string
  citationCount?: number
  doi?: string
  id: string
  matchedBy: OnlineMetadataMatchStrategy
  metadata: LocalPdfMetadata
  source: 'crossref' | 'semantic_scholar' | 'openalex' | 'bibtex_manual'
  suggestedTags?: string[]
  title?: string
  abstract?: string
  year?: number
}

export type MetadataCandidateProvider = 'semantic_scholar' | 'openalex' | 'crossref'

function extractBibtexField(bibtex: string, field: string) {
  const match = bibtex.match(new RegExp(`${field}\\s*=\\s*[{"]([\\s\\S]*?)[}"]\\s*(?:,|$)`, 'i'))
  return match?.[1]?.replace(/\s+/g, ' ').trim() || undefined
}

function parseBibtexAuthors(raw?: string) {
  if (!raw) return []
  return raw
    .split(/\s+and\s+/i)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseManualBibtexCandidate(bibtex: string): DocumentMetadataCandidate | null {
  const trimmed = bibtex.trim()
  if (!trimmed.startsWith('@')) return null

  const title = extractBibtexField(trimmed, 'title')
  const authors = parseBibtexAuthors(extractBibtexField(trimmed, 'author'))
  const yearValue = extractBibtexField(trimmed, 'year')
  const doi = extractBibtexField(trimmed, 'doi')
  const citationKey = trimmed.match(/^@\w+\s*\{\s*([^,\s]+)\s*,/i)?.[1]?.trim()
  const year = yearValue ? Number.parseInt(yearValue.replace(/[^\d]/g, ''), 10) : undefined

  if (!title && authors.length === 0 && !year && !doi) return null

  const metadata: LocalPdfMetadata = {
    title,
    authors,
    year: Number.isFinite(year) ? year : undefined,
    doi,
    citationKey,
    provenance: {
      ...(title ? { title: provenanceEntry('user', 'title', 'BibTeX import', 0.95) } : {}),
      ...(authors.length > 0 ? { authors: provenanceEntry('user', 'title', 'BibTeX import', 0.95) } : {}),
      ...(Number.isFinite(year) ? { year: provenanceEntry('user', 'title', 'BibTeX import', 0.93) } : {}),
      ...(doi ? { doi: provenanceEntry('user', 'doi', 'BibTeX import', 0.99) } : {}),
    },
  }

  return {
    authors,
    bibtex: trimmed,
    citationKey,
    doi,
    id: `bibtex_manual:${citationKey ?? title ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    matchedBy: doi ? 'doi' : 'title',
    metadata,
    source: 'bibtex_manual',
    title,
    year: Number.isFinite(year) ? year : undefined,
  }
}

function parseAuthorsValue(value?: string) {
  if (!value) return []

  try {
    const parsed = JSON.parse(value.trim())
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0) : []
  } catch {
    return value ? [value] : []
  }
}

function citationKeyFor(title: string, authors: string[], year?: number) {
  const firstAuthorToken = authors[0]?.split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'unknown'
  const titleToken = title.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'paper'
  return `${firstAuthorToken}${year ?? 'nd'}${titleToken}`
}

function provenanceEntry(
  source: MetadataFieldSource,
  matchedBy: OnlineMetadataMatchStrategy,
  providerLabel: string,
  confidence: number,
): DocumentMetadataProvenanceEntry {
  const matchLabel = matchedBy === 'doi' ? 'DOI' : 'title'
  return {
    source,
    extractedAt: new Date(),
    confidence,
    detail: `${providerLabel} ${matchLabel} match.`,
  }
}

function providerMatchToLocalMetadata(match: OnlineMetadataMatch): LocalPdfMetadata {
  const providerSource: MetadataFieldSource = match.source === 'semantic_scholar'
    ? 'semantic_scholar'
    : match.source === 'openalex'
      ? 'openalex'
      : 'crossref'
  const providerLabel = match.source === 'semantic_scholar'
    ? 'Semantic Scholar'
    : match.source === 'openalex'
      ? 'OpenAlex'
      : 'Crossref'
  const confidence = match.matchedBy === 'doi'
    ? match.source === 'semantic_scholar' ? 0.94 : match.source === 'openalex' ? 0.95 : 0.97
    : match.source === 'semantic_scholar' ? 0.74 : match.source === 'openalex' ? 0.8 : 0.82
  const authors = match.authors ?? []
  const title = match.title?.trim() || undefined

  return {
    title,
    authors,
    year: match.year,
    doi: match.doi,
    abstract: match.abstract,
    citationKey: title ? citationKeyFor(title, authors, match.year) : undefined,
    suggestedTags: match.suggestedTags,
    citationCount: match.citationCount,
    provenance: {
      ...(title ? { title: provenanceEntry(providerSource, match.matchedBy, providerLabel, confidence) } : {}),
      ...(authors.length > 0 ? { authors: provenanceEntry(providerSource, match.matchedBy, providerLabel, confidence) } : {}),
      ...(match.year ? { year: provenanceEntry(providerSource, match.matchedBy, providerLabel, confidence - 0.04) } : {}),
      ...(match.doi ? { doi: provenanceEntry(providerSource, match.matchedBy, providerLabel, 1) } : {}),
    },
  }
}

function toMetadataCandidate(match: OnlineMetadataMatch): DocumentMetadataCandidate {
  return {
    authors: match.authors ?? [],
    abstract: match.abstract,
    bibtex: match.bibtex,
    citationKey: match.citationKey,
    citationCount: match.citationCount,
    doi: match.doi,
    id: `${match.source}:${match.matchedBy}:${match.doi ?? match.title ?? crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    matchedBy: match.matchedBy,
    metadata: providerMatchToLocalMetadata(match),
    source: match.source,
    suggestedTags: match.suggestedTags?.map((entry) => entry.name),
    title: match.title,
    year: match.year,
  }
}

function mergeProviderMetadata(
  base: LocalPdfMetadata | null,
  incoming: LocalPdfMetadata,
) {
  if (!base) {
    return incoming
  }

  return {
    title: base.title ?? incoming.title,
    authors: base.authors && base.authors.length > 0 ? base.authors : incoming.authors,
    year: base.year ?? incoming.year,
    doi: base.doi ?? incoming.doi,
    abstract: base.abstract ?? incoming.abstract,
    pageCount: base.pageCount ?? incoming.pageCount,
    citationKey: base.citationKey ?? incoming.citationKey,
    suggestedTags: base.suggestedTags && base.suggestedTags.length > 0 ? base.suggestedTags : incoming.suggestedTags,
    citationCount: base.citationCount ?? incoming.citationCount,
    provenance: {
      ...incoming.provenance,
      ...base.provenance,
    },
  } satisfies LocalPdfMetadata
}

function effectiveMetadataStatus(seed: SniffedPdfMetadata) {
  return deriveMetadataStatus({
    title: seed.title,
    authors: seed.authors,
    year: seed.year,
    doi: seed.doi,
  })
}

function applyMatchToSeed(seed: SniffedPdfMetadata, match: OnlineMetadataMatch): SniffedPdfMetadata {
  return {
    ...seed,
    title: seed.title ?? match.title,
    authors: seed.authors && seed.authors.length > 0 ? seed.authors : match.authors,
    year: seed.year ?? match.year,
    doi: seed.doi ?? match.doi,
    citationKey: seed.citationKey ?? match.citationKey,
  }
}

export function buildDocumentMetadataSeed(
  document: Pick<DbDocument, 'title' | 'authors' | 'year' | 'doi' | 'citationKey'>,
  localMetadata?: Pick<LocalPdfMetadata, 'authors' | 'citationKey' | 'doi' | 'title' | 'year'>,
): SniffedPdfMetadata {
  return {
    authors: localMetadata?.authors ?? parseAuthorsValue(document.authors),
    citationKey: localMetadata?.citationKey ?? document.citationKey,
    doi: localMetadata?.doi ?? document.doi,
    source: 'offline',
    title: localMetadata?.title ?? document.title,
    year: localMetadata?.year ?? document.year,
  }
}

export async function loadOnlineMetadataEnrichmentSettings(isDesktopApp: boolean) {
  const settings = await loadAppSettings(isDesktopApp)
  return {
    crossrefContactEmail: settings.crossrefContactEmail,
    semanticScholarApiKey: getResolvedSemanticScholarApiKey(settings),
  } satisfies OnlineMetadataEnrichmentSettings
}

export async function enrichDocumentMetadataOnline(
  seed: SniffedPdfMetadata,
  settings: OnlineMetadataEnrichmentSettings,
): Promise<DocumentMetadataEnrichmentResult | null> {
  let nextSeed = seed
  let metadata: LocalPdfMetadata | null = null
  const matches: DocumentMetadataEnrichmentResult['matches'] = []

  const crossrefMatch = await lookupCrossrefMetadata(nextSeed, {
    contactEmail: settings.crossrefContactEmail,
  })

  if (crossrefMatch) {
    metadata = mergeProviderMetadata(metadata, providerMatchToLocalMetadata(crossrefMatch))
    matches.push({ matchedBy: crossrefMatch.matchedBy, source: crossrefMatch.source })
    nextSeed = applyMatchToSeed(nextSeed, crossrefMatch)
  }

  if (effectiveMetadataStatus(nextSeed) !== 'complete') {
    const openAlexMatch = await lookupOpenAlexMetadata(nextSeed)

    if (openAlexMatch) {
      metadata = mergeProviderMetadata(metadata, providerMatchToLocalMetadata(openAlexMatch))
      matches.push({ matchedBy: openAlexMatch.matchedBy, source: openAlexMatch.source })
      nextSeed = applyMatchToSeed(nextSeed, openAlexMatch)
    }
  }

  if (effectiveMetadataStatus(nextSeed) !== 'complete') {
    const semanticScholarMatch = await lookupSemanticScholarMetadata(nextSeed, {
      apiKey: settings.semanticScholarApiKey,
    })

    if (semanticScholarMatch) {
      metadata = mergeProviderMetadata(metadata, providerMatchToLocalMetadata(semanticScholarMatch))
      matches.push({ matchedBy: semanticScholarMatch.matchedBy, source: semanticScholarMatch.source })
    }
  }

  if (!metadata) {
    return null
  }

  return {
    matches,
    metadata,
  }
}

export async function findDocumentMetadataCandidates(
  seed: SniffedPdfMetadata,
  settings: OnlineMetadataEnrichmentSettings,
  options?: {
    providers?: MetadataCandidateProvider[]
  },
): Promise<DocumentMetadataCandidate[]> {
  const candidates: DocumentMetadataCandidate[] = []
  const providers = options?.providers ?? ['semantic_scholar', 'openalex', 'crossref']

  if (providers.includes('semantic_scholar')) {
    const semanticScholarMatches = await lookupSemanticScholarMetadataCandidates(seed, {
      apiKey: settings.semanticScholarApiKey,
    })

    candidates.push(...semanticScholarMatches.slice(0, 4).map(toMetadataCandidate))
  }

  if (providers.includes('openalex')) {
    const openAlexMatches = await lookupOpenAlexMetadataCandidates(seed)

    candidates.push(...openAlexMatches.slice(0, 4).map(toMetadataCandidate))
  }

  if (providers.includes('crossref')) {
    const crossrefMatch = await lookupCrossrefMetadata(seed, {
      contactEmail: settings.crossrefContactEmail,
    })

    if (crossrefMatch) {
      candidates.push(toMetadataCandidate(crossrefMatch))
    }
  }

  return candidates.filter((candidate, index, allCandidates) =>
    index === allCandidates.findIndex((entry) =>
      entry.source === candidate.source
      && (entry.doi || entry.title) === (candidate.doi || candidate.title),
    ),
  )
}

export function createMetadataCandidateFromBibtex(bibtex: string) {
  return parseManualBibtexCandidate(bibtex)
}
