'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Highlighter, Loader2, Search, StickyNote, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Textarea } from '@/components/ui/textarea'
import * as repo from '@/lib/repositories/local-db'
import { appDataDir, convertFileSrc, copyFile, isTauri, join, mkdir, open, readFile } from '@/lib/tauri/client'
import { useAppStore } from '@/lib/store'
import { extractPdfPageWords, extractSearchPreview, findDocumentSearchOccurrences, findPdfSearchOccurrences, type PdfWord } from '@/lib/services/document-processing'

function highlightText(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return text

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const segments = text.split(new RegExp(`(${escaped})`, 'gi'))

  return segments.map((segment, index) =>
    segment.toLowerCase() === trimmed.toLowerCase() ? (
      <mark key={`${segment}-${index}`} className="rounded bg-primary/20 px-0.5 text-foreground">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    ),
  )
}

export default function ReaderViewPage() {
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const queryFromRoute = params.get('query') ?? ''
  const pageFromRoute = Number(params.get('page') ?? '1')
  const returnTo = params.get('returnTo') ?? ''
  const { documents, notes, setActiveDocument, updateDocument, loadNotes, refreshData, isDesktopApp } = useAppStore()
  const document = useMemo(() => documents.find((entry) => entry.id === id) ?? null, [documents, id])
  const [page, setPage] = useState(Number.isFinite(pageFromRoute) && pageFromRoute > 0 ? pageFromRoute : 1)
  const [zoom, setZoom] = useState(100)
  const [note, setNote] = useState('')
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [isPageRendering, setIsPageRendering] = useState(false)
  const [showHighlights, setShowHighlights] = useState(true)
  const [pdfDocument, setPdfDocument] = useState<{ numPages: number; getPage: (pageNumber: number) => Promise<unknown>; destroy?: () => Promise<void> } | null>(null)
  const [renderedPageSize, setRenderedPageSize] = useState({ width: 0, height: 0 })
  const [pageWords, setPageWords] = useState<PdfWord[]>([])
  const [searchQuery, setSearchQuery] = useState(queryFromRoute)
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0)
  const [searchOccurrences, setSearchOccurrences] = useState<Array<{
    index: number
    snippet: string
    start: number
    end: number
    estimatedPage: number
    rects?: Array<{ left: number; top: number; width: number; height: number }>
  }>>([])
  const occurrenceRefs = useRef<Array<HTMLButtonElement | null>>([])
  const shouldAutoScrollOccurrenceRef = useRef(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const readerViewportRef = useRef<HTMLDivElement | null>(null)
  const pageScrollLockRef = useRef(false)
  const initializedDocumentIdRef = useRef<string | null>(null)

  const loadPdfJs = async () => {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
    if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).toString()
    }
    return pdfjs
  }

  useEffect(() => {
    setSearchQuery(queryFromRoute)
  }, [queryFromRoute])

  useEffect(() => {
    if (Number.isFinite(pageFromRoute) && pageFromRoute > 0) {
      setPage(pageFromRoute)
    }
  }, [pageFromRoute])

  useEffect(() => {
    if (!document) return
    setActiveDocument(document.id)
    if (initializedDocumentIdRef.current !== document.id && document.lastReadPage) {
      setPage(document.lastReadPage)
    }
    initializedDocumentIdRef.current = document.id
    if (document.readingStage === 'unread') {
      void updateDocument(document.id, { readingStage: 'reading' })
    }
  }, [document?.id, document?.lastReadPage, document?.readingStage, setActiveDocument, updateDocument])

  useEffect(() => {
    let cancelled = false
    let loadedPdf: { destroy?: () => Promise<void> } | null = null

    const loadPdf = async () => {
      if (!document?.filePath || !isTauri()) {
        setPdfDocument(null)
        setRenderedPageSize({ width: 0, height: 0 })
        setPageWords([])
        return
      }

      setIsPdfLoading(true)

      try {
        const pdfjs = await loadPdfJs()
        const bytes = await readFile(document.filePath)
        const task = pdfjs.getDocument({
          data: new Uint8Array(bytes),
          useWorkerFetch: false,
          isEvalSupported: false,
          stopAtErrors: false,
        })

        const nextPdf = (await task.promise) as {
          numPages: number
          getPage: (pageNumber: number) => Promise<unknown>
          destroy?: () => Promise<void>
        }
        loadedPdf = nextPdf

        if (cancelled) {
          await nextPdf.destroy?.()
          return
        }

        setPdfDocument(nextPdf)
        setViewerError(null)
        setPage((current) => Math.min(Math.max(1, current), nextPdf.numPages))
      } catch (error) {
        console.error('Failed to load PDF for embedded viewer:', error)
        setPdfDocument(null)
        setRenderedPageSize({ width: 0, height: 0 })
        setPageWords([])
        setViewerError('Embedded PDF preview is unavailable. Open this document in your system PDF app.')
      } finally {
        if (!cancelled) {
          setIsPdfLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
      void loadedPdf?.destroy?.()
    }
  }, [document?.filePath])

  useEffect(() => {
    if (!id || !document) return
    const timeout = window.setTimeout(() => {
      void updateDocument(id, {
        readingStage: document.readingStage === 'unread' ? 'reading' : document.readingStage,
      })
      void repo.updateDocumentMetadata(id, {
        lastReadPage: page,
        lastOpenedAt: new Date().toISOString(),
      })
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [document, id, page, updateDocument])

  const fileUrl = useMemo(() => {
    if (isTauri() && document?.filePath) return convertFileSrc(document.filePath)
    return ''
  }, [document?.filePath])

  useEffect(() => {
    let cancelled = false

    const loadOccurrences = async () => {
      if (!document || !searchQuery.trim()) {
        setSearchOccurrences([])
        return
      }

      if (document.filePath && isTauri()) {
        try {
          const results = await findPdfSearchOccurrences(document.filePath, searchQuery, document.pageCount)
          if (!cancelled) {
            setSearchOccurrences(results)
            return
          }
        } catch (error) {
          console.warn('PDF occurrence search failed, falling back to indexed text:', error)
        }
      }

      if (!cancelled) {
        setSearchOccurrences(findDocumentSearchOccurrences(document, searchQuery))
      }
    }

    void loadOccurrences()

    return () => {
      cancelled = true
    }
  }, [document, searchQuery])

  useEffect(() => {
    let cancelled = false

    const loadPageWords = async () => {
      if (!document?.filePath || !isTauri()) {
        setPageWords([])
        return
      }

      try {
        const pages = await extractPdfPageWords(document.filePath)
        if (cancelled) return
        setPageWords(pages.find((entry) => entry.pageNumber === page)?.words ?? [])
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to load page text layer:', error)
          setPageWords([])
        }
      }
    }

    void loadPageWords()

    return () => {
      cancelled = true
    }
  }, [document?.filePath, page])

  const activeOccurrence = searchOccurrences[activeOccurrenceIndex] ?? null
  const currentPageHighlights = useMemo(
    () => searchOccurrences.filter((occurrence) => occurrence.estimatedPage === page && occurrence.rects?.length),
    [page, searchOccurrences],
  )
  const currentPageNote = useMemo(() => {
    if (!id) return null
    return (
      notes.find((entry) => entry.documentId === id && entry.pageNumber === page) ?? null
    )
  }, [id, notes, page])

  useEffect(() => {
    setNote(currentPageNote?.content ?? '')
  }, [currentPageNote?.id, currentPageNote?.content, page])

  useEffect(() => {
    setActiveOccurrenceIndex(0)
    shouldAutoScrollOccurrenceRef.current = false
  }, [searchQuery, document?.id])

  useEffect(() => {
    if (shouldAutoScrollOccurrenceRef.current) {
      occurrenceRefs.current[activeOccurrenceIndex]?.scrollIntoView({ block: 'nearest' })
      shouldAutoScrollOccurrenceRef.current = false
    }
  }, [activeOccurrenceIndex])

  useEffect(() => {
    const viewport = readerViewportRef.current
    if (!viewport) return

    const releaseLock = () => {
      window.setTimeout(() => {
        pageScrollLockRef.current = false
      }, 160)
    }

    const handleWheel = (event: WheelEvent) => {
      if (pageScrollLockRef.current || !pdfDocument) return

      const { scrollTop, clientHeight, scrollHeight } = viewport
      const nearTop = scrollTop <= 4
      const nearBottom = scrollTop + clientHeight >= scrollHeight - 4

      if (event.deltaY > 0 && nearBottom && page < pdfDocument.numPages) {
        event.preventDefault()
        pageScrollLockRef.current = true
        setPage((current) => Math.min(pdfDocument.numPages, current + 1))
        viewport.scrollTop = 0
        releaseLock()
      } else if (event.deltaY < 0 && nearTop && page > 1) {
        event.preventDefault()
        pageScrollLockRef.current = true
        setPage((current) => Math.max(1, current - 1))
        window.requestAnimationFrame(() => {
          viewport.scrollTop = viewport.scrollHeight
        })
        releaseLock()
      }
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', handleWheel)
    }
  }, [page, pdfDocument])

  useEffect(() => {
    let cancelled = false
    let renderTask: { promise?: Promise<void>; cancel?: () => void } | null = null

    const renderCurrentPage = async () => {
      if (!pdfDocument || !canvasRef.current) return

      setIsPageRendering(true)

      try {
        const pdfPage = (await pdfDocument.getPage(page)) as {
          getViewport: (args: { scale: number }) => { width: number; height: number }
          render: (args: {
            canvasContext: CanvasRenderingContext2D
            viewport: { width: number; height: number }
            transform?: number[]
          }) => { promise: Promise<void>; cancel?: () => void }
          cleanup?: () => void
        }
        if (cancelled) return

        const scale = zoom / 100
        const viewport = pdfPage.getViewport({ scale })
        const canvas = canvasRef.current
        const context = canvas.getContext('2d')
        if (!context) return

        const devicePixelRatio = window.devicePixelRatio || 1
        canvas.width = Math.ceil(viewport.width * devicePixelRatio)
        canvas.height = Math.ceil(viewport.height * devicePixelRatio)
        canvas.style.width = `${viewport.width}px`
        canvas.style.height = `${viewport.height}px`
        context.setTransform(1, 0, 0, 1, 0, 0)
        context.clearRect(0, 0, canvas.width, canvas.height)

        renderTask = pdfPage.render({
          canvasContext: context,
          viewport,
          transform: devicePixelRatio === 1 ? undefined : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
        })
        await renderTask.promise

        if (!cancelled) {
          setRenderedPageSize({ width: viewport.width, height: viewport.height })
        }

        pdfPage.cleanup?.()
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to render PDF page:', error)
          setViewerError('Embedded PDF preview is unavailable. Open this document in your system PDF app.')
        }
      } finally {
        if (!cancelled) {
          setIsPageRendering(false)
        }
      }
    }

    void renderCurrentPage()

    return () => {
      cancelled = true
      renderTask?.cancel?.()
    }
  }, [page, pdfDocument, zoom])

  const selectOccurrence = (index: number, options?: { jumpToPage?: boolean }) => {
    const occurrence = searchOccurrences[index]
    if (!occurrence) return

    shouldAutoScrollOccurrenceRef.current = true
    setActiveOccurrenceIndex(index)
    if (options?.jumpToPage) {
      setPage(occurrence.estimatedPage)
    }
  }

  const rotateOccurrence = (direction: 'next' | 'prev') => {
    if (searchOccurrences.length === 0) return
    const nextIndex =
      direction === 'next'
        ? (activeOccurrenceIndex + 1) % searchOccurrences.length
        : (activeOccurrenceIndex - 1 + searchOccurrences.length) % searchOccurrences.length
    selectOccurrence(nextIndex, { jumpToPage: true })
  }

  const importPdfForDocument = async () => {
    if (!isTauri() || !document?.id || !document?.libraryId) return

    const selected = await open({
      multiple: false,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      title: 'Import PDF for this document',
    })

    if (!selected || Array.isArray(selected)) return

    const base = await appDataDir()
    const targetDir = await join(base, 'pdfs', document.libraryId)
    await mkdir(targetDir, { recursive: true })

    const destination = await join(targetDir, `${document.id}.pdf`)
    await copyFile(selected, destination)

    await repo.updateDocumentMetadata(document.id, { importedFilePath: destination })
    await refreshData()
  }

  if (!document) {
    return <div className="p-6">Document not found.</div>
  }

  const fallbackBackHref = returnTo === 'search' ? '/search' : '/libraries'
  const backLabel = returnTo === 'search' ? 'Back to Search' : 'Back'

  return (
    <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={74} minSize={45}>
        <div className="flex h-full flex-1 flex-col">
        <div className="flex items-center gap-2 border-b p-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
                return
              }
              router.push(fallbackBackHref)
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Input
              value={page}
              onChange={(event) => setPage(Math.max(1, Number(event.target.value) || 1))}
              className="w-24 pr-8"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              / {pdfDocument?.numPages ?? document.pageCount ?? '—'}
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setZoom((current) => Math.max(50, current - 10))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm">{zoom}%</span>
          <Button variant="outline" size="sm" onClick={() => setZoom((current) => Math.min(250, current + 10))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant={showHighlights ? 'default' : 'outline'}
            size="sm"
            onClick={() => setShowHighlights((current) => !current)}
            disabled={!searchQuery.trim() || searchOccurrences.length === 0}
          >
            <Highlighter className="mr-2 h-4 w-4" />
            {showHighlights ? 'Highlights On' : 'Highlights Off'}
          </Button>
          <div className="ml-3 flex min-w-[280px] items-center gap-2 rounded-lg border px-2 py-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search inside this document"
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
            <Button variant="ghost" size="sm" onClick={() => rotateOccurrence('prev')} disabled={searchOccurrences.length === 0}>
              Prev
            </Button>
            <Button variant="ghost" size="sm" onClick={() => rotateOccurrence('next')} disabled={searchOccurrences.length === 0}>
              Next
            </Button>
            <span className="text-xs text-muted-foreground">
              {searchOccurrences.length === 0 ? '0 results' : `${activeOccurrenceIndex + 1}/${searchOccurrences.length}`}
            </span>
          </div>
          {fileUrl && (
            <Button asChild variant="ghost" size="sm" className="ml-auto">
              <a href={fileUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Open external
              </a>
            </Button>
          )}
        </div>
        <div ref={readerViewportRef} className="flex-1 overflow-auto bg-muted/30 p-4">
          {pdfDocument ? (
            <div className="flex min-h-full items-start justify-center">
              <div className="relative overflow-hidden rounded border bg-white shadow-sm">
                <canvas ref={canvasRef} className="block bg-white" />
                {renderedPageSize.width > 0 && (
                  <div className="absolute inset-0">
                    <div className="absolute inset-0 overflow-hidden">
                      {pageWords.map((word, wordIndex) => (
                        <span
                          key={`${wordIndex}-${word.left}-${word.top}`}
                          className="absolute select-text whitespace-pre text-transparent"
                          style={{
                            left: `${word.left * (zoom / 100)}px`,
                            top: `${word.top * (zoom / 100)}px`,
                            width: `${Math.max(6, word.width * (zoom / 100))}px`,
                            height: `${Math.max(10, word.height * (zoom / 100))}px`,
                            fontSize: `${Math.max(10, word.height * (zoom / 100) * 0.85)}px`,
                            lineHeight: `${Math.max(10, word.height * (zoom / 100))}px`,
                          }}
                        >
                          {word.text}
                        </span>
                      ))}
                    </div>
                    {showHighlights && (
                      <div className="pointer-events-none absolute inset-0">
                        {currentPageHighlights.flatMap((occurrence) =>
                          (occurrence.rects ?? []).map((rect, rectIndex) => {
                            const isActive = occurrence.index === activeOccurrenceIndex
                            return (
                              <div
                                key={`${occurrence.index}-${rectIndex}`}
                                className={`absolute rounded-sm ${
                                  isActive ? 'bg-amber-400/45 ring-1 ring-amber-500/70' : 'bg-sky-300/30'
                                }`}
                                style={{
                                  left: `${rect.left * (zoom / 100)}px`,
                                  top: `${rect.top * (zoom / 100)}px`,
                                  width: `${rect.width * (zoom / 100)}px`,
                                  height: `${Math.max(10, rect.height * (zoom / 100))}px`,
                                }}
                              />
                            )
                          }),
                        )}
                      </div>
                    )}
                  </div>
                )}
                {(isPdfLoading || isPageRendering) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/35 backdrop-blur-[1px]">
                    <div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-sm shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {isPdfLoading ? 'Loading PDF...' : `Rendering page ${page}...`}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2 p-6">
              <p>{viewerError ?? 'PDF unavailable. Import a PDF in desktop mode.'}</p>
              {isDesktopApp && document.id && (
                <Button size="sm" onClick={() => void importPdfForDocument()}>
                  Import PDF...
                </Button>
              )}
              {fileUrl && (
                <a className="text-sm text-primary underline" href={fileUrl} target="_blank" rel="noreferrer">
                  Open with system viewer
                </a>
              )}
            </div>
          )}
        </div>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={26} minSize={18} maxSize={45}>
        <div className="flex h-full flex-col border-l">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Search className="h-4 w-4" />
            Document Search
          </div>
          <p className="text-xs text-muted-foreground">
            Matching against page-level PDF text extraction. The embedded viewer still receives the keyword for native highlight when supported.
          </p>
          <div className="space-y-2">
            <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Keyword or phrase" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{searchOccurrences.length} occurrence{searchOccurrences.length === 1 ? '' : 's'}</span>
              {searchOccurrences.length > 0 && <span>Selected {activeOccurrenceIndex + 1}</span>}
            </div>
            {searchOccurrences.length > 0 ? (
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {searchOccurrences.map((occurrence, index) => (
                  <button
                    key={`${occurrence.start}-${index}`}
                    ref={(element) => {
                      occurrenceRefs.current[index] = element
                    }}
                    type="button"
                    onClick={() => {
                      selectOccurrence(index, { jumpToPage: true })
                    }}
                    className={`w-full rounded-md border p-2 text-left text-sm transition ${
                      index === activeOccurrenceIndex ? 'border-primary bg-primary/8' : 'border-border bg-muted/40 hover:bg-muted/70'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>Occurrence {index + 1}</span>
                      <span>Page ~{occurrence.estimatedPage}</span>
                    </div>
                    <div className="leading-6">{highlightText(occurrence.snippet, searchQuery)}</div>
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                No matches found for this keyword.
              </div>
            ) : (
              <div className="rounded-md bg-muted/50 p-2 text-sm text-muted-foreground">
                {extractSearchPreview(document, document.title, 80)}
              </div>
            )}
          </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <StickyNote className="h-4 w-4" />
              Page note
            </div>
            <p className="text-xs text-muted-foreground">
              Last updated:{' '}
              <span className="font-medium">
                {currentPageNote?.updatedAt ? new Date(currentPageNote.updatedAt).toLocaleString() : 'Not saved yet'}
              </span>
            </p>
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add page note" className="min-h-40" />
            <Button
              size="sm"
              onClick={async () => {
                if (!id || !isDesktopApp || !note.trim()) return
                if (currentPageNote) {
                  await repo.updateNote(currentPageNote.id, { pageNumber: page, content: note, title: `Page ${page} note` })
                } else {
                  await repo.createNote({ documentId: id, pageNumber: page, title: `Page ${page} note`, content: note })
                }
                await loadNotes()
              }}
              disabled={!isDesktopApp}
            >
              {currentPageNote ? 'Update note' : 'Save note'}
            </Button>
          </div>
        </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
