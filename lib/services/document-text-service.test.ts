import test from 'node:test'
import assert from 'node:assert/strict'
import { isOcrCandidate } from '@/lib/services/document-text-service'

test('isOcrCandidate treats empty text as OCR-worthy', () => {
  assert.equal(isOcrCandidate('', 1), true)
})

test('isOcrCandidate flags very short extracted text', () => {
  assert.equal(isOcrCandidate('short text', 1), true)
})

test('isOcrCandidate flags sparse multi-page text', () => {
  const sparseText = 'a'.repeat(250)
  assert.equal(isOcrCandidate(sparseText, 5), true)
})

test('isOcrCandidate accepts dense extracted text', () => {
  const denseText = 'battery '.repeat(220)
  assert.equal(isOcrCandidate(denseText, 4), false)
})
