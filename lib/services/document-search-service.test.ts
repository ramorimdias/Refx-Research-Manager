import test from 'node:test'
import assert from 'node:assert/strict'
import type { DbDocument } from '@/lib/repositories/local-db'
import { __searchTesting } from '@/lib/services/document-search-service'

function createDocument(overrides: Partial<DbDocument> = {}): DbDocument {
  return {
    abstractText: '',
    authors: JSON.stringify(['Jane Doe']),
    classificationStatus: 'pending',
    commentaryText: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    favorite: false,
    hasExtractedText: true,
    hasOcr: false,
    hasOcrText: false,
    id: overrides.id ?? 'doc-1',
    indexingStatus: 'complete',
    libraryId: 'lib-1',
    metadataStatus: 'complete',
    ocrStatus: 'not_needed',
    rating: 0,
    readingStage: 'unread',
    searchText: '',
    tagSuggestionStatus: 'pending',
    tags: [],
    textExtractionStatus: 'complete',
    title: 'Untitled',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function buildRelevance(document: DbDocument, query: string, flexibility = 80, rawMiniSearchScore = 12, topRawScore = 12, matchedTerms?: string[], occurrenceCounts?: Record<string, number>) {
  const plan = __searchTesting.buildSearchPlan(query, flexibility)
  const corpus = __searchTesting.buildSearchCorpus(document, null)
  const counts = occurrenceCounts ?? { [query]: 1 }
  return __searchTesting.buildRelevanceScoreBreakdown(
    document,
    corpus,
    plan,
    rawMiniSearchScore,
    topRawScore,
    matchedTerms ?? [query],
    [query],
    counts,
  )
}

test('normalization removes diacritics and normalizes punctuation', () => {
  assert.equal(__searchTesting.normalizeSearchText('r\u00e9sum\u00e9'), 'resume')
  assert.equal(__searchTesting.normalizeSearchText('COVID-19'), 'covid 19')
  assert.equal(__searchTesting.normalizeSearchText('co-operate'), 'co operate')
})

test('exact title match ranks above repeated abstract matches', () => {
  const titleDoc = createDocument({
    title: 'Graph theory basics',
    abstractText: '',
    searchText: 'Graph theory basics',
  })
  const abstractDoc = createDocument({
    id: 'abstract-doc',
    title: 'Networks in science',
    abstractText: 'graph graph graph graph graph graph graph graph graph graph',
    searchText: 'graph graph graph graph graph graph graph graph graph graph',
  })

  const titleRelevance = buildRelevance(titleDoc, 'graph')
  const abstractRelevance = buildRelevance(abstractDoc, 'graph', 80, 10, 10, ['graph'], { graph: 20 })

  assert.ok(titleRelevance.relevancePercent > abstractRelevance.relevancePercent)
})

test('exact tag match ranks above repeated extracted-text matches', () => {
  const tagDoc = createDocument({
    title: 'Document networks',
    tags: ['graph'],
    searchText: 'A concise note.',
  })
  const extractedDoc = createDocument({
    id: 'extracted-doc',
    title: 'Document networks',
    tags: [],
    searchText: 'graph graph graph graph graph graph graph graph graph graph graph graph',
  })

  const tagRelevance = buildRelevance(tagDoc, 'graph')
  const extractedRelevance = buildRelevance(extractedDoc, 'graph', 80, 10, 10, ['graph'], { graph: 24 })

  assert.ok(tagRelevance.relevancePercent > extractedRelevance.relevancePercent)
})

test('author match ranks above abstract-only match', () => {
  const authorDoc = createDocument({
    title: 'Collaborative systems',
    authors: JSON.stringify(['Graph Researcher']),
    abstractText: '',
    searchText: '',
  })
  const abstractDoc = createDocument({
    id: 'abstract-doc',
    title: 'Collaborative systems',
    authors: JSON.stringify(['Jane Doe']),
    abstractText: 'A graph perspective on teams.',
    searchText: '',
  })

  const authorRelevance = buildRelevance(authorDoc, 'researcher')
  const abstractRelevance = buildRelevance(abstractDoc, 'graph')

  assert.ok(authorRelevance.relevancePercent > abstractRelevance.relevancePercent)
})

test('synonym-only match ranks below direct match', () => {
  const directDoc = createDocument({
    title: 'Paper methods',
    searchText: 'Paper methods',
  })
  const synonymDoc = createDocument({
    id: 'synonym-doc',
    title: 'Article methods',
    searchText: 'Article methods',
  })

  const directRelevance = buildRelevance(directDoc, 'paper')
  const synonymRelevance = buildRelevance(synonymDoc, 'paper', 80, 12, 12, ['article'], { article: 2 })

  assert.ok(directRelevance.relevancePercent > synonymRelevance.relevancePercent)
})

test('occurrence boost is capped and cannot dominate', () => {
  const small = __searchTesting.buildOccurrenceBoost(2)
  const huge = __searchTesting.buildOccurrenceBoost(10000)

  assert.ok(huge <= 0.15)
  assert.ok(huge >= small)
  assert.equal(huge, 0.15)
})

test('relevancePercent is always between 0 and 100', () => {
  const weakDoc = createDocument({
    title: 'Article methods',
    searchText: 'article methods article methods',
  })
  const strongDoc = createDocument({
    id: 'strong-doc',
    title: 'Graph methods',
    tags: ['graph'],
    searchText: 'Graph methods',
  })

  const weak = buildRelevance(weakDoc, 'paper', 80, 2, 20, ['article'], { article: 12 })
  const strong = buildRelevance(strongDoc, 'graph', 80, 20, 20, ['graph'], { graph: 3 })

  assert.ok(weak.relevancePercent >= 0 && weak.relevancePercent <= 100)
  assert.ok(strong.relevancePercent >= 0 && strong.relevancePercent <= 100)
})
