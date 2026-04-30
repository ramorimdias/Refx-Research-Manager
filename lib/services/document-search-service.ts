'use client'

import MiniSearch, { type Options as MiniSearchOptions, type Query as MiniSearchQuery } from 'minisearch'
import * as repo from '@/lib/repositories/local-db'
import { appDataDir, exists, join, mkdir, readTextFile, remove, writeTextFile } from '@/lib/tauri/client'
import { extractAndPersistDocumentText, getDocumentPlainText, readPersistedDocumentText } from '@/lib/services/document-text-service'

type IndexedDocument = {
  id: string
  text: string
}

type PersistedSearchIndex = {
  version: number
  indexedTextHashes: Record<string, string>
  miniSearchJson: string
}

type SearchIndexState = {
  dirty: boolean
  index: MiniSearch<IndexedDocument>
  indexedTextHashes: Record<string, string>
}

export type DocumentSearchQuery =
  | string
  | {
      combineWith: 'AND' | 'OR' | 'AND_NOT'
      queries: DocumentSearchQuery[]
    }

export type ExtractedDocumentText = {
  documentId: string
  extractedTextPath: string
  extractedAt: string
  hasExtractedText: boolean
  isOcrCandidate: boolean
  pageCount: number
  text: string
  textExtractionStatus: repo.DbProcessingStatus
  textHash: string
}

export type IndexedDocumentResult = {
  documentId: string
  indexed: boolean
  textHash?: string
}

export type SearchDocumentsOptions = {
  combineWith?: 'AND' | 'OR' | 'AND_NOT'
  documentIds?: string[]
  flexibility?: number
  limit?: number
  onProgress?: (update: SearchProgressUpdate) => void
}

export type SearchProgressUpdate = {
  detail?: string
  processed: number
  stage: 'synchronizing' | 'querying' | 'ranking' | 'page_hits' | 'complete'
  total: number
}

export type DocumentSearchMatchPosition = {
  end: number
  start: number
}

export type DocumentSearchPageHit = {
  matchedText: string
  pageNumber: number
  positions: DocumentSearchMatchPosition[]
  snippet: string
}

export type DocumentSearchResult = {
  documentId: string
  matchedQueryTerms: string[]
  matchedTerms: string[]
  occurrenceCounts: Record<string, number>
  pageHits: DocumentSearchPageHit[]
  relevancePercent: number
  score: number
  snippet?: string
  title: string
}

const INDEX_VERSION = 1
const SEARCH_DIR_NAME = 'search'
const SEARCH_INDEX_FILE_NAME = 'documents.minisearch.json'
const INDEX_OPTIONS: MiniSearchOptions<IndexedDocument> = {
  fields: ['text'],
  storeFields: [],
}
// The ranking layer keeps MiniSearch retrieval, then reranks candidates with a
// simple weighted formula that stays easy to tune later.
const SEARCH_RELEVANCE_WEIGHTS = {
  bestFieldMatch: 0.45,
  matchTypeQuality: 0.2,
  metadataBoost: 0.1,
  normalizedMiniSearch: 0.25,
} as const
const SEARCH_FIELD_WEIGHTS = {
  abstract: 0.45,
  authors: 0.85,
  commentary: 0.4,
  doi: 0.7,
  extractedText: 0.25,
  filename: 0.75,
  tags: 0.9,
  title: 1,
} as const
const SEARCH_MATCH_TYPE_WEIGHTS = {
  exact: 1,
  fuzzy: 0.65,
  none: 0,
  prefix: 0.85,
  synonym: 0.45,
} as const
const SEARCH_RELEVANCE_PENALTIES = {
  abstractOnly: 0.12,
  extractedTextOnly: 0.2,
  synonymOnly: 0.18,
} as const
const SEARCH_RESULT_CANDIDATE_MULTIPLIER = 4
const SEARCH_RESULT_CANDIDATE_MINIMUM = 100
const OCR_CONFIDENCE_MULTIPLIER_RANGE = {
  max: 1,
  min: 0.88,
} as const
const EXPLORATORY_FLEXIBILITY_THRESHOLD = 65
const FLEXIBLE_FLEXIBILITY_THRESHOLD = 31
const LOCAL_SYNONYM_DICTIONARY = {
  ai: ['artificial intelligence', 'machine learning', 'llm'],
  author: ['researcher', 'writer', 'contributor'],
  citation: ['reference', 'bibliography', 'source'],
  library: ['vault', 'collection', 'repository'],
  map: ['graph', 'network', 'relationship', 'connection'],
  note: ['annotation', 'comment', 'highlight'],
  paper: ['article', 'publication', 'manuscript', 'study'],
  pdf: ['document', 'file', 'paper'],
  tag: ['label', 'category', 'classification'],
} as const

let indexStatePromise: Promise<SearchIndexState> | null = null
let indexOperation = Promise.resolve()

function unique(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)))
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function toAbsoluteScore(score: number) {
  return Number(score.toFixed(1))
}

function firstNonEmptyText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = (value ?? '').trim()
    if (normalized) return normalized
  }

  return ''
}

function clamp01(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function normalizeSearchText(input: string) {
  return stripDiacritics(
    firstNonEmptyText(input)
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[\p{Pd}]+/gu, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

function normalizeQueryFragment(input: string) {
  return normalizeSearchText(input).replace(/\s+/g, ' ').trim()
}

function stripDiacritics(input: string) {
  return input.normalize('NFKD').replace(/\p{M}+/gu, '')
}

function normalizeWordToken(input: string) {
  return normalizeQueryFragment(input)
}

function tokenizeWordLike(input: string) {
  return Array.from(normalizeWordToken(input).matchAll(/\b[\p{L}\p{N}]+\b/gu), (match) => match[0] ?? '')
    .filter(Boolean)
}

function countOccurrences(text: string, term: string) {
  const normalizedText = normalizeQueryFragment(text)
  const normalizedTerm = normalizeQueryFragment(term)
  if (!normalizedText || !normalizedTerm) return 0
  const matches = normalizedText.match(new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, 'g'))
  return matches?.length ?? 0
}

function countCompactOccurrences(text: string, term: string) {
  const normalizedText = normalizeWordToken(text).replace(/[\s-]+/g, '')
  const normalizedTerm = normalizeWordToken(term).replace(/[\s-]+/g, '')
  if (!normalizedText || !normalizedTerm) return 0

  let occurrences = 0
  let startIndex = 0
  while (startIndex < normalizedText.length) {
    const foundIndex = normalizedText.indexOf(normalizedTerm, startIndex)
    if (foundIndex < 0) break
    occurrences += 1
    startIndex = foundIndex + normalizedTerm.length
  }

  return occurrences
}

function buildOccurrenceCounts(
  query: DocumentSearchQuery,
  document: repo.DbDocument,
  persistedText?: Awaited<ReturnType<typeof readPersistedDocumentText>> | null,
) {
  const queryTerms = unique(collectPositiveQueryStrings(query).map((entry) => normalizeQueryFragment(entry)).filter(Boolean))
  const searchableText = [
    document.title,
    parseDocumentAuthors(document).join(' '),
    document.abstractText,
    persistedText?.text ?? document.searchText ?? '',
  ].filter(Boolean).join(' ')

  return Object.fromEntries(
    queryTerms.map((term) => {
      const spacedCount = countOccurrences(searchableText, term)
      const compactCount = term.includes(' ') ? 0 : countCompactOccurrences(searchableText, term)
      return [term, Math.max(spacedCount, compactCount)]
    }),
  )
}

function collectPositiveQueryStrings(query: DocumentSearchQuery, include = true): string[] {
  if (typeof query === 'string') {
    return include ? [query] : []
  }

  if (query.combineWith === 'AND_NOT') {
    return query.queries.flatMap((entry, index) => collectPositiveQueryStrings(entry, include && index === 0))
  }

  return query.queries.flatMap((entry) => collectPositiveQueryStrings(entry, include))
}

function buildQuerySignals(query: DocumentSearchQuery) {
  const strings = unique(collectPositiveQueryStrings(query).map((entry) => normalizeQueryFragment(entry)).filter(Boolean))
  const phrases = strings.filter((entry) => entry.includes(' '))
  const tokens = unique(
    strings
      .flatMap((entry) => entry.split(/\s+/))
      .map((entry) => normalizeQueryFragment(entry))
      .filter((entry) => entry.length >= 2),
  )

  return {
    strings,
    phrases,
    tokens,
  }
}

type SearchCorpus = {
  abstractText: string
  authorText: string
  compactText: string
  commentaryText: string
  doiText: string
  fileName: string
  metadataText: string
  tagText: string
  titleText: string
  text: string
  words: string[]
}

function buildSearchCorpus(document: repo.DbDocument, persistedText?: Awaited<ReturnType<typeof readPersistedDocumentText>> | null): SearchCorpus {
  const title = normalizeWordToken(document.title ?? '')
  const authors = normalizeWordToken(parseDocumentAuthors(document).join(' '))
  const metadataCorpus = normalizeWordToken(buildDocumentMetadataCorpus(document))
  const abstractText = normalizeWordToken(document.abstractText ?? '')
  const commentaryText = normalizeWordToken(document.commentaryText ?? '')
  const doiText = normalizeWordToken(document.doi ?? '')
  const tagText = normalizeWordToken(document.tags.join(' '))
  const fileName = normalizeWordToken(extractDocumentFileName(document))
  const fullText = persistedText?.text ?? document.searchText ?? ''
  const text = normalizeWordToken([title, authors, metadataCorpus, commentaryText, fullText].join(' '))
  return {
    abstractText,
    authorText: authors,
    compactText: text.replace(/[\s-]+/g, ''),
    commentaryText,
    doiText,
    fileName,
    metadataText: metadataCorpus,
    tagText,
    titleText: title,
    text,
    words: tokenizeWordLike(text),
  }
}

function extractDocumentFileName(document: Pick<repo.DbDocument, 'importedFilePath' | 'sourcePath' | 'title'>) {
  const filePath = firstNonEmptyText(document.importedFilePath, document.sourcePath)
  if (!filePath) return document.title ?? ''
  return filePath.split(/[\\/]/).pop() ?? filePath
}

function buildIndexedDocumentText(document: repo.DbDocument, searchText: string) {
  return [
    document.title,
    parseDocumentAuthors(document).join(' '),
    document.abstractText,
    document.tags.join(' '),
    document.year ? String(document.year) : '',
    document.publisher,
    document.citationKey,
    document.doi,
    extractDocumentFileName(document),
    document.commentaryText,
    searchText,
  ]
    .map((entry) => firstNonEmptyText(entry))
    .filter(Boolean)
    .join(' ')
}

function levenshteinDistance(left: string, right: string) {
  if (left === right) return 0
  if (!left.length) return right.length
  if (!right.length) return left.length

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  const current = new Array<number>(right.length + 1).fill(0)

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    current[0] = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost,
      )
    }

    for (let rightIndex = 0; rightIndex <= right.length; rightIndex += 1) {
      previous[rightIndex] = current[rightIndex] ?? previous[rightIndex]
    }
  }

  return previous[right.length] ?? 0
}

function buildAllowedFuzzyDistance(token: string, flexibility = 35) {
  if (flexibility < FLEXIBLE_FLEXIBILITY_THRESHOLD) return 0
  if (token.length <= 4) return flexibility >= EXPLORATORY_FLEXIBILITY_THRESHOLD ? 1 : 0
  if (token.length <= 8) return flexibility >= EXPLORATORY_FLEXIBILITY_THRESHOLD ? 1 : 0
  return flexibility >= 85 ? 2 : 1
}

// The existing slider drives strict, balanced, and exploratory search modes in place.
function buildSliderThreshold(flexibility = 35) {
  return 0.05 + (clamp01(flexibility / 100) * 0.55)
}

function collectSynonymVariants(term: string, flexibility = 35) {
  const normalized = normalizeQueryFragment(term)
  if (!normalized || flexibility < EXPLORATORY_FLEXIBILITY_THRESHOLD) return []

  const direct = LOCAL_SYNONYM_DICTIONARY[normalized as keyof typeof LOCAL_SYNONYM_DICTIONARY] ?? []
  return unique(direct.map((entry) => normalizeQueryFragment(entry)).filter(Boolean))
}

function buildExpandedLeafQuery(term: string, flexibility = 35): DocumentSearchQuery {
  const variants = unique([normalizeQueryFragment(term), ...collectSynonymVariants(term, flexibility)].filter(Boolean))
  if (variants.length <= 1) return term
  return {
    combineWith: 'OR',
    queries: variants,
  }
}

function buildExpandedQuery(query: DocumentSearchQuery, flexibility = 35): DocumentSearchQuery {
  if (typeof query === 'string') {
    return buildExpandedLeafQuery(query, flexibility)
  }

  return {
    ...query,
    queries: query.queries.map((entry) => buildExpandedQuery(entry, flexibility)),
  }
}

function buildSearchPlan(query: DocumentSearchQuery, flexibility = 35) {
  const expandedQuery = buildExpandedQuery(query, flexibility)
  const originalSignals = buildQuerySignals(query)
  const expandedSignals = buildQuerySignals(expandedQuery)
  const synonymStrings = expandedSignals.strings.filter((entry) => !originalSignals.strings.includes(entry))
  const synonymTokens = expandedSignals.tokens.filter((entry) => !originalSignals.tokens.includes(entry))

  return {
    expandedQuery,
    expandedSignals,
    originalSignals,
    synonymStrings: new Set(synonymStrings),
    synonymTokens: new Set(synonymTokens),
  }
}

function hasVerifiedTokenMatch(corpus: SearchCorpus, token: string, flexibility = 35) {
  const normalizedToken = normalizeWordToken(token)
  if (!normalizedToken) return false
  if (corpus.words.includes(normalizedToken)) return true

  for (let index = 0; index < corpus.words.length - 1; index += 1) {
    const left = corpus.words[index] ?? ''
    const right = corpus.words[index + 1] ?? ''
    if (left && right && `${left}${right}` === normalizedToken) {
      return true
    }
  }

  const allowedDistance = buildAllowedFuzzyDistance(normalizedToken, flexibility)
  if (allowedDistance <= 0) return false

  return corpus.words.some((word) => {
    if (!word) return false
    if (word[0] !== normalizedToken[0]) return false
    if (Math.abs(word.length - normalizedToken.length) > allowedDistance) return false
    return levenshteinDistance(word, normalizedToken) <= allowedDistance
  })
}

function hasVerifiedPhraseMatch(corpus: SearchCorpus, phrase: string) {
  const normalizedPhrase = normalizeWordToken(phrase)
  if (!normalizedPhrase) return false
  if (corpus.text.includes(normalizedPhrase)) return true
  return corpus.compactText.includes(normalizedPhrase.replace(/[\s-]+/g, ''))
}

function documentMatchesLeaf(corpus: SearchCorpus, query: string, flexibility = 35) {
  const normalized = normalizeQueryFragment(query)
  if (!normalized) return true

  const candidates = unique([normalized, ...collectSynonymVariants(normalized, flexibility)])
  return candidates.some((candidate) => (
    candidate.includes(' ')
      ? hasVerifiedPhraseMatch(corpus, candidate)
      : hasVerifiedTokenMatch(corpus, candidate, flexibility)
  ))
}

function documentMatchesQuery(corpus: SearchCorpus, query: DocumentSearchQuery, flexibility = 35): boolean {
  if (typeof query === 'string') {
    return documentMatchesLeaf(corpus, query, flexibility)
  }

  if (query.combineWith === 'AND') {
    return query.queries.every((entry) => documentMatchesQuery(corpus, entry, flexibility))
  }

  if (query.combineWith === 'OR') {
    return query.queries.some((entry) => documentMatchesQuery(corpus, entry, flexibility))
  }

  const [positive, ...negative] = query.queries
  if (!positive || !documentMatchesQuery(corpus, positive, flexibility)) return false
  return negative.every((entry) => !documentMatchesQuery(corpus, entry, flexibility))
}

function parseDocumentAuthors(document: repo.DbDocument) {
  if (typeof document.authors !== 'string') return []

  try {
    const parsed = JSON.parse(document.authors) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === 'string')
    }
  } catch {
    // fall through to the raw author string below
  }

  return document.authors ? [document.authors] : []
}

function buildDocumentMetadataCorpus(document: repo.DbDocument) {
  const authors = parseDocumentAuthors(document).join(' ')
  const tags = document.tags.join(' ')
  return normalizeQueryFragment([
    document.title,
    authors,
    document.abstractText,
    document.citationKey,
    document.doi,
    document.publisher,
    tags,
    extractDocumentFileName(document),
    document.year ? String(document.year) : '',
  ].join(' '))
}

function buildFieldTokenCoverageScore(field: string, tokens: string[]) {
  if (tokens.length === 0) return 0
  const normalizedField = normalizeQueryFragment(field)
  if (!normalizedField) return 0

  const matchedTokenCount = tokens.filter((token) => normalizedField.includes(token)).length
  return clamp01(matchedTokenCount / tokens.length)
}

function buildExactFieldMatchScore(field: string, strings: string[]) {
  const normalizedField = normalizeQueryFragment(field)
  if (!normalizedField) return 0
  return strings.some((entry) => normalizeQueryFragment(entry) === normalizedField) ? 1 : 0
}

function buildArrayExactMatchScore(values: string[], strings: string[]) {
  if (values.length === 0 || strings.length === 0) return 0
  const normalizedValues = values.map((value) => normalizeQueryFragment(value)).filter(Boolean)
  if (normalizedValues.length === 0) return 0
  return strings.some((entry) => normalizedValues.includes(normalizeQueryFragment(entry))) ? 1 : 0
}

function buildOccurrenceBoost(totalOccurrences: number) {
  return Math.min(0.15, Math.log1p(Math.max(0, totalOccurrences)) * 0.04)
}

type SearchMatchType = keyof typeof SEARCH_MATCH_TYPE_WEIGHTS
type SearchFieldName = keyof typeof SEARCH_FIELD_WEIGHTS

type SearchFieldEvaluation = {
  field: SearchFieldName
  fieldScore: number
  matched: boolean
  matchType: SearchMatchType
}

function hasExactTokenMatch(fieldWords: string[], token: string) {
  return fieldWords.includes(token)
}

function hasPrefixTokenMatch(fieldWords: string[], token: string) {
  return fieldWords.some((word) => word.startsWith(token) && word !== token)
}

function hasFuzzyTokenMatch(fieldWords: string[], token: string, flexibility = 35) {
  const allowedDistance = buildAllowedFuzzyDistance(token, flexibility)
  if (allowedDistance <= 0) return false

  return fieldWords.some((word) => {
    if (!word) return false
    if (word[0] !== token[0]) return false
    if (Math.abs(word.length - token.length) > allowedDistance) return false
    return levenshteinDistance(word, token) <= allowedDistance
  })
}

function buildSignalsFromSets(strings: Set<string>, tokens: Set<string>) {
  const nextStrings = Array.from(strings)
  return {
    strings: nextStrings,
    phrases: nextStrings.filter((entry) => entry.includes(' ')),
    tokens: Array.from(tokens),
  }
}

function classifyFieldMatchType(fieldText: string, querySignals: ReturnType<typeof buildQuerySignals>, flexibility = 35): SearchMatchType {
  const fieldWords = tokenizeWordLike(fieldText)
  const compactField = fieldText.replace(/[\s-]+/g, '')

  for (const phrase of querySignals.strings) {
    if (!phrase) continue
    if (fieldText.includes(phrase)) return 'exact'
    if (compactField.includes(phrase.replace(/[\s-]+/g, ''))) return 'exact'
  }

  for (const token of querySignals.tokens) {
    if (!token) continue
    if (hasExactTokenMatch(fieldWords, token)) return 'exact'
  }

  for (const token of querySignals.tokens) {
    if (!token) continue
    if (hasPrefixTokenMatch(fieldWords, token)) return 'prefix'
  }

  for (const token of querySignals.tokens) {
    if (!token) continue
    if (hasFuzzyTokenMatch(fieldWords, token, flexibility)) return 'fuzzy'
  }

  return 'none'
}

function evaluateSearchFields(corpus: SearchCorpus, plan: ReturnType<typeof buildSearchPlan>, flexibility = 35) {
  const synonymSignals = buildSignalsFromSets(plan.synonymStrings, plan.synonymTokens)
  const fields: Record<SearchFieldName, string> = {
    abstract: corpus.abstractText,
    authors: corpus.authorText,
    commentary: corpus.commentaryText,
    doi: corpus.doiText,
    extractedText: corpus.text,
    filename: corpus.fileName,
    tags: corpus.tagText,
    title: corpus.titleText,
  }

  const evaluations = (Object.entries(fields) as Array<[SearchFieldName, string]>).map(([field, text]) => {
    const directMatchType = classifyFieldMatchType(text, plan.originalSignals, flexibility)
    const synonymMatchType = directMatchType === 'none' ? classifyFieldMatchType(text, synonymSignals, flexibility) : 'none'
    const matchType = directMatchType !== 'none' ? directMatchType : synonymMatchType !== 'none' ? 'synonym' : 'none'
    return {
      field,
      fieldScore: matchType === 'none' ? 0 : SEARCH_FIELD_WEIGHTS[field],
      matched: matchType !== 'none',
      matchType,
    } satisfies SearchFieldEvaluation
  })

  const bestMatch = evaluations.reduce<SearchFieldEvaluation>(
    (current, candidate) => {
      const currentComposite = current.fieldScore * SEARCH_MATCH_TYPE_WEIGHTS[current.matchType]
      const candidateComposite = candidate.fieldScore * SEARCH_MATCH_TYPE_WEIGHTS[candidate.matchType]
      return candidateComposite > currentComposite ? candidate : current
    },
    { field: 'extractedText', fieldScore: 0, matched: false, matchType: 'none' },
  )

  return {
    bestFieldMatchScore: bestMatch.fieldScore,
    bestMatch,
    evaluations,
    matchTypeQualityScore: SEARCH_MATCH_TYPE_WEIGHTS[bestMatch.matchType],
  }
}

function isSynonymOnlyMatch(matchedTerms: string[], matchedQueryTerms: string[], originalSignals: ReturnType<typeof buildQuerySignals>, synonymStrings: Set<string>, synonymTokens: Set<string>) {
  const normalizedMatched = unique([...matchedTerms, ...matchedQueryTerms].map((entry) => normalizeQueryFragment(entry)).filter(Boolean))
  if (normalizedMatched.some((entry) => originalSignals.strings.includes(entry) || originalSignals.tokens.includes(entry))) {
    return false
  }
  return normalizedMatched.some((entry) => synonymStrings.has(entry) || synonymTokens.has(entry))
}

function buildMetadataBoostScore(
  document: repo.DbDocument,
  corpus: SearchCorpus,
  plan: ReturnType<typeof buildSearchPlan>,
  occurrenceCounts: Record<string, number>,
) {
  const exactTitleBoost = buildExactFieldMatchScore(document.title, plan.originalSignals.strings)
  const exactTagBoost = buildArrayExactMatchScore(document.tags, [...plan.originalSignals.strings, ...plan.originalSignals.tokens])
  const authorBoost = buildFieldTokenCoverageScore(corpus.authorText, plan.originalSignals.tokens)
  const fileNameBoost = buildFieldTokenCoverageScore(corpus.fileName, plan.originalSignals.tokens)
  const doiBoost = buildFieldTokenCoverageScore(corpus.doiText, plan.originalSignals.tokens)
  const totalOccurrences = Object.values(occurrenceCounts).reduce((sum, count) => sum + Math.max(0, count), 0)

  return clamp01(
    Math.max(
      exactTitleBoost,
      exactTagBoost * 0.95,
      authorBoost * 0.9,
      fileNameBoost * 0.8,
      doiBoost * 0.75,
    ) + buildOccurrenceBoost(totalOccurrences),
  )
}

function buildRelevanceScoreBreakdown(
  document: repo.DbDocument,
  corpus: SearchCorpus,
  plan: ReturnType<typeof buildSearchPlan>,
  rawMiniSearchScore: number,
  topRawScore: number,
  matchedTerms: string[],
  matchedQueryTerms: string[],
  occurrenceCounts: Record<string, number>,
) {
  const normalizedMiniSearchScore = topRawScore > 0 ? clamp01(rawMiniSearchScore / topRawScore) : 0
  const { bestFieldMatchScore, bestMatch, evaluations, matchTypeQualityScore } = evaluateSearchFields(corpus, plan)
  const metadataBoostScore = buildMetadataBoostScore(document, corpus, plan, occurrenceCounts)
  const hasHighValueFieldMatch = evaluations.some((evaluation) => (
    evaluation.matched
    && ['title', 'tags', 'authors', 'filename', 'doi'].includes(evaluation.field)
  ))
  const hasAbstractMatch = evaluations.some((evaluation) => evaluation.field === 'abstract' && evaluation.matched)
  const hasExtractedTextMatch = evaluations.some((evaluation) => evaluation.field === 'extractedText' && evaluation.matched)
  const isDirectMatch = evaluations.some((evaluation) => evaluation.matched && evaluation.matchType !== 'synonym')

  let finalScore = (
    normalizedMiniSearchScore * SEARCH_RELEVANCE_WEIGHTS.normalizedMiniSearch
    + bestFieldMatchScore * SEARCH_RELEVANCE_WEIGHTS.bestFieldMatch
    + matchTypeQualityScore * SEARCH_RELEVANCE_WEIGHTS.matchTypeQuality
    + metadataBoostScore * SEARCH_RELEVANCE_WEIGHTS.metadataBoost
  )

  if (!isDirectMatch && isSynonymOnlyMatch(
    matchedTerms,
    matchedQueryTerms,
    plan.originalSignals,
    plan.synonymStrings,
    plan.synonymTokens,
  )) {
    finalScore -= SEARCH_RELEVANCE_PENALTIES.synonymOnly
  }

  if (hasAbstractMatch && !hasHighValueFieldMatch && !hasExtractedTextMatch) {
    finalScore -= SEARCH_RELEVANCE_PENALTIES.abstractOnly
  }

  if (hasExtractedTextMatch && !hasHighValueFieldMatch && !hasAbstractMatch) {
    finalScore -= SEARCH_RELEVANCE_PENALTIES.extractedTextOnly
  }

  finalScore = clamp01(finalScore)

  return {
    bestFieldMatchScore,
    bestMatch,
    evaluations,
    finalScore,
    matchTypeQualityScore,
    metadataBoostScore,
    normalizedMiniSearchScore,
    relevancePercent: Math.round(finalScore * 100),
  }
}

function buildOcrConfidenceWeight(activeSource: 'native' | 'ocr', ocrConfidence?: number) {
  if (activeSource !== 'ocr' || typeof ocrConfidence !== 'number') return 1
  const confidenceRatio = clamp01(ocrConfidence / 100)
  return OCR_CONFIDENCE_MULTIPLIER_RANGE.min
    + (OCR_CONFIDENCE_MULTIPLIER_RANGE.max - OCR_CONFIDENCE_MULTIPLIER_RANGE.min) * confidenceRatio
}

function buildSnippetAtPosition(text: string, start: number, end: number, radius = 110) {
  const normalizedText = firstNonEmptyText(text)
  if (!normalizedText) return ''

  const safeStart = Math.max(0, start)
  const safeEnd = Math.min(normalizedText.length, Math.max(end, safeStart))
  const snippetStart = Math.max(0, safeStart - radius)
  const snippetEnd = Math.min(normalizedText.length, safeEnd + radius)
  const prefix = snippetStart > 0 ? '...' : ''
  const suffix = snippetEnd < normalizedText.length ? '...' : ''
  return `${prefix}${normalizedText.slice(snippetStart, snippetEnd).trim()}${suffix}`
}

function collectMatchPositions(text: string, terms: string[], maxPositions = 12) {
  const normalizedText = firstNonEmptyText(text)
  const positions: DocumentSearchMatchPosition[] = []

  for (const term of unique(terms).sort((left, right) => right.length - left.length)) {
    if (!term.trim()) continue
    const expression = new RegExp(escapeRegExp(term), 'gi')
    let match: RegExpExecArray | null

    while ((match = expression.exec(normalizedText)) && positions.length < maxPositions) {
      const start = match.index ?? 0
      const end = start + match[0].length
      const overlaps = positions.some((position) => start < position.end && end > position.start)
      if (!overlaps) {
        positions.push({ start, end })
      }
      if (expression.lastIndex === start) {
        expression.lastIndex += 1
      }
    }

    if (positions.length >= maxPositions) break
  }

  return positions.sort((left, right) => left.start - right.start)
}

function buildPageHits(
  persistedText: Awaited<ReturnType<typeof readPersistedDocumentText>>,
  query: DocumentSearchQuery,
  matchedTerms: string[],
  matchedQueryTerms: string[],
  limit = 5,
) {
  if (!persistedText?.pages?.length) return []

  const { phrases, tokens } = buildQuerySignals(query)
  const effectiveTerms = matchedTerms.length > 0 ? matchedTerms : matchedQueryTerms.length > 0 ? matchedQueryTerms : tokens
  const preferredTerms = phrases.length > 0 ? phrases : effectiveTerms
  const pageHits: DocumentSearchPageHit[] = []

  for (const page of persistedText.pages) {
    if (pageHits.length >= limit) break

    const phrasePositions = phrases.length > 0 ? collectMatchPositions(page.text, phrases) : []
    const fallbackPositions = phrasePositions.length > 0 ? [] : collectMatchPositions(page.text, preferredTerms)
    const positions = phrasePositions.length > 0 ? phrasePositions : fallbackPositions
    if (positions.length === 0) continue

    const firstPosition = positions[0]
    if (!firstPosition) continue

    pageHits.push({
      matchedText: page.text.slice(firstPosition.start, firstPosition.end),
      pageNumber: page.pageNumber,
      positions,
      snippet: buildSnippetAtPosition(page.text, firstPosition.start, firstPosition.end),
    })
  }

  return pageHits
}

export async function findDocumentPageHits(documentId: string, query: DocumentSearchQuery, limit = 100) {
  if (isQueryEmpty(query)) return []

  const document = await repo.getDocumentById(documentId)
  if (!document) return []

  const persistedText = await readPersistedDocumentText(document)
  const pageHits = buildPageHits(persistedText, query, [], [], limit)

  return pageHits.flatMap((pageHit, index) => {
    const firstPosition = pageHit.positions[0]
    if (!firstPosition) return []

    return [{
      index,
      matchedText: pageHit.matchedText,
      snippet: pageHit.snippet,
      start: firstPosition.start,
      end: firstPosition.end,
      estimatedPage: pageHit.pageNumber,
    }]
  })
}

async function buildNormalizedSearchScore(
  document: repo.DbDocument,
  plan: ReturnType<typeof buildSearchPlan>,
  rawScore: number,
  topRawScore: number,
  matchedTerms: string[],
  matchedQueryTerms: string[],
  occurrenceCounts: Record<string, number>,
) {
  const persistedText = await readPersistedDocumentText(document)
  const corpus = buildSearchCorpus(document, persistedText)
  const relevance = buildRelevanceScoreBreakdown(
    document,
    corpus,
    plan,
    rawScore,
    topRawScore,
    matchedTerms,
    matchedQueryTerms,
    occurrenceCounts,
  )

  return {
    persistedText,
    relevancePercent: relevance.relevancePercent,
    score: toAbsoluteScore(relevance.finalScore * 100),
    snippet: buildSnippet(
      firstNonEmptyText(persistedText?.text, document.searchText),
      matchedTerms.length > 0 ? matchedTerms : matchedQueryTerms,
    ),
  }
}

async function sha256Hex(input: string) {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

async function getSearchIndexPath() {
  const base = await appDataDir()
  const searchDir = await join(base, SEARCH_DIR_NAME)
  await mkdir(searchDir, { recursive: true })
  return join(searchDir, SEARCH_INDEX_FILE_NAME)
}

async function persistSearchIndexState(state: SearchIndexState) {
  if (state.index.dirtCount > 0) {
    await state.index.vacuum({
      batchSize: Math.max(100, state.index.termCount || 100),
      batchWait: 0,
    })
  }

  const indexPath = await getSearchIndexPath()
  const payload: PersistedSearchIndex = {
    version: INDEX_VERSION,
    indexedTextHashes: state.indexedTextHashes,
    miniSearchJson: JSON.stringify(state.index),
  }

  await writeTextFile(indexPath, JSON.stringify(payload))
  state.dirty = false
}

async function createEmptySearchIndexState() {
  return {
    dirty: false,
    index: new MiniSearch(INDEX_OPTIONS),
    indexedTextHashes: {},
  } satisfies SearchIndexState
}

async function loadSearchIndexState() {
  const indexPath = await getSearchIndexPath()
  if (!(await exists(indexPath))) {
    return createEmptySearchIndexState()
  }

  try {
    const raw = await readTextFile(indexPath)
    const parsed = JSON.parse(raw) as Partial<PersistedSearchIndex>
    if (parsed.version !== INDEX_VERSION || typeof parsed.miniSearchJson !== 'string') {
      return createEmptySearchIndexState()
    }

    return {
      dirty: false,
      index: MiniSearch.loadJSON(parsed.miniSearchJson, INDEX_OPTIONS),
      indexedTextHashes: parsed.indexedTextHashes ?? {},
    } satisfies SearchIndexState
  } catch {
    return createEmptySearchIndexState()
  }
}

async function getSearchIndexState() {
  if (!indexStatePromise) {
    indexStatePromise = loadSearchIndexState()
  }

  return indexStatePromise
}

function withIndexLock<T>(operation: () => Promise<T>) {
  const next = indexOperation.then(operation, operation)
  indexOperation = next.then(
    () => undefined,
    () => undefined,
  )
  return next
}

async function ensureDocumentTextHash(document: repo.DbDocument) {
  const searchText = firstNonEmptyText(await getDocumentPlainText(document))
  if (!searchText) return null
  if (document.textHash) return document.textHash

  const textHash = await sha256Hex(searchText)
  const textExtractedAt = document.textExtractedAt ?? new Date().toISOString()
  const updated = await repo.updateDocumentMetadata(document.id, {
    extractedTextPath: document.extractedTextPath,
    searchText: searchText !== document.searchText ? searchText : undefined,
    textExtractedAt,
    textHash,
  })

  document.textHash = updated?.textHash ?? textHash
  document.textExtractedAt = updated?.textExtractedAt ?? textExtractedAt
  return document.textHash
}

async function discardDocument(state: SearchIndexState, documentId: string) {
  let changed = false

  if (state.index.has(documentId)) {
    state.index.discard(documentId)
    changed = true
  }

  if (state.indexedTextHashes[documentId]) {
    delete state.indexedTextHashes[documentId]
    changed = true
  }

  if (changed) {
    state.dirty = true
  }

  return changed
}

async function upsertDocument(state: SearchIndexState, document: repo.DbDocument) {
  const searchText = firstNonEmptyText(await getDocumentPlainText(document))
  if (!searchText) {
    return discardDocument(state, document.id)
  }

  if (searchText !== firstNonEmptyText(document.searchText)) {
    const updated = await repo.updateDocumentMetadata(document.id, {
      searchText,
    })
    if (updated) {
      document.searchText = updated.searchText
    } else {
      document.searchText = searchText
    }
  }

  await ensureDocumentTextHash(document)
  const indexedText = buildIndexedDocumentText(document, searchText)
  const indexTextHash = await sha256Hex(indexedText)
  if (state.index.has(document.id) && state.indexedTextHashes[document.id] === indexTextHash) {
    return false
  }

  const indexedDocument: IndexedDocument = {
    id: document.id,
    text: indexedText,
  }

  if (state.index.has(document.id)) {
    state.index.replace(indexedDocument)
  } else {
    state.index.add(indexedDocument)
  }

  state.indexedTextHashes[document.id] = indexTextHash
  state.dirty = true
  return true
}

async function ensureIndexSynchronized(
  state: SearchIndexState,
  documents: repo.DbDocument[],
  onProgress?: (update: SearchProgressUpdate) => void,
) {
  const documentsById = new Map(documents.map((document) => [document.id, document]))
  let changed = false
  let processed = 0
  const total = documents.length

  const emitProgress = (detail: string) => {
    onProgress?.({
      detail,
      processed,
      stage: 'synchronizing',
      total,
    })
  }

  emitProgress('Checking indexed document text…')

  for (const indexedId of Object.keys(state.indexedTextHashes)) {
    if (!documentsById.has(indexedId)) {
      changed = (await discardDocument(state, indexedId)) || changed
    }
  }

  for (const document of documents) {
    const hasSearchText = Boolean(firstNonEmptyText(await getDocumentPlainText(document)))
    const isIndexed = state.index.has(document.id)
    if (!hasSearchText) {
      changed = (await discardDocument(state, document.id)) || changed
      processed += 1
      emitProgress(`Preparing ${processed}/${total}`)
      continue
    }

    const textHash = await ensureDocumentTextHash(document)
    if (!textHash) continue
    if (!isIndexed || state.indexedTextHashes[document.id] !== textHash) {
      changed = (await upsertDocument(state, document)) || changed
    }

    processed += 1
    emitProgress(`Preparing ${processed}/${total}`)
  }

  return changed
}

function isQueryEmpty(query: DocumentSearchQuery): boolean {
  if (typeof query === 'string') {
    return query.trim().length === 0
  }

  return query.queries.every((entry) => isQueryEmpty(entry))
}

function buildFuzzySetting(flexibility = 35) {
  if (flexibility < FLEXIBLE_FLEXIBILITY_THRESHOLD) return false
  return buildSliderThreshold(flexibility)
}

function buildPrefixSetting(flexibility = 35) {
  return flexibility >= 20
}

function buildSnippet(text: string, terms: string[], radius = 110) {
  const normalizedText = firstNonEmptyText(text)
  if (!normalizedText) return undefined

  const candidates = unique(terms).sort((left, right) => right.length - left.length)
  for (const candidate of candidates) {
    const expression = new RegExp(escapeRegExp(candidate), 'i')
    const match = expression.exec(normalizedText)
    if (!match) continue

    const start = Math.max(0, match.index - radius)
    const end = Math.min(normalizedText.length, match.index + candidate.length + radius)
    const prefix = start > 0 ? '...' : ''
    const suffix = end < normalizedText.length ? '...' : ''
    return `${prefix}${normalizedText.slice(start, end).trim()}${suffix}`
  }

  return normalizedText.slice(0, radius * 2).trim()
}

export async function extractDocumentText(documentId: string): Promise<ExtractedDocumentText> {
  const extracted = await extractAndPersistDocumentText(documentId)
  return {
    documentId: extracted.documentId,
    extractedTextPath: extracted.extractedTextPath,
    extractedAt: extracted.extractedAt,
    hasExtractedText: extracted.hasExtractedText,
    isOcrCandidate: extracted.isOcrCandidate,
    pageCount: extracted.pageCount,
    text: extracted.text,
    textExtractionStatus: extracted.textExtractionStatus,
    textHash: extracted.textHash,
  }
}

export async function indexDocument(documentId: string): Promise<IndexedDocumentResult> {
  return withIndexLock(async () => {
    let document = await repo.getDocumentById(documentId)
    if (!document) {
      const state = await getSearchIndexState()
      const changed = await discardDocument(state, documentId)
      if (changed) {
        await persistSearchIndexState(state)
      }

      return {
        documentId,
        indexed: false,
      }
    }

    const state = await getSearchIndexState()
    const storedText = firstNonEmptyText(await getDocumentPlainText(document))
    if (!storedText) {
      const changed = await discardDocument(state, documentId)
      if (changed) {
        await persistSearchIndexState(state)
      }

      const processedAt = new Date().toISOString()
      await repo.updateDocumentMetadata(documentId, {
        indexingStatus: 'pending',
        processingUpdatedAt: processedAt,
        lastProcessedAt: processedAt,
      })

      return {
        documentId,
        indexed: false,
      }
    }

    const changed = await upsertDocument(state, document)
    if (changed) {
      await persistSearchIndexState(state)
    }

    const processedAt = new Date().toISOString()
    await repo.updateDocumentMetadata(documentId, {
      indexingStatus: state.index.has(documentId) ? 'complete' : 'pending',
      processingUpdatedAt: processedAt,
      lastProcessedAt: processedAt,
    })

    return {
      documentId,
      indexed: state.index.has(documentId),
      textHash: document.textHash ?? state.indexedTextHashes[documentId],
    }
  })
}

export async function removeDocumentFromIndex(documentId: string) {
  return withIndexLock(async () => {
    const state = await getSearchIndexState()
    const changed = await discardDocument(state, documentId)
    if (changed) {
      await persistSearchIndexState(state)
    }

    return changed
  })
}

export async function clearDocumentSearchIndex() {
  return withIndexLock(async () => {
    indexStatePromise = null
    const indexPath = await getSearchIndexPath()
    if (await exists(indexPath)) {
      await remove(indexPath)
    }
  })
}

export async function searchDocuments(query: DocumentSearchQuery, options: SearchDocumentsOptions = {}): Promise<DocumentSearchResult[]> {
  if (isQueryEmpty(query)) return []

  return withIndexLock(async () => {
    const plan = buildSearchPlan(query, options.flexibility)
    const documents = await repo.listAllDocuments()
    const state = await getSearchIndexState()
    const allowedIds = options.documentIds?.length ? new Set(options.documentIds) : null
    const searchableDocuments = allowedIds
      ? documents.filter((document) => allowedIds.has(document.id))
      : documents

    options.onProgress?.({
      detail: 'Preparing the local search index…',
      processed: 0,
      stage: 'synchronizing',
      total: searchableDocuments.length,
    })

    const synchronized = await ensureIndexSynchronized(state, documents, options.onProgress)
    if (synchronized) {
      await persistSearchIndexState(state)
    }

    options.onProgress?.({
      detail: 'Querying the local index…',
      processed: searchableDocuments.length,
      stage: 'querying',
      total: searchableDocuments.length,
    })

    const rawResults = state.index.search(plan.expandedQuery as MiniSearchQuery, {
      combineWith: typeof query === 'string' ? (options.combineWith ?? 'AND') : undefined,
      filter: allowedIds ? (result) => allowedIds.has(String(result.id)) : undefined,
      fuzzy: buildFuzzySetting(options.flexibility),
      prefix: buildPrefixSetting(options.flexibility),
    })

    const documentsById = new Map(documents.map((document) => [document.id, document]))
    const candidateLimit = Math.max(
      (options.limit ?? 100) * SEARCH_RESULT_CANDIDATE_MULTIPLIER,
      SEARCH_RESULT_CANDIDATE_MINIMUM,
    )
    const candidateResults = rawResults.slice(0, candidateLimit)
    const topRawScore = candidateResults[0]?.score ?? 0
    const mappedResults: Array<DocumentSearchResult & {
      persistedText: Awaited<ReturnType<typeof readPersistedDocumentText>>
    }> = []
    const totalCandidateResults = candidateResults.length
    let rankedCount = 0

    for (const result of candidateResults) {
      const document = documentsById.get(String(result.id))
      if (!document) continue

      const matchedTerms = unique(result.terms)
      const matchedQueryTerms = unique(result.queryTerms)
      const persistedText = await readPersistedDocumentText(document)
      const occurrenceCounts = buildOccurrenceCounts(query, document, persistedText)
      const ranked = await buildNormalizedSearchScore(
        document,
        plan,
        result.score,
        topRawScore,
        matchedTerms,
        matchedQueryTerms,
        occurrenceCounts,
      )
      const corpus = buildSearchCorpus(document, persistedText)
      rankedCount += 1
      options.onProgress?.({
        detail: `Scoring ${rankedCount}/${totalCandidateResults || 1}`,
        processed: rankedCount,
        stage: 'ranking',
        total: totalCandidateResults || 1,
      })

      if (!documentMatchesQuery(corpus, query, options.flexibility)) {
        continue
      }

      mappedResults.push({
        documentId: document.id,
        matchedQueryTerms,
        matchedTerms,
        occurrenceCounts,
        pageHits: [],
        persistedText,
        relevancePercent: ranked.relevancePercent,
        score: ranked.score,
        snippet: ranked.snippet,
        title: document.title,
      })
    }

    mappedResults.sort((left, right) => (
      right.relevancePercent - left.relevancePercent
      || right.score - left.score
      || left.title.localeCompare(right.title)
    ))
    const limitedResults = mappedResults.slice(0, options.limit ?? 100)
    const finalResults = limitedResults.map(({ persistedText, ...result }, index) => {
        options.onProgress?.({
          detail: `Resolving page hits ${index + 1}/${limitedResults.length || 1}`,
          processed: index + 1,
          stage: 'page_hits',
          total: limitedResults.length || 1,
        })
        const pageHits = buildPageHits(persistedText, query, result.matchedTerms, result.matchedQueryTerms)
        return {
          ...result,
          pageHits,
          snippet: pageHits[0]?.snippet ?? result.snippet,
        }
      })
    options.onProgress?.({
      detail: `${finalResults.length} result${finalResults.length === 1 ? '' : 's'} ready`,
      processed: searchableDocuments.length,
      stage: 'complete',
      total: searchableDocuments.length,
    })
    return finalResults
  })
}

export const __searchTesting = {
  buildMetadataBoostScore,
  buildOccurrenceBoost,
  buildRelevanceScoreBreakdown,
  buildIndexedDocumentText,
  buildSearchCorpus,
  buildSearchPlan,
  documentMatchesQuery,
  normalizeQueryFragment,
  normalizeSearchText,
}
