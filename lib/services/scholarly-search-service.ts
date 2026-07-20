import { getResolvedSemanticScholarApiKey, loadAppSettings } from '@/lib/app-settings'

export type ScholarlySearchResult = {
  id: string
  title: string
  authors: string[]
  year?: number
  abstract?: string
  doi?: string
  venue?: string
  citationCount?: number
  url?: string
  source: 'Semantic Scholar' | 'OpenAlex'
  relevanceScore?: number
  aiRelevanceScore?: number
  aiReason?: string
}

type SemanticResponse = { data?: Array<{ paperId?: string; title?: string; authors?: Array<{ name?: string }>; year?: number; abstract?: string; externalIds?: { DOI?: string }; venue?: string; citationCount?: number; url?: string }> }
type OpenAlexResponse = { results?: Array<{ id?: string; title?: string; authorships?: Array<{ author?: { display_name?: string } }>; publication_year?: number; doi?: string; cited_by_count?: number; primary_location?: { source?: { display_name?: string } }; open_access?: { oa_url?: string } }> }

function dedupe(results: ScholarlySearchResult[]) {
  const seen = new Set<string>()
  return results.filter((result) => {
    const key = (result.doi ?? result.title).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export async function searchScholarlyWorks(query: string, options?: { signal?: AbortSignal; limit?: number; apiKey?: string; yearFrom?: number; yearTo?: number }) {
  const cleanQuery = query.trim()
  if (!cleanQuery) return []
  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const settings = await loadAppSettings(false)
  const semanticKey = options?.apiKey ?? getResolvedSemanticScholarApiKey(settings)
  const fields = 'title,authors,year,abstract,externalIds,venue,citationCount,url'
  const yearRange = options?.yearFrom || options?.yearTo ? `&year=${options.yearFrom ?? ''}-${options.yearTo ?? ''}` : ''
  const openAlexFilters = [options?.yearFrom ? `from_publication_year:${options.yearFrom}` : '', options?.yearTo ? `to_publication_year:${options.yearTo}` : ''].filter(Boolean).join(',')
  const headers: HeadersInit = semanticKey ? { 'x-api-key': semanticKey } : {}
  const [semantic, openAlex] = await Promise.allSettled([
    fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanQuery)}&limit=${limit}&fields=${fields}${yearRange}`, { signal: options?.signal, headers }).then(async (response) => {
      if (!response.ok) throw new Error(`Semantic Scholar returned ${response.status}`)
      return response.json() as Promise<SemanticResponse>
    }),
    fetch(`https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&per-page=${limit}${openAlexFilters ? `&filter=${openAlexFilters}` : ''}&select=id,title,authorships,publication_year,doi,cited_by_count,primary_location,open_access`, { signal: options?.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`OpenAlex returned ${response.status}`)
      return response.json() as Promise<OpenAlexResponse>
    }),
  ])

  const results: ScholarlySearchResult[] = []
  if (semantic.status === 'fulfilled') {
    for (const work of semantic.value.data ?? []) {
      if (!work.title?.trim()) continue
      results.push({ id: work.paperId ?? `semantic-${results.length}`, title: work.title.trim(), authors: (work.authors ?? []).map((author) => author.name?.trim()).filter((name): name is string => Boolean(name)), year: work.year, abstract: work.abstract?.trim() || undefined, doi: work.externalIds?.DOI, venue: work.venue, citationCount: work.citationCount, url: work.url, source: 'Semantic Scholar' })
    }
  }
  if (openAlex.status === 'fulfilled') {
    for (const work of openAlex.value.results ?? []) {
      if (!work.title?.trim()) continue
      results.push({ id: work.id ?? `openalex-${results.length}`, title: work.title.trim(), authors: (work.authorships ?? []).map((entry) => entry.author?.display_name?.trim()).filter((name): name is string => Boolean(name)), year: work.publication_year, doi: work.doi?.replace(/^https?:\/\/doi.org\//i, ''), venue: work.primary_location?.source?.display_name, citationCount: work.cited_by_count, url: work.open_access?.oa_url, source: 'OpenAlex' })
    }
  }
  const terms = cleanQuery.toLowerCase().split(/\s+/).filter((term) => term.length > 2)
  const ranked = dedupe(results).map((result) => {
    const title = result.title.toLowerCase()
    const abstract = result.abstract?.toLowerCase() ?? ''
    const titleMatches = terms.filter((term) => title.includes(term)).length / Math.max(terms.length, 1)
    const abstractMatches = terms.filter((term) => abstract.includes(term)).length / Math.max(terms.length, 1)
    const citationSignal = Math.min(1, Math.log10((result.citationCount ?? 0) + 1) / 4)
    const recencySignal = result.year ? Math.max(0, 1 - (new Date().getFullYear() - result.year) / 30) : 0.25
    const relevanceScore = Math.round((titleMatches * 0.55 + abstractMatches * 0.15 + citationSignal * 0.2 + recencySignal * 0.1) * 100)
    return { ...result, relevanceScore }
  })
  return ranked.sort((left, right) => (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0)).slice(0, limit)
}
