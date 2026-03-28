'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, Clock, FilePlus2, FolderPlus, Highlighter, type LucideIcon, StickyNote } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/refx/common'
import { useAppStore } from '@/lib/store'
import { loadAppSettings } from '@/lib/app-settings'

type DashboardActivity = {
  id: string
  title: string
  detail: string
  href: string
  occurredAt: Date
  icon: LucideIcon
}

function formatRelativeTime(date: Date) {
  const elapsed = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute))
    return `${minutes}m ago`
  }

  if (elapsed < day) {
    const hours = Math.max(1, Math.round(elapsed / hour))
    return `${hours}h ago`
  }

  const days = Math.max(1, Math.round(elapsed / day))
  return `${days}d ago`
}

export default function HomePage() {
  const router = useRouter()
  const { libraries, documents, notes, annotations, isDesktopApp, setActiveLibrary } = useAppStore()
  const [userName, setUserName] = useState('')
  const [greetingIndex, setGreetingIndex] = useState(0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      const settings = await loadAppSettings(isDesktopApp)
      if (!cancelled) {
        setUserName(settings.userName.trim())
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [isDesktopApp])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const key = 'refx.dashboard.greeting-count'
    const current = Number(window.sessionStorage.getItem(key) ?? '0')
    window.sessionStorage.setItem(key, String(current + 1))
    setGreetingIndex(current)
  }, [])

  const activities = useMemo<DashboardActivity[]>(() => {
    const documentsById = new Map(documents.map((document) => [document.id, document]))
    const librariesById = new Map(libraries.map((library) => [library.id, library]))

    const libraryActivities = libraries.map((library) => ({
      id: `library-${library.id}`,
      title: 'Library created',
      detail: library.name,
      href: '/libraries',
      occurredAt: library.createdAt,
      icon: FolderPlus,
    }))

    const addedDocumentActivities = documents.map((document) => ({
      id: `document-added-${document.id}`,
      title: 'Document added to library',
      detail: `${document.title} · ${librariesById.get(document.libraryId)?.name ?? 'Library'}`,
      href: document.documentType === 'physical_book' ? `/books/notes?id=${document.id}` : `/reader/view?id=${document.id}`,
      occurredAt: document.createdAt,
      icon: FilePlus2,
    }))

    const noteActivities = notes.map((note) => ({
      id: `note-${note.id}`,
      title: 'Note created',
      detail: (() => {
        const noteTitle = note.title.trim() || 'Untitled note'
        const documentTitle = note.documentId ? documentsById.get(note.documentId)?.title : null
        return documentTitle ? `${noteTitle} · ${documentTitle}` : noteTitle
      })(),
      href: note.documentId ? `/reader/view?id=${note.documentId}` : '/notes',
      occurredAt: new Date(note.createdAt),
      icon: StickyNote,
    }))

    const annotationActivities = annotations
      .map((annotation) => {
        const document = documentsById.get(annotation.documentId)
        if (!document) return null

        const isHighlight = annotation.kind === 'highlight' || annotation.kind === 'area'
        const pageLabel = annotation.pageNumber ? ` · Page ${annotation.pageNumber}` : ''

        return {
          id: `annotation-${annotation.id}`,
          title: isHighlight ? 'Highlight created' : 'Annotation created',
          detail: `${document.title}${pageLabel}`,
          href: `/reader/view?id=${document.id}&page=${annotation.pageNumber}`,
          occurredAt: new Date(annotation.createdAt),
          icon: Highlighter,
        }
      })
      .filter((activity): activity is DashboardActivity => Boolean(activity))

    const finishedActivities = documents
      .filter((document) => document.readingStage === 'finished')
      .map((document) => ({
        id: `finished-${document.id}`,
        title: 'Finished reading',
        detail: document.title,
        href: document.documentType === 'physical_book' ? `/books/notes?id=${document.id}` : `/reader/view?id=${document.id}`,
        occurredAt: document.updatedAt,
        icon: CheckCircle2,
      }))

    return [...libraryActivities, ...addedDocumentActivities, ...noteActivities, ...annotationActivities, ...finishedActivities]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 10)
  }, [annotations, documents, libraries, notes])

  const greeting = useMemo(() => {
    const greetings = userName
      ? [
          {
            title: `Welcome back, ${userName}`,
            subtitle: `What are your ideas today, ${userName}?`,
          },
          {
            title: `Good to see you again, ${userName}`,
            subtitle: `What are you exploring today, ${userName}?`,
          },
          {
            title: `Back at it, ${userName}`,
            subtitle: `What deserves your attention today, ${userName}?`,
          },
          {
            title: `Welcome back, ${userName}`,
            subtitle: `What would you like to move forward today, ${userName}?`,
          },
        ]
      : [
          {
            title: 'Welcome back',
            subtitle: 'What are your ideas today?',
          },
          {
            title: 'Good to see you again',
            subtitle: 'What are you exploring today?',
          },
          {
            title: 'Back at it',
            subtitle: 'What deserves your attention today?',
          },
          {
            title: 'Welcome back',
            subtitle: 'What would you like to move forward today?',
          },
        ]

    return greetings[greetingIndex % greetings.length]
  }, [greetingIndex, userName])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{greeting.title}</h1>
        <p className="text-muted-foreground">{greeting.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Total Documents</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{documents.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {libraries.map((library) => (
              <Button
                key={library.id}
                size="sm"
                variant="outline"
                className="border-transparent text-white shadow-none hover:opacity-90 hover:text-white"
                style={{ backgroundColor: library.color }}
                onClick={() => {
                  setActiveLibrary(library.id)
                  router.push('/libraries')
                }}
              >
                {library.name}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length > 0 ? (
            <div className="space-y-2">
              {activities.map((activity) => {
                const Icon = activity.icon

                return (
                  <Link
                    key={activity.id}
                    href={activity.href}
                    className="block rounded-xl border border-border/70 p-3 transition hover:bg-muted/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted/70 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{activity.title}</div>
                            <div className="truncate text-sm text-muted-foreground">{activity.detail}</div>
                          </div>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(activity.occurredAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No activity yet"
              description="Import documents, add notes, or create highlights to build your activity feed."
              action={
                <Button asChild>
                  <Link href="/libraries">Open Libraries</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
