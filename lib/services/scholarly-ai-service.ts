import { getResolvedAiApiKey, loadAppSettings } from '@/lib/app-settings'
import type { ScholarlySearchResult } from '@/lib/services/scholarly-search-service'

type AiJson = { expandedQueries?: unknown; ranking?: unknown }

function parseProviderJson(text: string): AiJson | null {
  const normalized = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(normalized) as AiJson } catch {
    const start = normalized.indexOf('{')
    const end = normalized.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try { return JSON.parse(normalized.slice(start, end + 1)) as AiJson } catch { return null }
  }
}

async function askProvider(prompt: string) {
  // Search runs in the desktop shell; load the same persisted settings source
  // used by the rest of the AI features (including the configured API key).
  const settings = await loadAppSettings(true)
  if (settings.aiProvider === 'local') return null
  let response: Response
  if (settings.aiProvider === 'google') {
    const key = getResolvedAiApiKey('google', settings)
    if (!key) return null
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(settings.aiModel || settings.geminiModel)}:generateContent?key=${encodeURIComponent(key)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ generationConfig: { responseMimeType: 'application/json' }, contents: [{ role: 'user', parts: [{ text: prompt }] }] }) })
  } else if (settings.aiProvider === 'openai') {
    const key = getResolvedAiApiKey('openai', settings)
    if (!key) return null
    response = await fetch('https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: settings.aiModel || 'gpt-4o-mini', temperature: 0.1, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }) })
  } else {
    const key = getResolvedAiApiKey('anthropic', settings)
    if (!key) return null
    response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: settings.aiModel || 'claude-3-5-haiku-latest', max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }) })
  }
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`)
  const payload = await response.json()
  const text = settings.aiProvider === 'google'
    ? payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('')
    : settings.aiProvider === 'openai' ? payload?.choices?.[0]?.message?.content : payload?.content?.[0]?.text
  if (!text) throw new Error('AI provider returned an empty response.')
  const parsed = parseProviderJson(text)
  if (!parsed) throw new Error('AI provider returned an unreadable response. Try again or disable AI expansion.')
  return parsed
}

export async function expandScholarlyQuery(query: string) {
  const result = await askProvider(`Expand this scholarly search query into up to four precise alternative queries. Preserve the original intent and do not invent a specific paper. Return JSON only: {"expandedQueries":["..."]}. Query: ${query}`)
  return Array.isArray(result?.expandedQueries) ? result.expandedQueries.filter((entry): entry is string => typeof entry === 'string').slice(0, 4) : []
}

export async function rerankScholarlyResults(query: string, results: ScholarlySearchResult[]) {
  const compact = results.slice(0, 30).map((result, index) => ({ id: result.id, index, title: result.title, authors: result.authors.slice(0, 3), year: result.year, abstract: result.abstract?.slice(0, 500), citations: result.citationCount }))
  const result = await askProvider(`Rank these scholarly search results for the query. Return JSON only: {"ranking":[{"id":"...","score":0-100,"reason":"short explanation"}]}. Query: ${query}\nResults: ${JSON.stringify(compact)}`)
  const ranking = Array.isArray(result?.ranking) ? result.ranking.filter((entry): entry is { id: string; score: number; reason?: string } => Boolean(entry && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string')).map((entry) => ({ id: entry.id, score: typeof entry.score === 'number' ? entry.score : 0, reason: typeof entry.reason === 'string' ? entry.reason : '' })) : []
  const byId = new Map(ranking.map((entry) => [entry.id, entry]))
  return results.map((item) => ({ ...item, aiRelevanceScore: byId.get(item.id)?.score, aiReason: byId.get(item.id)?.reason })).sort((left, right) => (right.aiRelevanceScore ?? -1) - (left.aiRelevanceScore ?? -1))
}
