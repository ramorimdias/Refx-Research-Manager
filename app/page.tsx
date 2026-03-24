'use client'

import Link from 'next/link'
import {
  FileText,
  BookOpen,
  Clock,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Star,
  MessageSquare,
  Hash,
  ArrowRight,
  Plus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { StatsCard, ReadingStageBadge, TagChip, StarRating } from '@/components/refx/common'
import {
  mockDocuments,
  mockLibraryStats,
  mockTopicClusters,
  mockSavedSearches,
  mockAnnotations,
  getContinueReading,
  getRecentDocuments,
  getDocumentsNeedingMetadata,
  getOcrPendingDocuments,
} from '@/lib/mock-data'

export default function HomePage() {
  const continueReading = getContinueReading()
  const recentDocuments = getRecentDocuments(6)
  const needsMetadata = getDocumentsNeedingMetadata()
  const ocrPending = getOcrPendingDocuments()
  const stats = mockLibraryStats

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-balance">Welcome back, Dr. Doe</h1>
        <p className="text-muted-foreground">Your research dashboard</p>
      </div>

      {/* Stats Grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatsCard
          label="Total Documents"
          value={stats.totalDocuments}
          icon={FileText}
          trend={{ value: 12, label: 'this month' }}
        />
        <StatsCard
          label="Total Annotations"
          value={stats.totalAnnotations}
          icon={MessageSquare}
          trend={{ value: 8, label: 'this week' }}
        />
        <StatsCard
          label="Documents Read"
          value={stats.byReadingStage.read}
          icon={BookOpen}
        />
        <StatsCard
          label="Recently Added"
          value={stats.recentlyAdded}
          icon={Plus}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content - 2 columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Continue Reading */}
          {continueReading.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Continue Reading
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/libraries">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {continueReading.map((doc) => (
                    <Link
                      key={doc.id}
                      href={`/reader/${doc.id}`}
                      className="flex items-center gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{doc.title}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {doc.authors.slice(0, 2).join(', ')}
                          {doc.authors.length > 2 && ' et al.'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm text-muted-foreground">
                          Page {doc.lastReadPage} of {doc.pageCount}
                        </span>
                        <Progress
                          value={((doc.lastReadPage || 0) / (doc.pageCount || 1)) * 100}
                          className="h-1.5 w-24"
                        />
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recently Added */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Recently Added
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/libraries">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentDocuments.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/documents/${doc.id}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium truncate">{doc.title}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{doc.authors[0]}{doc.authors.length > 1 && ' et al.'}</span>
                        <span>•</span>
                        <span>{doc.year}</span>
                      </div>
                    </div>
                    <ReadingStageBadge stage={doc.readingStage} />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Annotations */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Recent Annotations
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/notes">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockAnnotations.slice(0, 4).map((ann) => {
                  const doc = mockDocuments.find((d) => d.id === ann.documentId)
                  return (
                    <div
                      key={ann.id}
                      className="rounded-lg border border-border p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {doc?.title} • Page {ann.page}
                        </span>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {ann.type}
                        </Badge>
                      </div>
                      {ann.textQuote && (
                        <p
                          className="text-sm border-l-2 pl-3 italic"
                          style={{ borderColor: ann.color }}
                        >
                          {ann.textQuote}
                        </p>
                      )}
                      {ann.comment && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {ann.comment}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - 1 column */}
        <div className="space-y-6">
          {/* Needs Attention */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Needs Attention
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {needsMetadata.length > 0 && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Metadata Incomplete
                    </span>
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                      {needsMetadata.length}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Papers need metadata cleanup
                  </p>
                </div>
              )}
              {ocrPending.length > 0 && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      OCR Pending
                    </span>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {ocrPending.length}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                    Papers queued for text extraction
                  </p>
                </div>
              )}
              <Button variant="outline" size="sm" className="w-full">
                Review All Issues
              </Button>
            </CardContent>
          </Card>

          {/* Saved Searches */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Star className="h-4 w-4 text-primary" />
                Saved Searches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockSavedSearches.map((search) => (
                  <Link
                    key={search.id}
                    href={`/discover?search=${encodeURIComponent(search.query)}`}
                    className="flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{search.name}</span>
                    <Badge variant="secondary">{search.resultCount}</Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Topic Clusters */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Hash className="h-4 w-4 text-primary" />
                Topic Clusters
              </CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/maps">Explore <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockTopicClusters.map((topic) => (
                  <div key={topic.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: topic.color }}
                        />
                        <span className="text-sm font-medium">{topic.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {topic.documentIds.length} papers
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {topic.keywords.slice(0, 3).map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* AI Features Placeholder */}
          <Card className="border-dashed">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Assistant
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Intelligent features to accelerate your research:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Auto metadata extraction
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Abstract summarization
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Related paper suggestions
                </li>
                <li className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  Semantic search
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
