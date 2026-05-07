import test from 'node:test'
import assert from 'node:assert/strict'
import { extractDocumentInsights, parseDocumentInsightsPayload, validateRemoteAiModel } from '@/lib/services/document-ai-service'

test('parseDocumentInsightsPayload normalizes structured AI output', () => {
  const result = parseDocumentInsightsPayload(JSON.stringify({
    keywords: ['Large Language Models', 'Text Mining', 'large language models'],
    summary: '  A concise summary.  ',
    classification: {
      category: 'AI',
      topic: 'NLP',
      confidence: 0.88,
      matchedKeywords: ['large language models'],
      suggestedTags: ['nlp', 'llm'],
    },
  }))

  assert.deepEqual(result.keywords, ['large language models', 'text mining'])
  assert.equal(result.summary, 'A concise summary.')
  assert.equal(result.classification?.category, 'AI')
  assert.equal(result.classification?.topic, 'NLP')
})

test('validateRemoteAiModel only rejects blank model values', () => {
  assert.equal(validateRemoteAiModel('google', 'gemini-2.5-flash'), true)
  assert.equal(validateRemoteAiModel('openai', 'gpt-5-custom-preview'), true)
  assert.equal(validateRemoteAiModel('anthropic', ''), false)
})

test('extractDocumentInsights fails early when key is missing', async () => {
  await assert.rejects(
    () => extractDocumentInsights({
      provider: 'openai',
      model: 'gpt-4.1-mini',
      apiKey: '',
      mode: 'page1',
      text: 'hello world',
    }),
    /API key is not configured/i,
  )
})
