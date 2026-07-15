import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyPdfWorkType, requiresDoiForWorkType } from './document-work-type-service'
import type { PdfPageWords } from './document-processing'

function page(text: string, width = 1280, height = 720): PdfPageWords {
  const tokens = text.split(/\s+/)
  return { pageNumber: 1, text, width, height, words: tokens.map((token) => ({ text: token, left: 0, top: 0, width: 20, height: 14, confidence: 1 })) }
}

test('detects a landscape low-density slide deck', () => {
  const result = classifyPdfWorkType({ pages: Array.from({ length: 8 }, () => page('Quarterly research presentation results')) })
  assert.equal(result.workType, 'presentation')
  assert.ok(result.detection.confidence > 0.7)
})

test('detects a structured research paper', () => {
  const result = classifyPdfWorkType({ pages: [page('Abstract Introduction Methods Results Discussion References', 612, 792)] })
  assert.equal(result.workType, 'journal_article')
})

test('leaves an ambiguous document as other', () => {
  assert.equal(classifyPdfWorkType({ pages: [page('Notes', 612, 792)] }).workType, 'other')
})

test('requires DOI only for actual paper work types', () => {
  assert.equal(requiresDoiForWorkType('journal_article'), true)
  assert.equal(requiresDoiForWorkType('conference_paper'), true)
  assert.equal(requiresDoiForWorkType('presentation'), false)
  assert.equal(requiresDoiForWorkType('report'), false)
})
