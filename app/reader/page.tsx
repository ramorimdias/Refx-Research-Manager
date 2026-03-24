'use client'

import Link from 'next/link'
import { BookOpen, FileText, Clock, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/refx/common'
import { getContinueReading, getRecentDocuments } from '@/lib/mock-data'

export default function ReaderIndexPage() {
  const continueReading = getContinueReading()
  const recentDocs = getRecentDocuments(10)

  if (continueReading.length === 0 && recentDocs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={BookOpen}
          title="No documents to read"
          description="Add documents to your library and start reading to see them here."
          action={
            <Button asChild>
              <Link href="/libraries">Go to Libraries</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold">Reader</h1>
        <p className="text-muted-foreground">Continue where you left off or start reading something new</p>
      </div>

      {continueReading.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Continue Reading
          </h2>
          <div className="space-y-3">
            {continueReading.map((doc) => (
              <Link key={doc.id} href={`/reader/${doc.id}`}>
                <Card className="hover:border-primary/50 transition-colors">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {doc.authors.slice(0, 2).join(', ')}
                        {doc.authors.length > 2 && ' et al.'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-sm text-muted-foreground">
                        Page {doc.lastReadPage} of {doc.pageCount}
                      </span>
                      <Progress
                        value={((doc.lastReadPage || 0) / (doc.pageCount || 1)) * 100}
                        className="h-2 w-32"
                      />
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          Recently Opened
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {recentDocs.map((doc) => (
            <Link key={doc.id} href={`/reader/${doc.id}`}>
              <Card className="hover:border-primary/50 transition-colors h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-medium line-clamp-2">{doc.title}</h3>
                      <p className="text-sm text-muted-foreground truncate mt-1">
                        {doc.authors[0]}
                        {doc.authors.length > 1 && ' et al.'}
                        {doc.year && ` (${doc.year})`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
