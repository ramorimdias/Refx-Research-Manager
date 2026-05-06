import test from 'node:test'
import assert from 'node:assert/strict'
import type { Document } from '@/lib/types'
import type { DbReference } from '@/lib/repositories/local-db'
import {
  findMatchingDocuments,
  findReusableReference,
  matchReferenceToDocument,
  normalizeDoi,
} from '@/lib/services/work-reference-service'

function createDocument(overrides: Partial<Document> = {}): Document {
  return {
    abstract: '',
    addedAt: new Date('2026-01-01T00:00:00.000Z'),
    authors: ['Jane Doe'],
    citationKey: 'doe2026',
    classificationStatus: 'pending',
    commentCount: 0,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    documentType: 'pdf',
    favorite: false,
    hasExtractedText: true,
    hasOcr: false,
    hasOcrText: false,
    id: overrides.id ?? 'doc-1',
    indexingStatus: 'complete',
    libraryId: 'lib-1',
    metadataStatus: 'complete',
    notesCount: 0,
    ocrStatus: 'not_needed',
    rating: 0,
    readingStage: 'unread',
    tagSuggestionStatus: 'pending',
    tags: [],
    textExtractionStatus: 'complete',
    title: overrides.title ?? 'Untitled',
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

function createReference(overrides: Partial<DbReference> = {}): DbReference {
  return {
    abstract: '',
    authors: 'Jane Doe',
    bibtex: '',
    citationKey: 'doe2026',
    createdAt: '2026-01-01T00:00:00.000Z',
    documentId: 'doc-1',
    doi: '',
    id: overrides.id ?? 'ref-1',
    isManual: false,
    title: overrides.title ?? 'Untitled',
    type: 'article',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

test('normalizeDoi strips DOI URL prefixes and trailing punctuation', () => {
  assert.equal(normalizeDoi('https://doi.org/10.1000/182.'), '10.1000/182')
  assert.equal(normalizeDoi('DOI: 10.1000/XYZ;'), '10.1000/xyz')
})

test('findMatchingDocuments prefers DOI exact matches', () => {
  const exactDoi = createDocument({
    id: 'doi-doc',
    title: 'Thermal Management in Electric Vehicles',
    doi: '10.1000/xyz',
    authors: ['Jane Doe'],
    year: 2024,
  })
  const titleOnly = createDocument({
    id: 'title-doc',
    title: 'Thermal Management in Electric Vehicles',
    doi: '10.1000/other',
    authors: ['Jane Doe'],
    year: 2024,
  })

  const [best] = findMatchingDocuments([titleOnly, exactDoi], {
    title: 'Thermal Management in Electric Vehicles',
    authors: 'Jane Doe',
    year: 2024,
    doi: 'doi:10.1000/xyz',
  })

  assert.equal(best?.document.id, 'doi-doc')
  assert.equal(best?.score, 1)
})

test('matchReferenceToDocument reports title_firstauthor_year for strong title matches', () => {
  const document = createDocument({
    id: 'doc-match',
    title: 'Battery Safety in High-Voltage Systems',
    authors: ['Alice Martin'],
    year: 2023,
  })

  const match = matchReferenceToDocument([document], {
    title: 'Battery Safety in High-Voltage Systems',
    authors: 'Alice Martin',
    year: 2023,
  })

  assert.equal(match.matchedDocumentId, 'doc-match')
  assert.equal(match.matchMethod, 'title_firstauthor_year')
  assert.ok((match.matchConfidence ?? 0) >= 0.9)
})

test('findReusableReference reuses by normalized DOI before title matching', () => {
  const doiReference = createReference({
    id: 'doi-ref',
    title: 'Something Else',
    doi: '10.1000/reused',
    authors: 'Someone',
  })
  const titleReference = createReference({
    id: 'title-ref',
    title: 'Reusable Title',
    authors: 'Jane Doe',
    year: 2025,
  })

  const matchedByDoi = findReusableReference([titleReference, doiReference], {
    title: 'Reusable Title',
    authors: 'Jane Doe',
    year: 2025,
    doi: 'https://doi.org/10.1000/reused.',
  })
  const matchedByTitle = findReusableReference([titleReference], {
    title: 'Reusable Title',
    authors: 'Jane Doe',
    year: 2025,
  })

  assert.equal(matchedByDoi?.id, 'doi-ref')
  assert.equal(matchedByTitle?.id, 'title-ref')
})
