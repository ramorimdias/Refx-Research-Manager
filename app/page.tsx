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
import { useT } from '@/lib/localization'

function getDocumentHref(document: ReturnType<typeof useAppStore.getState>['documents'][number]) {
  return document.documentType === 'my_work'
    ? `/documents?id=${document.id}`
    : document.documentType === 'physical_book'
      ? `/books/notes?id=${document.id}`
      : `/reader/view?id=${document.id}`
}

type DashboardActivity = {
  id: string
  title: string
  detail: string
  href: string
  occurredAt: Date
  icon: LucideIcon
}

function formatRelativeTime(date: Date, t: ReturnType<typeof useT>) {
  const elapsed = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (elapsed < hour) {
    const minutes = Math.max(1, Math.round(elapsed / minute))
    return t('home.minutesAgo', { count: minutes })
  }

  if (elapsed < day) {
    const hours = Math.max(1, Math.round(elapsed / hour))
    return t('home.hoursAgo', { count: hours })
  }

  const days = Math.max(1, Math.round(elapsed / day))
  return t('home.daysAgo', { count: days })
}

export default function HomePage() {
  const t = useT()
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
      title: t('home.libraryCreated'),
      detail: library.name,
      href: '/libraries',
      occurredAt: library.createdAt,
      icon: FolderPlus,
    }))

    const addedDocumentActivities = documents.map((document) => ({
      id: `document-added-${document.id}`,
      title: t('home.documentAdded'),
      detail: `${document.title} - ${librariesById.get(document.libraryId)?.name ?? t('home.libraryFallback')}`,
      href: getDocumentHref(document),
      occurredAt: document.createdAt,
      icon: FilePlus2,
    }))

    const noteActivities = notes.map((note) => ({
      id: `note-${note.id}`,
      title: t('home.noteCreated'),
      detail: (() => {
        const noteTitle = note.title.trim() || t('home.untitledNote')
        const documentTitle = note.documentId ? documentsById.get(note.documentId)?.title : null
        return documentTitle ? `${noteTitle} - ${documentTitle}` : noteTitle
      })(),
      href: note.documentId ? (documentsById.get(note.documentId) ? getDocumentHref(documentsById.get(note.documentId)!) : '/notes') : '/notes',
      occurredAt: new Date(note.createdAt),
      icon: StickyNote,
    }))

    const annotationActivities = annotations
      .map((annotation) => {
        const document = documentsById.get(annotation.documentId)
        if (!document) return null

        const isHighlight = annotation.kind === 'highlight' || annotation.kind === 'area'
        const pageLabel = annotation.pageNumber ? ` - ${t('home.page', { page: annotation.pageNumber })}` : ''

        return {
          id: `annotation-${annotation.id}`,
          title: isHighlight ? t('home.highlightCreated') : t('home.annotationCreated'),
          detail: `${document.title}${pageLabel}`,
          href: getDocumentHref(document),
          occurredAt: new Date(annotation.createdAt),
          icon: Highlighter,
        }
      })
      .filter((activity): activity is DashboardActivity => Boolean(activity))

    const finishedActivities = documents
      .filter((document) => document.readingStage === 'finished')
      .map((document) => ({
        id: `finished-${document.id}`,
        title: t('home.finishedReading'),
        detail: document.title,
        href: getDocumentHref(document),
        occurredAt: document.updatedAt,
        icon: CheckCircle2,
      }))

    return [...libraryActivities, ...addedDocumentActivities, ...noteActivities, ...annotationActivities, ...finishedActivities]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, 10)
  }, [annotations, documents, libraries, notes, t])

  const greeting = useMemo(() => {
    const greetings = userName
      ? [
          {
            title: t('home.welcomeBackNamed', { name: userName }),
            subtitle: t('home.ideasTodayNamed', { name: userName }),
          },
          {
            title: t('home.goodToSeeNamed', { name: userName }),
            subtitle: t('home.exploringTodayNamed', { name: userName }),
          },
          {
            title: t('home.backAtItNamed', { name: userName }),
            subtitle: t('home.attentionTodayNamed', { name: userName }),
          },
          {
            title: t('home.welcomeBackNamed', { name: userName }),
            subtitle: t('home.moveForwardNamed', { name: userName }),
          },
        ]
      : [
          {
            title: t('home.welcomeBack'),
            subtitle: t('home.ideasToday'),
          },
          {
            title: t('home.goodToSee'),
            subtitle: t('home.exploringToday'),
          },
          {
            title: t('home.backAtIt'),
            subtitle: t('home.attentionToday'),
          },
          {
            title: t('home.welcomeBack'),
            subtitle: t('home.moveForwardToday'),
          },
        ]

    return greetings[greetingIndex % greetings.length]
  }, [greetingIndex, t, userName])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{greeting.title}</h1>
        <p className="text-muted-foreground">{greeting.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('home.totalDocuments')}</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{documents.length}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('home.quickActions')}</CardTitle>
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
            {t('home.recentActivity')}
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
                            {formatRelativeTime(activity.occurredAt, t)}
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
              title={t('home.noActivity')}
              description={t('home.noActivityDescription')}
              action={
                <Button asChild>
                  <Link href="/libraries">{t('home.openLibraries')}</Link>
                </Button>
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
