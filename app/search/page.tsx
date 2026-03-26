'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, Loader2, Plus, Search as SearchIcon, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { EmptyState, MetadataStatusBadge, ReadingStageBadge } from '@/components/refx/common'
import { useAppStore } from '@/lib/store'
import type { KeywordGroup, MetadataStatus, ReadingStage } from '@/lib/types'
import { searchDocumentDeepWithOptions } from '@/lib/services/document-processing'

type SearchResult = {
  document: ReturnType<typeof useAppStore.getState>['documents'][number]
  preview: string
  rawScore: number
  matchCount: number
}

type GroupJoinOperator = 'AND' | 'OR'

function createKeywordGroup(operator: KeywordGroup['operator'] = 'AND', keywords: string[] = []): KeywordGroup {
  return {
    id: `group-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
    operator,
    keywords,
  }
}

function normalizeKeywords(keywords: string[]) {
  return Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean)))
}

function normalizeGroups(groups: KeywordGroup[]) {
  return groups
    .map((group) => ({
      ...group,
      keywords: normalizeKeywords(group.keywords),
    }))
    .filter((group) => group.keywords.length > 0)
}

function encodeGroupParam(group: KeywordGroup) {
  return `${group.operator}:${group.keywords.join('||')}`
}

function parseGroupParam(value: string) {
  const separatorIndex = value.indexOf(':')
  if (separatorIndex <= 0) return null

  const operator = value.slice(0, separatorIndex)
  if (operator !== 'AND' && operator !== 'OR') return null

  const keywords = normalizeKeywords(value.slice(separatorIndex + 1).split('||'))
  if (keywords.length === 0) return null

  return createKeywordGroup(operator, keywords)
}

function parseInitialGroups(params: URLSearchParams) {
  const encodedGroups = params.getAll('g').map(parseGroupParam).filter((group): group is KeywordGroup => Boolean(group))
  if (encodedGroups.length > 0) return encodedGroups

  const repeatedKeywords = normalizeKeywords(params.getAll('k'))
  if (repeatedKeywords.length > 0) {
    return [createKeywordGroup('AND', repeatedKeywords)]
  }

  const legacyQuery = params.get('q') ?? ''
  const legacyKeywords = normalizeKeywords(legacyQuery.split(','))
  return legacyKeywords.length > 0 ? [createKeywordGroup('AND', legacyKeywords)] : []
}

function parseQueryMode(params: URLSearchParams) {
  return params.get('mode') === 'complex' ? 'complex' : 'simple'
}

function parseGroupJoinOperator(params: URLSearchParams): GroupJoinOperator {
  return params.get('go') === 'OR' ? 'OR' : 'AND'
}

function flattenKeywords(groups: KeywordGroup[]) {
  return normalizeKeywords(groups.flatMap((group) => group.keywords))
}

function querySummary(groups: KeywordGroup[], groupJoinOperator: GroupJoinOperator) {
  return groups
    .map((group) => `(${group.keywords.join(` ${group.operator} `)})`)
    .join(` ${groupJoinOperator} `)
}

function highlightText(text: string, keywords: string[]) {
  const normalized = normalizeKeywords(keywords)
  if (normalized.length === 0) return text

  const pattern = normalized
    .sort((left, right) => right.length - left.length)
    .map((keyword) => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  if (!pattern) return text
  const expression = new RegExp(`(${pattern})`, 'gi')
  const segments = text.split(expression)

  return segments.map((segment, index) =>
    normalized.some((keyword) => keyword.toLowerCase() === segment.toLowerCase()) ? (
      <mark key={`${segment}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    ),
  )
}

function flexibilityLabel(flexibility: number) {
  if (flexibility < 20) return 'Strict'
  if (flexibility < 45) return 'Balanced'
  if (flexibility < 70) return 'Flexible'
  return 'Very flexible'
}

export default function SearchPage() {
  const router = useRouter()
  const params = useSearchParams()
  const paramString = params.toString()
  const { documents, libraries, setGlobalSearchQuery, persistentSearch, setPersistentSearch } = useAppStore()
  const initialGroups = useMemo(
    () => parseInitialGroups(new URLSearchParams(paramString)),
    [paramString],
  )
  const initialMode = useMemo(() => parseQueryMode(new URLSearchParams(paramString)), [paramString])
  const initialGroupJoinOperator = useMemo(() => parseGroupJoinOperator(new URLSearchParams(paramString)), [paramString])
  const [queryMode, setQueryMode] = useState<'simple' | 'complex'>(initialMode)
  const [draftGroups, setDraftGroups] = useState<KeywordGroup[]>(initialGroups.length > 0 ? initialGroups : [createKeywordGroup('AND')])
  const [draftGroupJoinOperator, setDraftGroupJoinOperator] = useState<GroupJoinOperator>(initialGroupJoinOperator)
  const [groupInputs, setGroupInputs] = useState<Record<string, string>>({})
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchedCount, setSearchedCount] = useState(0)
  const [totalToSearch, setTotalToSearch] = useState(0)
  const searchRunId = useRef(0)

  const selectedLibraryId = persistentSearch.selectedLibraryId
  const readingStage = persistentSearch.readingStage
  const metadataStatus = persistentSearch.metadataStatus
  const favoriteOnly = persistentSearch.favoriteOnly
  const flexibility = persistentSearch.flexibility
  const groupJoinOperator = persistentSearch.groupJoinOperator
  const executedGroups = useMemo(() => normalizeGroups(initialGroups), [initialGroups])
  const executedKeywords = useMemo(() => flattenKeywords(executedGroups), [executedGroups])
  const executedGroupJoinOperator = useMemo(() => initialGroupJoinOperator, [initialGroupJoinOperator])
  const executedQueryLabel = useMemo(
    () => querySummary(executedGroups, executedGroupJoinOperator),
    [executedGroupJoinOperator, executedGroups],
  )

  useEffect(() => {
    setQueryMode(initialMode)
    setDraftGroupJoinOperator(initialGroupJoinOperator)
    const nextGroups = initialGroups.length > 0 ? initialGroups : [createKeywordGroup('AND')]
    setDraftGroups(nextGroups)
    const joinedKeywords = flattenKeywords(initialGroups).join(', ')
    setGlobalSearchQuery(joinedKeywords)
    setPersistentSearch({
      query: joinedKeywords,
      keywords: flattenKeywords(initialGroups),
      keywordGroups: normalizeGroups(initialGroups),
      groupJoinOperator: initialGroupJoinOperator,
    })
  }, [initialGroupJoinOperator, initialGroups, initialMode, setGlobalSearchQuery, setPersistentSearch])

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      if (selectedLibraryId !== 'all' && document.libraryId !== selectedLibraryId) return false
      if (readingStage !== 'all' && document.readingStage !== readingStage) return false
      if (metadataStatus !== 'all' && document.metadataStatus !== metadataStatus) return false
      if (favoriteOnly && !document.favorite) return false
      return true
    })
  }, [documents, favoriteOnly, metadataStatus, readingStage, selectedLibraryId])

  useEffect(() => {
    const runId = ++searchRunId.current

    if (executedGroups.length === 0) {
      setResults([])
      setIsSearching(false)
      setSearchedCount(0)
      setTotalToSearch(0)
      return
    }

    let cancelled = false

    const runSearch = async () => {
      setIsSearching(true)
      setResults([])
      setSearchedCount(0)
      setTotalToSearch(filteredDocuments.length)

      const nextResults: SearchResult[] = []

      for (const [index, document] of filteredDocuments.entries()) {
        if (cancelled || searchRunId.current !== runId) return

        let totalMatchCount = 0
        let totalRawScore = 0
        let preview = ''
        let matchedGroupCount = 0

        for (const group of executedGroups) {
          const keywordMatches = await Promise.all(
            group.keywords.map((keyword) =>
              searchDocumentDeepWithOptions(document, keyword, {
                keywords: [keyword],
                flexibility,
              }),
            ),
          )

          if (cancelled || searchRunId.current !== runId) return

          const matchedKeywords = keywordMatches.filter((match) => match.matchCount > 0)
          const groupMatched = group.operator === 'AND'
            ? matchedKeywords.length === group.keywords.length
            : matchedKeywords.length > 0

          if (!groupMatched) {
            if (executedGroupJoinOperator === 'AND') {
              matchedGroupCount = -1
              break
            }
            continue
          }

          matchedGroupCount += 1
          totalMatchCount += matchedKeywords.reduce((sum, match) => sum + match.matchCount, 0)
          totalRawScore += matchedKeywords.reduce((sum, match) => sum + match.rawScore, 0)
          if (!preview) {
            preview = matchedKeywords.find((match) => match.preview)?.preview ?? ''
          }
        }

        const groupsSatisfied = executedGroupJoinOperator === 'AND'
          ? matchedGroupCount === executedGroups.length
          : matchedGroupCount > 0

        if (groupsSatisfied && totalMatchCount > 0) {
          nextResults.push({
            document,
            preview,
            rawScore: totalRawScore,
            matchCount: totalMatchCount,
          })
        }

        setSearchedCount(index + 1)
      }

      if (cancelled || searchRunId.current !== runId) return

      nextResults.sort((left, right) => {
        if (right.matchCount !== left.matchCount) return right.matchCount - left.matchCount
        if (right.rawScore !== left.rawScore) return right.rawScore - left.rawScore
        return left.document.title.localeCompare(right.document.title)
      })

      setResults(nextResults)
      setIsSearching(false)
    }

    void runSearch()

    return () => {
      cancelled = true
      if (searchRunId.current === runId) {
        setIsSearching(false)
      }
    }
  }, [executedGroupJoinOperator, executedGroups, filteredDocuments, flexibility])

  const updateGroup = (groupId: string, updates: Partial<KeywordGroup>) => {
    setDraftGroups((current) =>
      current.map((group) => (group.id === groupId ? { ...group, ...updates } : group)),
    )
  }

  const addKeywordToGroup = (groupId: string) => {
    const nextKeyword = groupInputs[groupId]?.trim() ?? ''
    if (!nextKeyword) return

    setDraftGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              keywords: normalizeKeywords([...group.keywords, nextKeyword]),
            }
          : group,
      ),
    )
    setGroupInputs((current) => ({ ...current, [groupId]: '' }))
  }

  const removeKeywordFromGroup = (groupId: string, keyword: string) => {
    setDraftGroups((current) =>
      current.map((group) =>
        group.id === groupId
          ? {
              ...group,
              keywords: group.keywords.filter((entry) => entry !== keyword),
            }
          : group,
      ),
    )
  }

  const addGroup = () => {
    setDraftGroups((current) => [...current, createKeywordGroup('AND')])
  }

  const removeGroup = (groupId: string) => {
    setDraftGroups((current) => {
      const remaining = current.filter((group) => group.id !== groupId)
      return remaining.length > 0 ? remaining : [createKeywordGroup('AND')]
    })
    setGroupInputs((current) => {
      const next = { ...current }
      delete next[groupId]
      return next
    })
  }

  const submitSearch = () => {
    const preparedGroups =
      queryMode === 'simple'
        ? normalizeGroups([
            {
              ...(draftGroups[0] ?? createKeywordGroup('AND')),
              operator: 'AND',
              keywords: normalizeKeywords([
                ...(draftGroups[0]?.keywords ?? []),
                ...((groupInputs[draftGroups[0]?.id ?? '']?.trim() ?? '') ? [groupInputs[draftGroups[0]?.id ?? '']] : []),
              ]),
            },
          ])
        : normalizeGroups(
            draftGroups.map((group) => ({
              ...group,
              keywords: normalizeKeywords([...group.keywords, ...(groupInputs[group.id]?.trim() ? [groupInputs[group.id]] : [])]),
            })),
          )

    const flattenedKeywords = flattenKeywords(preparedGroups)
    const joined = flattenedKeywords.join(', ')

    setDraftGroups(preparedGroups.length > 0 ? preparedGroups : [createKeywordGroup('AND')])
    setGroupInputs({})
    setGlobalSearchQuery(joined)
    setPersistentSearch({
      query: joined,
      keywords: flattenedKeywords,
      keywordGroups: preparedGroups,
      groupJoinOperator: queryMode === 'simple' ? 'AND' : draftGroupJoinOperator,
    })

    if (preparedGroups.length === 0) {
      router.push('/search')
      return
    }

    const nextParams = new URLSearchParams()
    nextParams.set('mode', queryMode)
    if (queryMode === 'simple') {
      for (const keyword of flattenedKeywords) {
        nextParams.append('k', keyword)
      }
    } else {
      nextParams.set('go', draftGroupJoinOperator)
      for (const group of preparedGroups) {
        nextParams.append('g', encodeGroupParam(group))
      }
    }
    router.push(`/search?${nextParams.toString()}`)
  }

  const switchMode = (nextMode: 'simple' | 'complex') => {
    setQueryMode(nextMode)
    setDraftGroupJoinOperator('AND')
    setDraftGroups((current) => {
      const normalized = normalizeGroups(current)
      if (nextMode === 'simple') {
        const flattened = flattenKeywords(normalized)
        return [createKeywordGroup('AND', flattened)]
      }
      return normalized.length > 0 ? normalized : [createKeywordGroup('AND')]
    })
    setGroupInputs({})
  }

  return (
    <div className="p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <SearchIcon className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Search</h1>
            <p className="text-sm text-muted-foreground">Persistent full-library search with deeper document scanning.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Advanced Filters
              </CardTitle>
              <CardDescription>Build grouped keyword queries with AND and OR logic, then run them across the selected library scope.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  submitSearch()
                }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-medium">Query mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={queryMode === 'simple' ? 'default' : 'outline'}
                      onClick={() => switchMode('simple')}
                    >
                      Simple
                    </Button>
                    <Button
                      type="button"
                      variant={queryMode === 'complex' ? 'default' : 'outline'}
                      onClick={() => switchMode('complex')}
                    >
                      Complex
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Keyword query</label>
                    {queryMode === 'complex' && (
                      <Button type="button" variant="outline" size="sm" onClick={addGroup}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add group
                      </Button>
                    )}
                  </div>

                  {queryMode === 'complex' && draftGroups.length > 1 && (
                    <div className="space-y-2 rounded-xl border p-3">
                      <label className="text-sm font-medium">Between groups</label>
                      <Select value={draftGroupJoinOperator} onValueChange={(value) => setDraftGroupJoinOperator(value as GroupJoinOperator)}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AND">AND</SelectItem>
                          <SelectItem value="OR">OR</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {draftGroupJoinOperator === 'AND'
                          ? 'A document must satisfy every group.'
                          : 'A document can satisfy any one of the groups.'}
                      </p>
                    </div>
                  )}

                  {draftGroups.slice(0, queryMode === 'simple' ? 1 : draftGroups.length).map((group, index) => (
                    <div key={group.id} className="space-y-3 rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{queryMode === 'simple' ? 'Keywords' : `Group ${index + 1}`}</span>
                          {queryMode === 'complex' && (
                            <Select value={group.operator} onValueChange={(value) => updateGroup(group.id, { operator: value as KeywordGroup['operator'] })}>
                              <SelectTrigger className="h-8 w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        {queryMode === 'complex' && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeGroup(group.id)}>
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={groupInputs[group.id] ?? ''}
                          onChange={(event) => setGroupInputs((current) => ({ ...current, [group.id]: event.target.value }))}
                          placeholder={queryMode === 'simple' ? 'Add a keyword' : `Add a keyword to this ${group.operator} group`}
                        />
                        <Button type="button" variant="outline" className="shrink-0" onClick={() => addKeywordToGroup(group.id)} disabled={!(groupInputs[group.id] ?? '').trim()}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add
                        </Button>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {group.keywords.length > 0 ? (
                          group.keywords.map((keyword) => (
                            <Badge key={`${group.id}-${keyword}`} variant="secondary" className="gap-1.5 pr-1">
                              {keyword}
                              <button type="button" onClick={() => removeKeywordFromGroup(group.id, keyword)} className="rounded-full p-0.5 hover:bg-background/70">
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {queryMode === 'simple'
                              ? 'Add one or more keywords. Documents will match across this keyword list.'
                              : `Add one or more keywords. This group matches when ${group.operator === 'AND' ? 'every keyword is found.' : 'any keyword is found.'}`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <Button type="submit" className="w-full">
                  Search
                </Button>
              </form>

              <div className="space-y-2">
                <label className="text-sm font-medium">Flexibility</label>
                <div className="rounded-lg border px-3 py-4">
                  <div className="mb-3 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{flexibilityLabel(flexibility)}</span>
                    <span className="font-medium">{flexibility}%</span>
                  </div>
                  <Slider
                    value={[flexibility]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={([value]) => setPersistentSearch({ flexibility: value ?? 0 })}
                  />
                  <p className="mt-3 text-xs text-muted-foreground">
                    Higher flexibility allows closer variants such as misspellings, broken words across line wraps, and near matches.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Library</label>
                <Select value={selectedLibraryId} onValueChange={(value) => setPersistentSearch({ selectedLibraryId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All libraries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All libraries</SelectItem>
                    {libraries.map((library) => (
                      <SelectItem key={library.id} value={library.id}>
                        {library.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Reading stage</label>
                <Select value={readingStage} onValueChange={(value) => setPersistentSearch({ readingStage: value as 'all' | ReadingStage })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any stage</SelectItem>
                    <SelectItem value="unread">Unread</SelectItem>
                    <SelectItem value="reading">Reading</SelectItem>
                    <SelectItem value="skimmed">Skimmed</SelectItem>
                    <SelectItem value="read">Read</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Metadata quality</label>
                <Select value={metadataStatus} onValueChange={(value) => setPersistentSearch({ metadataStatus: value as 'all' | MetadataStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any status</SelectItem>
                    <SelectItem value="incomplete">Incomplete</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                variant={favoriteOnly ? 'default' : 'outline'}
                className="w-full"
                onClick={() => setPersistentSearch({ favoriteOnly: !favoriteOnly })}
              >
                {favoriteOnly ? 'Showing favorites only' : 'Filter to favorites'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {executedGroups.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                <div>
                  <p className="text-sm text-muted-foreground">Persistent search</p>
                  <p className="font-medium">
                    {isSearching
                      ? `Searching ${searchedCount}/${totalToSearch || filteredDocuments.length} documents for ${executedQueryLabel}`
                      : `${results.length} result${results.length === 1 ? '' : 's'} for ${executedQueryLabel}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isSearching && (
                    <Badge variant="secondary" className="gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Searching
                    </Badge>
                  )}
                  <Badge variant="secondary">{flexibilityLabel(flexibility)}</Badge>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={SearchIcon}
                title="Start a Search"
                description="Add one or more keyword groups and press Search to scan your full library."
              />
            )}

            {executedGroups.length > 0 && isSearching && (
              <Card>
                <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Scanning full documents and library metadata. This can take a bit longer, but it searches the full stored content.
                </CardContent>
              </Card>
            )}

            {executedGroups.length > 0 && !isSearching && results.length === 0 && (
              <EmptyState
                icon={SearchIcon}
                title="No matching documents"
                description="Try increasing flexibility or broadening the filters."
              />
            )}

            {results.map(({ document, preview, matchCount }) => {
              const library = libraries.find((item) => item.id === document.libraryId)
              const readerKeyword = executedKeywords[0] ?? ''

              return (
                <Card key={document.id}>
                  <CardContent className="flex flex-col gap-4 py-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <Link
                          href={`/reader/view?id=${document.id}&query=${encodeURIComponent(readerKeyword)}&returnTo=search`}
                          className="text-lg font-semibold hover:text-primary"
                        >
                          {document.title}
                        </Link>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {document.authors.join(', ') || 'Unknown author'}
                          {document.year ? ` • ${document.year}` : ''}
                          {library ? ` • ${library.name}` : ''}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        {matchCount} occurrence{matchCount === 1 ? '' : 's'}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ReadingStageBadge stage={document.readingStage} />
                      <MetadataStatusBadge status={document.metadataStatus} />
                      {document.tags.slice(0, 4).map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <p className="text-sm leading-6 text-muted-foreground">{highlightText(preview, executedKeywords)}</p>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button asChild>
                        <Link href={`/reader/view?id=${document.id}&query=${encodeURIComponent(readerKeyword)}&returnTo=search`}>
                          Open in Reader
                        </Link>
                      </Button>
                      <Button asChild variant="outline">
                        <Link href={`/documents?id=${document.id}&edit=1`}>Open Details</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
