'use client'

import {
  GEMINI_UNLIMITED_MODEL,
  getResolvedGeminiModel,
  hasCustomGeminiApiKey,
  loadAppSettings,
} from '@/lib/app-settings'
import * as repo from '@/lib/repositories/local-db'
import { serializeSuggestedTags } from '@/lib/services/document-tag-suggestion-service'
import { getDocumentPlainText, readPersistedDocumentText } from '@/lib/services/document-text-service'

export const GEMINI_MODEL_OPTIONS = [
  {
    value: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    description: 'Best balance (recommended)',
    recommended: true,
  },
  {
    value: 'gemini-3-flash',
    label: 'Gemini 3 Flash',
    description: 'Newer model, slightly better reasoning',
  },
  {
    value: 'gemini-3.1-flash-lite',
    label: 'Gemini 3.1 Flash Lite',
    description: 'High-rate, lower quality',
  },
] as const

const KEYWORD_SECTION_REGEX =
  /(?:^|\n)\s*(keywords?|key words|index terms?|mots[ -]?cl(?:e|é)s|palavras[ -]?chave)\s*[:\-]\s*(.+)/i

export type DetectedDocumentKeywordsResult = {
  documentId: string
  keywords: string[]
  summary?: string
  source: 'author_list' | 'gemini_page1' | 'gemini_full'
}

export function normalizeWhitespace(input: string) {
  return input.replace(/\s+/g, ' ').trim()
}

export function normalizeKeyword(input: string) {
  return normalizeWhitespace(input).toLowerCase()
}

export function splitKeywordList(input: string) {
  return input
    .split(/[,;•·]/)
    .map((entry) => normalizeKeyword(entry))
    .filter(Boolean)
}

function dedupeKeywords(values: string[]) {
  return Array.from(new Set(values.map((value) => normalizeKeyword(value)).filter(Boolean)))
}

function extractGeminiRetryDelay(payload: unknown) {
  const details = Array.isArray((payload as { error?: { details?: unknown } })?.error?.details)
    ? ((payload as { error: { details: Array<{ retryDelay?: unknown }> } }).error.details ?? [])
    : []

  const retryDelay = details.find((entry) => typeof entry?.retryDelay === 'string')?.retryDelay
  return typeof retryDelay === 'string' ? retryDelay : ''
}

function orderedGeminiModels(preferredModel: string) {
  const ordered = GEMINI_MODEL_OPTIONS.map((option) => option.value)
  const preferredIndex = ordered.indexOf(preferredModel as typeof ordered[number])
  if (preferredIndex < 0) return ordered
  return ordered.slice(preferredIndex)
}

function firstPageTextFromPlainText(text: string) {
  return normalizeWhitespace(text.slice(0, 4_000))
}

function getFirstPageText(
  plainText: string,
  persistedText?: Awaited<ReturnType<typeof readPersistedDocumentText>> | null,
) {
  const persistedFirstPage = persistedText?.pages.find((page) => page.pageNumber === 1)?.text
  if (persistedFirstPage) return normalizeWhitespace(persistedFirstPage)
  return firstPageTextFromPlainText(plainText)
}

function extractAuthorKeywordsFromPageText(pageText: string) {
  const normalizedPageText = pageText.replace(/\r\n/g, '\n')
  const match = KEYWORD_SECTION_REGEX.exec(normalizedPageText)
  if (!match) return []

  let section = match[2] ?? ''
  const stopIndex = section.search(/\n\s*\n|\n[A-Z][A-Za-z\s]{2,}[:\-]/)
  if (stopIndex >= 0) {
    section = section.slice(0, stopIndex)
  }

  return dedupeKeywords(splitKeywordList(section))
}

export async function extractKeywordsWithGemini(args: {
  text: string
  apiKey: string
  model: string
}): Promise<{ keywords: string[]; summary?: string }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(args.model)}:generateContent?key=${encodeURIComponent(args.apiKey)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        generationConfig: {
          responseMimeType: 'application/json',
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: [
                  'Extract research keywords from this PDF text.',
                  'If author-provided keywords appear, return them exactly.',
                  'Otherwise infer 5 to 12 concise research keywords.',
                  'Include one short summary sentence.',
                  'Return JSON only with: {"keywords": string[], "summary": string}.',
                  '',
                  args.text,
                ].join('\n'),
              },
            ],
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
      const retryDelay = extractGeminiRetryDelay(parsedError)
      throw new Error(
        retryDelay
          ? `Gemini quota exceeded. Please wait about ${retryDelay} and try again, or use a paid Gemini plan.`
          : 'Gemini quota exceeded. Please try again later or use a paid Gemini plan.',
      )
    }

    throw new Error(errorMessage || responseText || `Gemini keyword extraction failed (${response.status}).`)
  }

  const payload = await response.json()
  const rawText = payload?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part?.text ?? '')
    .join('')
    .trim()

  if (!rawText) {
    throw new Error('Gemini returned an empty keyword response.')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error('Gemini returned invalid JSON for keyword extraction.')
  }

  const keywords = Array.isArray((parsed as { keywords?: unknown }).keywords)
    ? dedupeKeywords(
        ((parsed as { keywords?: unknown[] }).keywords ?? [])
          .map((entry) => (typeof entry === 'string' ? entry : ''))
          .filter(Boolean),
      )
    : []
  const summary = typeof (parsed as { summary?: unknown }).summary === 'string'
    ? normalizeWhitespace((parsed as { summary: string }).summary)
    : undefined

  if (keywords.length === 0) {
    throw new Error('Gemini did not return any valid keywords.')
  }

  return {
    keywords,
    summary,
  }
}

function buildTagSuggestionsFromKeywords(
  keywords: string[],
  source: DetectedDocumentKeywordsResult['source'],
) {
  const confidence = source === 'author_list' ? 1 : 0.8
  return keywords.map((keyword) => ({
    name: keyword,
    confidence,
  }))
}

async function updateDocumentKeywordSuggestions(
  document: repo.DbDocument,
  keywords: string[],
  source: DetectedDocumentKeywordsResult['source'],
) {
  const processedAt = new Date().toISOString()
  await repo.updateDocumentMetadata(document.id, {
    tagSuggestions: serializeSuggestedTags(buildTagSuggestionsFromKeywords(keywords, source)),
    tagSuggestionStatus: 'complete',
    tagSuggestionTextHash: document.textHash,
    processingUpdatedAt: processedAt,
    lastProcessedAt: processedAt,
  })
}

export async function detectAndStoreDocumentKeywords(
  documentId: string,
  options?: {
    forceAi?: boolean
  },
) {
  const document = await repo.getDocumentById(documentId)
  if (!document) {
    throw new Error(`Document ${documentId} was not found.`)
  }

  const settings = await loadAppSettings(true)
  const persistedText = await readPersistedDocumentText(document)
  const plainText = normalizeWhitespace(await getDocumentPlainText(document))
  if (!plainText) {
    return {
      documentId,
      keywords: [],
      source: 'author_list' as const,
    }
  }

  const firstPageText = getFirstPageText(plainText, persistedText)
  if (options?.forceAi !== true) {
    const authorKeywords = extractAuthorKeywordsFromPageText(firstPageText)
    if (authorKeywords.length >= 3) {
      await repo.replaceDocumentKeywords(
        documentId,
        authorKeywords.map((keyword) => ({
          keyword,
          source: 'author_list',
          apiTier: 'free',
        })),
      )
      await updateDocumentKeywordSuggestions(document, authorKeywords, 'author_list')
      return {
        documentId,
        keywords: authorKeywords,
        source: 'author_list' as const,
      }
    }
  }

  const apiKey = hasCustomGeminiApiKey(settings)
    ? settings.geminiApiKey.trim()
    : (await repo.getDefaultGeminiApiKey()).trim()
  if (!apiKey) {
    if (options?.forceAi) {
      throw new Error('Gemini API key is not configured.')
    }
    return {
      documentId,
      keywords: [],
      source: 'author_list' as const,
    }
  }

  const extractionMode = settings.keywordExtractionMode
  const source = extractionMode === 'full' ? 'gemini_full' : 'gemini_page1'
  const textForGemini = extractionMode === 'full'
    ? normalizeWhitespace(plainText.slice(0, 12_000))
    : normalizeWhitespace(firstPageText.slice(0, 4_000))
  const modelsToTry = hasCustomGeminiApiKey(settings)
    ? orderedGeminiModels(getResolvedGeminiModel(settings))
    : [GEMINI_UNLIMITED_MODEL]
  let extracted: { keywords: string[]; summary?: string } | null = null
  let lastError: unknown = null

  for (const model of modelsToTry) {
    try {
      extracted = await extractKeywordsWithGemini({
        text: textForGemini,
        apiKey,
        model,
      })
      break
    } catch (error) {
      lastError = error
    }
  }

  if (!extracted) {
    throw lastError instanceof Error ? lastError : new Error('Gemini keyword extraction failed.')
  }

  const normalizedKeywords = dedupeKeywords(extracted.keywords)
  await repo.replaceDocumentKeywords(
    documentId,
    normalizedKeywords.map((keyword) => ({
      keyword,
      summary: extracted.summary,
      source,
      confidence: 0.8,
      apiTier: extractionMode === 'full' ? 'paid' : 'free',
    })),
  )
  await updateDocumentKeywordSuggestions(document, normalizedKeywords, source)

  return {
    documentId,
    keywords: normalizedKeywords,
    summary: extracted.summary,
    source,
  } satisfies DetectedDocumentKeywordsResult
}
