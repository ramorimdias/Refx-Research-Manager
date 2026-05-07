'use client'

import type { AiProvider } from '@/lib/app-settings'
import type { IncomingDocumentClassification } from '@/lib/services/document-classification-service'

export type DocumentAiMode = 'page1' | 'full'
export type RemoteAiProvider = Exclude<AiProvider, 'local'>
export type AiModelOption = {
  value: string
  label: string
  description?: string
}

export type DocumentInsightsResult = {
  keywords: string[]
  summary?: string
  classification?: IncomingDocumentClassification
}

type ExtractDocumentInsightsArgs = {
  text: string
  provider: RemoteAiProvider
  model: string
  apiKey: string
  mode: DocumentAiMode
}

function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

function normalizeKeywords(values: unknown) {
  if (!Array.isArray(values)) return []
  return Array.from(new Set(
    values
      .map((entry) => (typeof entry === 'string' ? normalizeWhitespace(entry).toLowerCase() : ''))
      .filter(Boolean),
  )).slice(0, 12)
}

export function validateRemoteAiModel(provider: RemoteAiProvider, model: string) {
  void provider
  return model.trim().length > 0
}

export function parseDocumentInsightsPayload(rawText: string): DocumentInsightsResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('The AI provider returned invalid JSON.')
  }

  const keywords = normalizeKeywords((parsed as { keywords?: unknown }).keywords)
  if (keywords.length === 0) {
    throw new Error('The AI provider did not return any valid keywords.')
  }

  const summary = typeof (parsed as { summary?: unknown }).summary === 'string'
    ? normalizeWhitespace((parsed as { summary: string }).summary)
    : undefined

  const rawClassification = (parsed as { classification?: unknown }).classification
  const classification = rawClassification && typeof rawClassification === 'object'
    ? {
        category: typeof (rawClassification as { category?: unknown }).category === 'string'
          ? (rawClassification as { category: string }).category
          : '',
        topic: typeof (rawClassification as { topic?: unknown }).topic === 'string'
          ? (rawClassification as { topic: string }).topic
          : '',
        confidence: typeof (rawClassification as { confidence?: unknown }).confidence === 'number'
          ? (rawClassification as { confidence: number }).confidence
          : undefined,
        matchedKeywords: Array.isArray((rawClassification as { matchedKeywords?: unknown }).matchedKeywords)
          ? (rawClassification as { matchedKeywords: unknown[] }).matchedKeywords.filter((entry): entry is string => typeof entry === 'string')
          : undefined,
        suggestedTags: Array.isArray((rawClassification as { suggestedTags?: unknown }).suggestedTags)
          ? (rawClassification as { suggestedTags: unknown[] }).suggestedTags.filter((entry): entry is string => typeof entry === 'string')
          : undefined,
      } satisfies IncomingDocumentClassification
    : undefined

  return {
    keywords,
    summary,
    classification,
  }
}

function buildPrompt(text: string, mode: DocumentAiMode) {
  return [
    'Extract research keywords from this document text.',
    'If author-provided keywords appear, return them exactly.',
    'Otherwise infer 5 to 12 concise research keywords.',
    'Include one short summary sentence.',
    'Also infer a semantic topic classification for the document.',
    'Return JSON only with: {"keywords": string[], "summary": string, "classification": {"category": string, "topic": string, "confidence": number, "matchedKeywords": string[], "suggestedTags": string[]}}.',
    `Extraction mode: ${mode === 'full' ? 'full document' : 'first page focus'}.`,
    '',
    text,
  ].join('\n')
}

function parseRetryDelay(payload: unknown) {
  const details = Array.isArray((payload as { error?: { details?: unknown } })?.error?.details)
    ? ((payload as { error: { details: Array<{ retryDelay?: unknown }> } }).error.details ?? [])
    : []
  const retryDelay = details.find((entry) => typeof entry?.retryDelay === 'string')?.retryDelay
  return typeof retryDelay === 'string' ? retryDelay : ''
}

async function fetchGoogleInsights(args: ExtractDocumentInsightsArgs) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: buildPrompt(args.text, args.mode) }],
          },
        ],
      }),
    },
  )

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    let parsedError: unknown = null
    try {
      parsedError = responseText ? JSON.parse(responseText) : null
    } catch {
      parsedError = null
    }

    const errorStatus = typeof (parsedError as { error?: { status?: unknown } })?.error?.status === 'string'
      ? (parsedError as { error: { status: string } }).error.status
      : ''
    const errorMessage = typeof (parsedError as { error?: { message?: unknown } })?.error?.message === 'string'
      ? (parsedError as { error: { message: string } }).error.message
      : ''

    if (response.status === 429 || errorStatus === 'RESOURCE_EXHAUSTED') {
      const retryDelay = parseRetryDelay(parsedError)
      throw new Error(
        retryDelay
          ? `Google AI quota exceeded. Please wait about ${retryDelay} and try again.`
          : 'Google AI quota exceeded. Please try again later.',
      )
    }

    throw new Error(errorMessage || responseText || `Google AI request failed (${response.status}).`)
  }

  const payload = await response.json()
  const rawText = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part?.text ?? '')
    .join('')
    .trim()

  if (!rawText) {
    throw new Error('Google AI returned an empty response.')
  }

  return parseDocumentInsightsPayload(rawText)
}

async function fetchOpenAiInsights(args: ExtractDocumentInsightsArgs) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.apiKey}`,
    },
    body: JSON.stringify({
      model: args.model,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'document_insights',
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              keywords: { type: 'array', items: { type: 'string' } },
              summary: { type: 'string' },
              classification: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  category: { type: 'string' },
                  topic: { type: 'string' },
                  confidence: { type: 'number' },
                  matchedKeywords: { type: 'array', items: { type: 'string' } },
                  suggestedTags: { type: 'array', items: { type: 'string' } },
                },
                required: ['category', 'topic'],
              },
            },
            required: ['keywords'],
          },
        },
      },
      messages: [
        {
          role: 'user',
          content: buildPrompt(args.text, args.mode),
        },
      ],
    }),
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `OpenAI request failed (${response.status}).`)
  }

  const payload = await response.json()
  const rawText = payload?.choices?.[0]?.message?.content?.trim()
  if (!rawText) {
    throw new Error('OpenAI returned an empty response.')
  }

  return parseDocumentInsightsPayload(rawText)
}

async function fetchAnthropicInsights(args: ExtractDocumentInsightsArgs) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': args.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: args.model,
      max_tokens: 1200,
      system: 'Return JSON only. Do not add markdown or commentary.',
      messages: [
        {
          role: 'user',
          content: buildPrompt(args.text, args.mode),
        },
      ],
    }),
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => '')
    throw new Error(responseText || `Anthropic request failed (${response.status}).`)
  }

  const payload = await response.json()
  const rawText = Array.isArray(payload?.content)
    ? payload.content
        .map((entry: { type?: string; text?: string }) => (entry?.type === 'text' ? entry.text ?? '' : ''))
        .join('')
        .trim()
    : ''
  if (!rawText) {
    throw new Error('Anthropic returned an empty response.')
  }

  return parseDocumentInsightsPayload(rawText)
}

export async function fetchAvailableAiModels(
  provider: RemoteAiProvider,
  apiKey: string,
): Promise<AiModelOption[]> {
  if (!apiKey.trim()) return []

  switch (provider) {
    case 'google': {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`)
      if (!response.ok) {
        throw new Error(`Google AI model list failed (${response.status}).`)
      }
      const payload = await response.json()
      const models = Array.isArray(payload?.models) ? payload.models : []
      return models
        .filter((entry: { name?: string; supportedGenerationMethods?: string[] }) =>
          typeof entry?.name === 'string'
          && entry.name.includes('gemini')
          && Array.isArray(entry.supportedGenerationMethods)
          && entry.supportedGenerationMethods.includes('generateContent'))
        .map((entry: { name: string; displayName?: string; description?: string }) => ({
          value: entry.name.replace(/^models\//, ''),
          label: entry.displayName?.trim() || entry.name.replace(/^models\//, ''),
          description: entry.description?.trim() || undefined,
        }))
    }
    case 'openai': {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })
      if (!response.ok) {
        throw new Error(`OpenAI model list failed (${response.status}).`)
      }
      const payload = await response.json()
      const models = Array.isArray(payload?.data) ? payload.data : []
      return models
        .filter((entry: { id?: string }) => typeof entry?.id === 'string' && entry.id.startsWith('gpt-'))
        .map((entry: { id: string }) => ({
          value: entry.id,
          label: entry.id,
        }))
    }
    case 'anthropic': {
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      })
      if (!response.ok) {
        throw new Error(`Anthropic model list failed (${response.status}).`)
      }
      const payload = await response.json()
      const models = Array.isArray(payload?.data) ? payload.data : []
      return models
        .filter((entry: { id?: string }) => typeof entry?.id === 'string')
        .map((entry: { id: string; display_name?: string }) => ({
          value: entry.id,
          label: entry.display_name?.trim() || entry.id,
        }))
    }
  }
}

export async function extractDocumentInsights(args: ExtractDocumentInsightsArgs): Promise<DocumentInsightsResult> {
  if (!validateRemoteAiModel(args.provider, args.model)) {
    throw new Error(`The selected ${args.provider} model is not supported.`)
  }

  if (!args.apiKey.trim()) {
    throw new Error(`${args.provider} API key is not configured.`)
  }

  switch (args.provider) {
    case 'google':
      return fetchGoogleInsights(args)
    case 'openai':
      return fetchOpenAiInsights(args)
    case 'anthropic':
      return fetchAnthropicInsights(args)
    default:
      throw new Error(`Unsupported AI provider: ${args.provider}`)
  }
}
