import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getDefaultAiModel,
  getResolvedAiApiKey,
  loadAppSettings,
  validateAiModel,
} from '@/lib/app-settings'

test('loadAppSettings migrates legacy Gemini web settings to Google provider settings', async () => {
  const storage = new Map<string, string>()
  storage.set('refx-settings', JSON.stringify({
    keywordEngine: 'gemini',
    geminiApiKey: 'legacy-google-key',
    geminiModel: 'gemini-3-flash',
  }))

  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      length: storage.size,
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      removeItem: (key: string) => { storage.delete(key) },
      setItem: (key: string, value: string) => { storage.set(key, value) },
      getItem: (key: string) => storage.get(key) ?? null,
    },
  }

  const settings = await loadAppSettings(false)
  assert.equal(settings.aiProvider, 'google')
  assert.equal(settings.aiModel, 'gemini-3-flash')
  assert.equal(settings.googleApiKey, 'legacy-google-key')
})

test('validateAiModel keeps supplier-provided values and only falls back when blank', () => {
  assert.equal(validateAiModel('openai', 'gpt-4.1-mini'), 'gpt-4.1-mini')
  assert.equal(validateAiModel('openai', 'gpt-5-custom-preview'), 'gpt-5-custom-preview')
  assert.equal(validateAiModel('openai', ''), getDefaultAiModel('openai'))
})

test('getResolvedAiApiKey resolves provider-specific keys', () => {
  const settings = {
    googleApiKey: 'google-key',
    openaiApiKey: 'openai-key',
    anthropicApiKey: 'anthropic-key',
    geminiApiKey: '',
  }

  assert.equal(getResolvedAiApiKey('google', settings), 'google-key')
  assert.equal(getResolvedAiApiKey('openai', settings), 'openai-key')
  assert.equal(getResolvedAiApiKey('anthropic', settings), 'anthropic-key')
  assert.equal(getResolvedAiApiKey('local', settings), '')
})
