'use client'

import { forwardRef, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { ReaderNavigationToolbar } from '@/components/refx/reader-navigation-toolbar'
import { ReaderNotesPanel } from '@/components/refx/reader-notes-panel'
import { ReaderPageOverlays } from '@/components/refx/reader-page-overlays'
import { ReaderSearchPanel } from '@/components/refx/reader-search-panel'
import { ReaderToolbarActions } from '@/components/refx/reader-toolbar-actions'
import { ReaderToolbarIconButton } from '@/components/refx/reader-toolbar-icon-button'
import { ReaderViewTourDemo } from '@/components/refx/reader-view-tour-demo'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import * as repo from '@/lib/repositories/local-db'
import { appDataDir, convertFileSrc, copyFile, getCurrentWindow, isTauri, join, mkdir, open, readFile } from '@/lib/tauri/client'
import { buildDocumentCommentTitle, getDocumentPageComments, getNextDocumentCommentNumber } from '@/lib/services/document-comment-service'
import {
  extractPdfPageWords,
  extractSearchPreview,
  findPdfSearchOccurrences,
  findPdfSearchOccurrencesForQueries,
  loadPdfJsModule,
  parseFlexibleSearchTerms,
  type PdfWord,
  type SearchOccurrence,
} from '@/lib/services/document-processing'
import { findDocumentPageHits, type DocumentSearchQuery } from '@/lib/services/document-search-service'
import { DETACHED_READER_QUERY_VALUE, openDetachedReaderWindow } from '@/lib/services/reader-window-service'
import { parseAreaNoteAnchor, parseNoteAnchorColor, serializeAreaNoteAnchor, serializePointNoteAnchor, type NoteAreaRect } from '@/lib/services/document-note-anchor-service'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/localization'
import { useDocumentActions, useDocumentStore } from '@/lib/stores/document-store'
import { useRuntimeState } from '@/lib/stores/runtime-store'

type ReaderAreaHighlight = {
  id: string
  pageNumber: number
  rect: { x: number; y: number; width: number; height: number }
  color: string
}

function isMacLikeWebKitEnvironment() {
  if (typeof navigator === 'undefined') return false

  const platform = (
    (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
    ?? navigator.platform
    ?? ''
  )
  const userAgent = navigator.userAgent ?? ''
  const normalizedPlatform = platform.toLowerCase()
  const normalizedUserAgent = userAgent.toLowerCase()

  const isApplePlatform = normalizedPlatform.includes('mac') || normalizedUserAgent.includes('mac os x')
  const isWebKitEngine = normalizedUserAgent.includes('applewebkit')
  return isApplePlatform && isWebKitEngine
}

function getAdvancedViewerFallbackMessage(error: unknown) {
  const rawMessage = error instanceof Error && error.message.trim()
    ? error.message.trim()
    : 'Advanced PDF rendering is unavailable in this build.'

  const normalizedMessage = rawMessage.toLowerCase()
  const looksLikePdfJsCompatibilityIssue = [
    'unexpected token',
    'setting up fake worker failed',
    'invalid \'workersrc\' type',
    'module specifier',
  ].some((fragment) => normalizedMessage.includes(fragment))

  if (isMacLikeWebKitEnvironment() && looksLikePdfJsCompatibilityIssue) {
    return 'Advanced PDF tools are not supported in this Mac WebKit environment yet. Showing a basic PDF preview instead.'
  }

  return `${rawMessage} Showing a basic PDF preview instead.`
}

type ReaderPrintMode = 'original' | 'highlights' | 'highlights-notes'

const READER_HIGHLIGHT_COLOR_KEY = 'refx-reader-highlight-color'
const READER_NOTE_COLOR_KEY = 'refx-reader-note-color'
const READER_VIEW_STATE_KEY_PREFIX = 'refx-reader-view-state'
const READER_PAGE_RENDER_BUFFER = 1
const READER_DEFAULT_INTERNAL_ZOOM = 150
const READER_MIN_INTERNAL_ZOOM = 25
const READER_MAX_INTERNAL_ZOOM = 375
const READER_BUTTON_ZOOM_STEP = 15
const READER_WHEEL_ZOOM_STEP = 2

const READER_COLOR_OPTIONS = [
  { id: 'yellow', highlight: '#fde047', note: '#f59e0b' },
  { id: 'blue', highlight: '#7dd3fc', note: '#0ea5e9' },
  { id: 'red', highlight: '#fda4af', note: '#ef4444' },
  { id: 'green', highlight: '#86efac', note: '#22c55e' },
  { id: 'purple', highlight: '#d8b4fe', note: '#a855f7' },
] as const

type ReaderColorId = (typeof READER_COLOR_OPTIONS)[number]['id']

function isReaderColorId(value: string): value is ReaderColorId {
  return READER_COLOR_OPTIONS.some((option) => option.id === value)
}

function getReaderColorOption(id: ReaderColorId) {
  return READER_COLOR_OPTIONS.find((option) => option.id === id) ?? READER_COLOR_OPTIONS[0]
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex
  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((value) => Number.isNaN(value))) return hex
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function ReaderColorPalette({
  selectedColorId,
  onSelect,
  type,
  isDeleteMode = false,
  onToggleDeleteMode,
}: {
  selectedColorId: ReaderColorId
  onSelect: (colorId: ReaderColorId) => void
  type: 'highlight' | 'note'
  isDeleteMode?: boolean
  onToggleDeleteMode?: () => void
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-border/80 bg-background/95 px-2 py-1 shadow-sm">
      {READER_COLOR_OPTIONS.map((option) => {
        const swatchColor = type === 'highlight' ? option.highlight : option.note
        const isSelected = option.id === selectedColorId
        return (
          <button
            key={`${type}-${option.id}`}
            type="button"
            aria-label={`${type} color ${option.id}`}
            onClick={() => onSelect(option.id)}
            className={cn(
              'h-5 w-5 rounded-full border transition-transform hover:scale-105',
              isSelected ? 'border-foreground/70 ring-2 ring-foreground/15' : 'border-border/70',
            )}
            style={{ backgroundColor: swatchColor }}
          />
        )
      })}
      {onToggleDeleteMode ? (
        <button
          type="button"
          aria-label={`delete ${type}s`}
          onClick={onToggleDeleteMode}
          className={cn(
            'ml-1 flex h-5 w-5 items-center justify-center rounded-full border transition-transform hover:scale-105',
            isDeleteMode
              ? 'border-red-500 bg-red-500 text-white ring-2 ring-red-500/20'
              : 'border-border/70 bg-background text-red-600',
          )}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  )
}

function highlightText(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return text

  const parsedTerms = parseFlexibleSearchTerms(trimmed)
  const terms = Array.from(new Set([
    ...parsedTerms,
    ...parsedTerms.flatMap((term) => term.split(/\s+/).map((part) => part.trim()).filter((part) => part.length >= 2)),
  ]))
  const pattern = terms
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')
  if (!pattern) return text

  const segments = text.split(new RegExp(`(${pattern})`, 'gi'))

  return segments.map((segment, index) =>
    terms.some((term) => term.toLowerCase() === segment.toLowerCase()) ? (
      <mark key={`${segment}-${index}`} className="bg-amber-200/80 px-0.5 text-inherit shadow-[0_0_0_1px_rgba(217,119,6,0.12)]">
        {segment}
      </mark>
    ) : (
      <span key={`${segment}-${index}`}>{segment}</span>
    ),
  )
}

function firstNonEmptyText(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = (value ?? '').trim()
    if (normalized) return normalized
  }

  return ''
}

function normalizeZoomLevel(value: number) {
  if (!Number.isFinite(value) || value <= 0) return READER_DEFAULT_INTERNAL_ZOOM
  return Math.min(READER_MAX_INTERNAL_ZOOM, Math.max(READER_MIN_INTERNAL_ZOOM, Math.round(value)))
}

function getReaderDisplayedZoom(value: number) {
  return Math.max(25, Math.round((value / READER_DEFAULT_INTERNAL_ZOOM) * 100))
}

function getReaderViewStateKey(documentId: string) {
  return `${READER_VIEW_STATE_KEY_PREFIX}:${documentId}`
}

function buildReaderOccurrenceTerms(query: string, routeTerms: string[], routeQuery: string) {
  const normalizedRouteTerms = Array.from(new Set(routeTerms.map((term) => term.trim()).filter(Boolean)))
  if (query.trim() === routeQuery.trim() && normalizedRouteTerms.length > 0) {
    return normalizedRouteTerms
  }

  return parseFlexibleSearchTerms(query)
}

function buildReaderOccurrenceQuery(terms: string[]): DocumentSearchQuery | null {
  const normalizedTerms = Array.from(new Set(terms.map((term) => term.trim()).filter(Boolean)))
  if (normalizedTerms.length === 0) return null
  if (normalizedTerms.length === 1) return normalizedTerms[0] ?? null
  return {
    combineWith: 'OR',
    queries: normalizedTerms,
  }
}

function getVisibleReaderPages(activePage: number, pageCount: number) {
  const visiblePages = new Set<number>()
  for (let pageNumber = activePage - READER_PAGE_RENDER_BUFFER; pageNumber <= activePage + READER_PAGE_RENDER_BUFFER; pageNumber += 1) {
    if (pageNumber >= 1 && pageNumber <= pageCount) {
      visiblePages.add(pageNumber)
    }
  }

  return Array.from(visiblePages).sort((left, right) => left - right)
}

function getReaderPageNumbers(pageCount: number) {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function hasSelectedText() {
  if (typeof window === 'undefined') return false
  return Boolean(window.getSelection?.()?.toString().trim())
}

function parseAreaHighlight(annotation: repo.DbAnnotation): ReaderAreaHighlight | null {
  if (annotation.kind !== 'highlight') return null
  if (!annotation.content) return null

  try {
    const parsed = JSON.parse(annotation.content) as {
      rect?: { x?: number; y?: number; width?: number; height?: number }
      color?: string
    }

    if (
      typeof parsed.rect?.x !== 'number'
      || typeof parsed.rect?.y !== 'number'
      || typeof parsed.rect?.width !== 'number'
      || typeof parsed.rect?.height !== 'number'
    ) {
      return null
    }

    return {
      id: annotation.id,
      pageNumber: annotation.pageNumber,
      rect: {
        x: clamp01(parsed.rect.x),
        y: clamp01(parsed.rect.y),
        width: clamp01(parsed.rect.width),
        height: clamp01(parsed.rect.height),
      },
      color: parsed.color ?? '#facc15',
    }
  } catch {
    return null
  }
}

function getFloatingHintStyle(
  cursor: { x: number; y: number },
  pageSize: { width: number; height: number },
  hintWidth: number,
) {
  const halfWidth = hintWidth / 2
  const left = Math.min(
    Math.max(cursor.x * pageSize.width, halfWidth + 8),
    Math.max(halfWidth + 8, pageSize.width - halfWidth - 8),
  )
  const top = Math.max(cursor.y * pageSize.height, 28)

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${hintWidth}px`,
  }
}

function ReaderToolbarColorIndicator({
  color,
  label,
  showDeleteMark = false,
}: {
  color: string
  label: string
  showDeleteMark?: boolean
}) {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center" aria-label={label}>
      {showDeleteMark ? (
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow-[0_0_0_1px_rgba(15,23,42,0.2)]">
          <X className="h-3 w-3" />
        </span>
      ) : (
        <span
          className="h-4 w-4 rounded-full border border-background shadow-[0_0_0_1px_rgba(15,23,42,0.2)]"
          style={{ backgroundColor: color }}
        />
      )}
    </span>
  )
}

function RealReaderViewPage() {
  const t = useT()
  const router = useRouter()
  const params = useSearchParams()
  const id = params.get('id') ?? ''
  const queryFromRoute = params.get('query') ?? ''
  const matchTextFromRoute = params.get('matchText') ?? ''
  const pageParam = params.get('page')
  const zoomParam = params.get('zoom')
  const routeTermsParamKey = params.getAll('term').join('\u0000')
  const routeTermsFromParams = useMemo(
    () => routeTermsParamKey.split('\u0000').filter(Boolean),
    [routeTermsParamKey],
  )
  const pageFromRoute = Number(pageParam ?? '1')
  const zoomFromRoute = Number(zoomParam ?? String(READER_DEFAULT_INTERNAL_ZOOM))
  const hasExplicitRoutePage = pageParam !== null
  const hasExplicitRouteZoom = zoomParam !== null
  const returnTo = params.get('returnTo') ?? ''
  const isDetachedReaderWindow = params.get('detached') === DETACHED_READER_QUERY_VALUE
  const documents = useDocumentStore((state) => state.documents)
  const { notes, annotations, loadNotes, refreshData, isDesktopApp } = useRuntimeState()
  const { scanDocumentsOcr, setActiveDocument, updateDocument } = useDocumentActions()
  const document = useMemo(() => documents.find((entry) => entry.id === id) ?? null, [documents, id])
  const [resolvedFilePath, setResolvedFilePath] = useState<string | null>(null)
  const [page, setPage] = useState(Number.isFinite(pageFromRoute) && pageFromRoute > 0 ? pageFromRoute : 1)
  const [zoom, setZoom] = useState(normalizeZoomLevel(zoomFromRoute))
  const [renderZoom, setRenderZoom] = useState(normalizeZoomLevel(zoomFromRoute))
  const [isTextSelectionMode, setIsTextSelectionMode] = useState(false)
  const [isTextSelectionGestureActive, setIsTextSelectionGestureActive] = useState(false)
  const [commentDraftContent, setCommentDraftContent] = useState('')
  const [commentDraftPosition, setCommentDraftPosition] = useState<{ x: number; y: number } | null>(null)
  const [commentDraftAreaRect, setCommentDraftAreaRect] = useState<NoteAreaRect | null>(null)
  const [selectedCommentId, setSelectedCommentId] = useState<string | null>(null)
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const [isDeleteCommentDialogOpen, setIsDeleteCommentDialogOpen] = useState(false)
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false)
  const [isSelectingCommentPosition, setIsSelectingCommentPosition] = useState(false)
  const [isSavingComment, setIsSavingComment] = useState(false)
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const [hasViewerTimedOut, setHasViewerTimedOut] = useState(false)
  const [isRunningOcr, setIsRunningOcr] = useState(false)
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false)
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  const [isHighlightDeleteMode, setIsHighlightDeleteMode] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)
  const [isHighlightPickerOpen, setIsHighlightPickerOpen] = useState(false)
  const [isNotePickerOpen, setIsNotePickerOpen] = useState(false)
  const [selectedHighlightColorId, setSelectedHighlightColorId] = useState<ReaderColorId>('yellow')
  const [selectedNoteColorId, setSelectedNoteColorId] = useState<ReaderColorId>('yellow')
  const [isNoteDeleteMode, setIsNoteDeleteMode] = useState(false)
  const [notePlacementCursor, setNotePlacementCursor] = useState<{ x: number; y: number } | null>(null)
  const [highlightPlacementCursor, setHighlightPlacementCursor] = useState<{ x: number; y: number } | null>(null)
  const [pdfDocument, setPdfDocument] = useState<{ numPages: number; getPage: (pageNumber: number) => Promise<unknown>; destroy?: () => Promise<void> } | null>(null)
  const [embeddedPdfUrl, setEmbeddedPdfUrl] = useState<string | null>(null)
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [viewerMode, setViewerMode] = useState<'pdfjs' | 'native' | 'unavailable'>('pdfjs')
  const [renderedPageSizes, setRenderedPageSizes] = useState<Record<number, { width: number; height: number }>>({})
  const [pageWords, setPageWords] = useState<PdfWord[]>([])
  const [searchQuery, setSearchQuery] = useState(queryFromRoute)
  const [activeOccurrenceIndex, setActiveOccurrenceIndex] = useState(0)
  const [searchOccurrences, setSearchOccurrences] = useState<SearchOccurrence[]>([])
  const occurrenceRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeOccurrenceHighlightRef = useRef<HTMLDivElement | null>(null)
  const commentCardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const noteEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null)
  const shouldAutoScrollOccurrenceRef = useRef(false)
  const shouldEnsureOccurrenceVisibleRef = useRef(false)
  const shouldAutoScrollCommentRef = useRef(false)
  const shouldAutoFocusNoteEditorRef = useRef(false)
  const skipNextTransientTextDismissRef = useRef(false)
  const pageCanvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const pageContainerRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const pageSurfaceRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const readerViewportRef = useRef<HTMLDivElement | null>(null)
  const previousVisiblePageNumbersRef = useRef<number[]>([])
  const lastRenderedZoomRef = useRef(renderZoom)
  const renderedZoomByPageRef = useRef<Record<number, number>>({})
  const zoomFocusRef = useRef<{
    pageNumber: number
    pointX: number
    pointY: number
    anchorX: number
    anchorY: number
    targetZoom: number
  } | null>(null)
  const autoFittedLandscapeDocumentRef = useRef<string | null>(null)
  const pageChangedFromScrollRef = useRef(false)
  const initializedDocumentIdRef = useRef<string | null>(null)
  const routeSelectionKeyRef = useRef<string | null>(null)
  const notePlacementStartRef = useRef<{ x: number; y: number } | null>(null)
  const highlightDragStartRef = useRef<{ x: number; y: number } | null>(null)
  const [draftHighlightRect, setDraftHighlightRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const storedHighlightColor = window.localStorage.getItem(READER_HIGHLIGHT_COLOR_KEY)
    const storedNoteColor = window.localStorage.getItem(READER_NOTE_COLOR_KEY)
    if (storedHighlightColor && isReaderColorId(storedHighlightColor)) {
      setSelectedHighlightColorId(storedHighlightColor)
    }
    if (storedNoteColor && isReaderColorId(storedNoteColor)) {
      setSelectedNoteColorId(storedNoteColor)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(READER_HIGHLIGHT_COLOR_KEY, selectedHighlightColorId)
  }, [selectedHighlightColorId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(READER_NOTE_COLOR_KEY, selectedNoteColorId)
  }, [selectedNoteColorId])

  useEffect(() => {
    setSearchQuery(queryFromRoute)
  }, [queryFromRoute])

  useEffect(() => {
    if (hasExplicitRoutePage && Number.isFinite(pageFromRoute) && pageFromRoute > 0) {
      setPage(pageFromRoute)
    }
  }, [hasExplicitRoutePage, pageFromRoute])

  useEffect(() => {
    if (!hasExplicitRouteZoom) return
    const normalizedZoom = normalizeZoomLevel(zoomFromRoute)
    setZoom(normalizedZoom)
    setRenderZoom(normalizedZoom)
  }, [hasExplicitRouteZoom, zoomFromRoute])

  useEffect(() => {
    const normalizedZoom = normalizeZoomLevel(zoom)
    if (normalizedZoom === renderZoom) return

    const timeout = window.setTimeout(() => {
      setRenderZoom(normalizedZoom)
    }, 180)

    return () => window.clearTimeout(timeout)
  }, [renderZoom, zoom])

  useEffect(() => {
    if (!document) return
    setActiveDocument(document.id)
    if (initializedDocumentIdRef.current !== document.id) {
      let nextPage = document.lastReadPage && document.lastReadPage > 0 ? document.lastReadPage : 1
      let nextZoom = READER_DEFAULT_INTERNAL_ZOOM
      if (typeof window !== 'undefined') {
        try {
          const storedStateRaw = window.localStorage.getItem(getReaderViewStateKey(document.id))
          if (storedStateRaw) {
            const storedState = JSON.parse(storedStateRaw) as { page?: number; zoom?: number }
            if (Number.isFinite(storedState.page) && (storedState.page ?? 0) > 0) {
              nextPage = Math.round(storedState.page as number)
            }
            if (Number.isFinite(storedState.zoom) && (storedState.zoom ?? 0) > 0) {
              nextZoom = normalizeZoomLevel(storedState.zoom as number)
            }
          }
        } catch (error) {
          console.warn('Failed to restore reader view state:', error)
        }
      }

      if (hasExplicitRoutePage && Number.isFinite(pageFromRoute) && pageFromRoute > 0) {
        setPage(pageFromRoute)
      } else {
        setPage(nextPage)
      }

      if (hasExplicitRouteZoom) {
        const normalizedZoom = normalizeZoomLevel(zoomFromRoute)
        setZoom(normalizedZoom)
        setRenderZoom(normalizedZoom)
      } else {
        setZoom(nextZoom)
        setRenderZoom(nextZoom)
      }
    }
    initializedDocumentIdRef.current = document.id
  }, [document?.id, document?.lastReadPage, hasExplicitRoutePage, hasExplicitRouteZoom, pageFromRoute, setActiveDocument, zoomFromRoute])

  useEffect(() => {
    if (typeof window === 'undefined' || !document?.id) return
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          getReaderViewStateKey(document.id),
          JSON.stringify({
            page,
            zoom,
          }),
        )
      } catch (error) {
        console.warn('Failed to persist reader view state:', error)
      }
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [document?.id, page, zoom])

  useEffect(() => {
    if (!document || document.readingStage !== 'unread') return

    const timeout = window.setTimeout(() => {
      void updateDocument(document.id, { readingStage: 'reading' })
    }, 120_000)

    return () => window.clearTimeout(timeout)
  }, [document?.id, document?.readingStage, updateDocument])

  useEffect(() => {
    let cancelled = false

    if (!document?.id || !isDesktopApp || !isTauri()) {
      setResolvedFilePath(document?.filePath ?? null)
      return
    }

    void (async () => {
      try {
        const normalizedPath = await repo.ensureDocumentPdfInStorage(document.id)
        if (!cancelled) {
          setResolvedFilePath(normalizedPath ?? document.filePath ?? null)
        }
      } catch (error) {
        console.warn('Failed to normalize document PDF path for reader:', error)
        if (!cancelled) {
          setResolvedFilePath(document.filePath ?? null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [document?.filePath, document?.id, isDesktopApp])

  const activeFilePath = resolvedFilePath ?? document?.filePath ?? null

  useEffect(() => {
    if (!isDetachedReaderWindow || !isTauri() || !document?.title) return

    void getCurrentWindow().setTitle(`Refx Reader - ${document.title}`)
  }, [document?.title, isDetachedReaderWindow])

  useEffect(() => {
    let cancelled = false
    let loadedPdf: { destroy?: () => Promise<void> } | null = null
    let objectUrl: string | null = null
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !settled) {
        setHasViewerTimedOut(true)
        setIsPdfLoading(false)
      }
    }, 2500)

    const loadPdf = async () => {
      if (!activeFilePath || !isTauri()) {
        settled = true
        setPdfDocument(null)
        setPdfBytes(null)
        setEmbeddedPdfUrl(null)
        setViewerMode('unavailable')
        setRenderedPageSizes({})
        setPageWords([])
        setHasViewerTimedOut(false)
        return
      }

      setHasViewerTimedOut(false)
      setIsPdfLoading(true)

      try {
        const pdfjs = await loadPdfJsModule()
        const payload = document?.id ? await repo.loadDocumentPdfPayload(document.id) : null
        let bytes = new Uint8Array(payload?.bytes ?? [])
        if (!bytes.length && activeFilePath) {
          bytes = new Uint8Array(await readFile(activeFilePath))
        }
        if (!bytes.length) {
          throw new Error('Could not load PDF bytes from desktop storage or the saved document path.')
        }
        if (payload?.path) {
          setResolvedFilePath(payload.path)
        }
        objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
        const task = pdfjs.getDocument({
          data: bytes,
          disableWorker: false,
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

        settled = true
        window.clearTimeout(timeoutId)
        setPdfDocument(nextPdf)
        setPdfBytes(bytes)
        setEmbeddedPdfUrl(objectUrl)
        setViewerMode('pdfjs')
        setViewerError(null)
        setHasViewerTimedOut(false)
        setPage((current) => Math.min(Math.max(1, current), nextPdf.numPages))
      } catch (error) {
        console.error('Failed to load PDF for embedded viewer:', error)
        settled = true
        window.clearTimeout(timeoutId)
        setPdfDocument(null)
        setPdfBytes(null)
        setEmbeddedPdfUrl(objectUrl ?? convertFileSrc(activeFilePath))
        setViewerMode('native')
        setRenderedPageSizes({})
        setPageWords([])
        setHasViewerTimedOut(false)
        setViewerError(getAdvancedViewerFallbackMessage(error))
      } finally {
        if (!cancelled) {
          setIsPdfLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      void loadedPdf?.destroy?.()
    }
  }, [activeFilePath])

  useEffect(() => {
    if (!id || !document) return
    const timeout = window.setTimeout(() => {
      void repo.updateDocumentMetadata(id, {
        lastReadPage: page,
        lastOpenedAt: new Date().toISOString(),
      }).catch((error) => {
        console.warn('Could not save reader progress:', error)
      })
    }, 150)

    return () => window.clearTimeout(timeout)
  }, [document, id, page, updateDocument])

  useEffect(() => {
    let cancelled = false

    const loadOccurrences = async () => {
      if (!document || !searchQuery.trim()) {
        setSearchOccurrences([])
        return
      }

      const occurrenceTerms = buildReaderOccurrenceTerms(searchQuery, routeTermsFromParams, queryFromRoute)
      if (occurrenceTerms.length === 0) {
        setSearchOccurrences([])
        return
      }

      if (viewerMode === 'pdfjs' && activeFilePath && isTauri()) {
        try {
          const results = await findPdfSearchOccurrencesForQueries(activeFilePath, occurrenceTerms, document.pageCount)
          if (!cancelled) {
            setSearchOccurrences(results)
            return
          }
        } catch (error) {
          console.warn('PDF occurrence search failed, falling back to indexed text:', error)
        }
      }

      if (!cancelled) {
        const fallbackQuery = buildReaderOccurrenceQuery(occurrenceTerms)
        const fallbackResults = fallbackQuery ? await findDocumentPageHits(document.id, fallbackQuery) : []
        if (!cancelled) {
          setSearchOccurrences(fallbackResults)
        }
      }
    }

    void loadOccurrences()

    return () => {
      cancelled = true
    }
  }, [activeFilePath, document, queryFromRoute, routeTermsParamKey, searchQuery, viewerMode])

  useEffect(() => {
    let cancelled = false

    const loadPageWords = async () => {
      if (
        !activeFilePath
        || !isTauri()
        || viewerMode !== 'pdfjs'
        || !isTextSelectionMode
      ) {
        setPageWords([])
        return
      }

      try {
        const pages = await extractPdfPageWords(activeFilePath)
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
  }, [activeFilePath, page, viewerMode, isTextSelectionMode])

  const activeOccurrence = searchOccurrences[activeOccurrenceIndex] ?? null
  const selectedHighlightColor = getReaderColorOption(selectedHighlightColorId)
  const selectedNoteColor = getReaderColorOption(selectedNoteColorId)
  const displayedZoom = getReaderDisplayedZoom(zoom)
  const isOverlayZoomTransitioning = zoom !== renderZoom
  const totalPageCount = pdfDocument?.numPages ?? document?.pageCount ?? page
  const allPageNumbers = useMemo(
    () => getReaderPageNumbers(totalPageCount),
    [totalPageCount],
  )
  const visiblePageNumbers = useMemo(
    () => getVisibleReaderPages(page, totalPageCount),
    [page, totalPageCount],
  )
  const renderedPageSize = renderedPageSizes[page] ?? { width: 0, height: 0 }
  const fallbackRenderedPageSize = useMemo(() => {
    const knownSizes = Object.values(renderedPageSizes)
    if (renderedPageSize.width > 0 && renderedPageSize.height > 0) return renderedPageSize
    if (knownSizes.length > 0) return knownSizes[0]
    return { width: 816, height: 1056 }
  }, [renderedPageSize, renderedPageSizes])
  const currentPageOccurrences = useMemo(
    () => searchOccurrences.filter((occurrence) => occurrence.estimatedPage === page),
    [page, searchOccurrences],
  )
  const canUsePreciseViewer = viewerMode === 'pdfjs' && Boolean(pdfDocument)
  const showViewerLoading =
    Boolean(activeFilePath)
    && (isPdfLoading || (!canUsePreciseViewer && !embeddedPdfUrl && !hasViewerTimedOut))
  const currentPageHighlights = useMemo(
    () => currentPageOccurrences.filter((occurrence) => occurrence.rects?.length),
    [currentPageOccurrences],
  )
  const hasExactHighlightOverlay = currentPageHighlights.length > 0
  const occurrencesByPage = useMemo(() => {
    const grouped = new Map<number, SearchOccurrence[]>()
    for (const occurrence of searchOccurrences) {
      const pageNumber = occurrence.estimatedPage
      const currentEntries = grouped.get(pageNumber) ?? []
      currentEntries.push(occurrence)
      grouped.set(pageNumber, currentEntries)
    }
    return grouped
  }, [searchOccurrences])
  const groupedSearchOccurrences = useMemo(() => {
    const normalized = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase()
    const groups: Array<{
      occurrence: SearchOccurrence
      occurrenceIndexes: number[]
      rangeEnd: number
    }> = []

    for (let index = 0; index < searchOccurrences.length; index += 1) {
      const occurrence = searchOccurrences[index]
      if (!occurrence) continue

      const previous = groups[groups.length - 1]
      const overlapThreshold = previous?.occurrence.rects?.length && occurrence.rects?.length ? 10 : 80
      const sameAsPrevious = previous
        && previous.occurrence.estimatedPage === occurrence.estimatedPage
        && (
          normalized(previous.occurrence.snippet) === normalized(occurrence.snippet)
          || occurrence.start <= previous.rangeEnd + overlapThreshold
        )

      if (sameAsPrevious) {
        previous.occurrenceIndexes.push(index)
        previous.rangeEnd = Math.max(previous.rangeEnd, occurrence.end)
        continue
      }

      groups.push({
        occurrence,
        occurrenceIndexes: [index],
        rangeEnd: occurrence.end,
      })
    }

    return groups
  }, [searchOccurrences])
  const occurrenceGroupIndexByOccurrenceIndex = useMemo(() => {
    const mapping = new Map<number, number>()
    groupedSearchOccurrences.forEach((group, groupIndex) => {
      group.occurrenceIndexes.forEach((occurrenceIndex) => {
        mapping.set(occurrenceIndex, groupIndex)
      })
    })
    return mapping
  }, [groupedSearchOccurrences])
  const activeOccurrenceGroupIndexes = useMemo(() => {
    const activeGroupIndex = occurrenceGroupIndexByOccurrenceIndex.get(activeOccurrenceIndex)
    if (activeGroupIndex == null) return new Set<number>([activeOccurrenceIndex])
    return new Set(groupedSearchOccurrences[activeGroupIndex]?.occurrenceIndexes ?? [activeOccurrenceIndex])
  }, [activeOccurrenceIndex, groupedSearchOccurrences, occurrenceGroupIndexByOccurrenceIndex])
  const activeOccurrenceGroupIndex = useMemo(
    () => occurrenceGroupIndexByOccurrenceIndex.get(activeOccurrenceIndex) ?? 0,
    [activeOccurrenceIndex, occurrenceGroupIndexByOccurrenceIndex],
  )
  const currentPageComments = useMemo(
    () => (id ? getDocumentPageComments(notes, id, page) : []),
    [id, notes, page],
  )
  const documentComments = useMemo(
    () =>
      id
        ? [...notes]
            .filter((note) => note.documentId === id)
            .sort((left, right) => {
              const pageDelta = (left.pageNumber ?? 0) - (right.pageNumber ?? 0)
              if (pageDelta !== 0) return pageDelta
              const commentDelta = (left.commentNumber ?? 0) - (right.commentNumber ?? 0)
              if (commentDelta !== 0) return commentDelta
              return left.createdAt.localeCompare(right.createdAt)
            })
        : [],
    [id, notes],
  )
  const commentsByPage = useMemo(() => {
    const grouped = new Map<number, typeof currentPageComments>()
    if (!id) return grouped
    for (const pageNumber of allPageNumbers) {
      grouped.set(pageNumber, getDocumentPageComments(notes, id, pageNumber))
    }
    return grouped
  }, [allPageNumbers, id, notes])
  const currentPageAreaHighlights = useMemo(
    () =>
      (id
        ? annotations
            .filter((annotation) => annotation.documentId === id && annotation.pageNumber === page)
            .map(parseAreaHighlight)
            .filter((annotation): annotation is ReaderAreaHighlight => Boolean(annotation))
        : []),
    [annotations, id, page],
  )
  const areaHighlightsByPage = useMemo(() => {
    const grouped = new Map<number, ReaderAreaHighlight[]>()
    if (!id) return grouped
    for (const annotation of annotations) {
      if (annotation.documentId !== id || annotation.pageNumber == null) continue
      const parsed = parseAreaHighlight(annotation)
      if (!parsed) continue
      const currentEntries = grouped.get(annotation.pageNumber) ?? []
      currentEntries.push(parsed)
      grouped.set(annotation.pageNumber, currentEntries)
    }
    return grouped
  }, [annotations, id])
  const nextCommentNumber = useMemo(
    () => (id ? getNextDocumentCommentNumber(notes, id) : 1),
    [id, notes],
  )
  const selectedComment = useMemo(
    () => currentPageComments.find((entry) => entry.id === selectedCommentId) ?? null,
    [currentPageComments, selectedCommentId],
  )
  const positionedPageComments = useMemo(
    () =>
      currentPageComments.filter(
        (comment) => typeof comment.positionX === 'number' && typeof comment.positionY === 'number',
      ),
    [currentPageComments],
  )
  const noteAreaComments = useMemo(
    () => positionedPageComments.filter((comment) => comment.areaRect),
    [positionedPageComments],
  )
  const notePointComments = useMemo(
    () => positionedPageComments.filter((comment) => !comment.areaRect),
    [positionedPageComments],
  )
  const draftNotePreview = useMemo(() => {
    if (selectedCommentId || !commentDraftPosition) return null

    return {
      position: commentDraftPosition,
      areaRect: commentDraftAreaRect,
      commentNumber: nextCommentNumber,
    }
  }, [commentDraftAreaRect, commentDraftPosition, nextCommentNumber, selectedCommentId])

  useEffect(() => {
    if (isSavingComment) return
    if (selectedCommentId && !currentPageComments.some((comment) => comment.id === selectedCommentId)) {
      setSelectedCommentId(null)
    }
  }, [currentPageComments, isSavingComment, selectedCommentId])

  useEffect(() => {
    if (selectedComment) {
      setCommentDraftContent(selectedComment.content)
      setCommentDraftPosition(
        typeof selectedComment.positionX === 'number' && typeof selectedComment.positionY === 'number'
          ? { x: selectedComment.positionX, y: selectedComment.positionY }
          : null,
      )
      setCommentDraftAreaRect(selectedComment.areaRect ?? null)
    } else {
      setCommentDraftContent('')
      setCommentDraftPosition(null)
      setCommentDraftAreaRect(null)
    }
  }, [page, selectedComment?.areaRect, selectedComment?.content, selectedComment?.id, selectedComment?.positionX, selectedComment?.positionY])

  useEffect(() => {
    setCommentDraftAreaRect(null)
    notePlacementStartRef.current = null
    setNotePlacementCursor(null)
    setDraftHighlightRect(null)
    setHighlightPlacementCursor(null)
    highlightDragStartRef.current = null
    setIsTextSelectionGestureActive(false)
  }, [page])

  useEffect(() => {
    setActiveOccurrenceIndex(0)
    shouldAutoScrollOccurrenceRef.current = false
  }, [searchQuery, document?.id])

  useEffect(() => {
    if (shouldAutoScrollOccurrenceRef.current) {
      const groupIndex = occurrenceGroupIndexByOccurrenceIndex.get(activeOccurrenceIndex) ?? activeOccurrenceIndex
      occurrenceRefs.current[groupIndex]?.scrollIntoView({ block: 'nearest' })
      shouldAutoScrollOccurrenceRef.current = false
    }
  }, [activeOccurrenceIndex, occurrenceGroupIndexByOccurrenceIndex])

  useEffect(() => {
    if (!shouldEnsureOccurrenceVisibleRef.current) return
    if (activeOccurrence?.estimatedPage !== page) return

    const highlightedRect = activeOccurrenceHighlightRef.current
    if (!highlightedRect) return

    highlightedRect.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'auto',
    })
    shouldEnsureOccurrenceVisibleRef.current = false
  }, [activeOccurrence, page, renderZoom, visiblePageNumbers])

  useEffect(() => {
    if (shouldAutoScrollCommentRef.current && selectedCommentId) {
      commentCardRefs.current[selectedCommentId]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      shouldAutoScrollCommentRef.current = false
    }
  }, [selectedCommentId])

  useEffect(() => {
    if (!isNoteEditorOpen || !shouldAutoFocusNoteEditorRef.current) return

    const rafId = window.requestAnimationFrame(() => {
      noteEditorTextareaRef.current?.focus()
      shouldAutoFocusNoteEditorRef.current = false
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [isNoteEditorOpen])

  const isTextSelectionLayerVisible = isTextSelectionMode
  const hasNativeTextLayer = document?.hasExtractedText && document.textExtractionStatus === 'complete'

  const deactivateTextSelectionMode = () => {
    window.getSelection?.()?.removeAllRanges()
    skipNextTransientTextDismissRef.current = false
    setIsTextSelectionGestureActive(false)
    setIsTextSelectionMode(false)
  }

  const handleTextSelectionGestureStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isTextSelectionMode) return
    if (!canUsePreciseViewer || isHighlightMode || isSelectingCommentPosition) return
    if (event.button !== 0) return
    setIsTextSelectionGestureActive(true)
  }

  const handleTextSelectionGestureEnd = () => {
    if (!isTextSelectionMode) return
    setIsTextSelectionGestureActive(false)
  }

  const handleTransientTextSelectionDismiss = () => {
    if (isTextSelectionMode || !isTextSelectionGestureActive) return
    if (skipNextTransientTextDismissRef.current) {
      skipNextTransientTextDismissRef.current = false
      return
    }
    if (!hasSelectedText()) {
      setIsTextSelectionGestureActive(false)
      return
    }
    window.getSelection?.()?.removeAllRanges()
    setIsTextSelectionGestureActive(false)
  }

  const captureViewportCenterZoomAnchor = (targetZoom: number) => {
    const viewport = readerViewportRef.current
    if (!viewport) return false

    const viewportRect = viewport.getBoundingClientRect()
    const centerX = viewportRect.width / 2
    const centerY = viewportRect.height / 2
    const centerClientX = viewportRect.left + centerX
    const centerClientY = viewportRect.top + centerY
    let focusedPageNumber: number | null = null
    let focusedPageElement: HTMLDivElement | null = null
    let bestScore = Number.POSITIVE_INFINITY

    for (const [pageNumber, element] of Object.entries(pageSurfaceRefs.current)) {
      if (!element) continue
      const rect = element.getBoundingClientRect()
      const horizontalDistance =
        centerClientX < rect.left
          ? rect.left - centerClientX
          : centerClientX > rect.right
            ? centerClientX - rect.right
            : 0
      const verticalDistance =
        centerClientY < rect.top
          ? rect.top - centerClientY
          : centerClientY > rect.bottom
            ? centerClientY - rect.bottom
            : 0
      const score = verticalDistance + (horizontalDistance * 0.25)

      if (score < bestScore) {
        bestScore = score
        focusedPageNumber = Number(pageNumber)
        focusedPageElement = element
      }
    }

    if (focusedPageNumber === null || !focusedPageElement) return false
    const pageRect = focusedPageElement.getBoundingClientRect()
    const clampedClientX = Math.min(pageRect.right, Math.max(pageRect.left, centerClientX))
    const clampedClientY = Math.min(pageRect.bottom, Math.max(pageRect.top, centerClientY))

    zoomFocusRef.current = {
      pageNumber: focusedPageNumber,
      pointX: pageRect.width > 0 ? Math.min(1, Math.max(0, (clampedClientX - pageRect.left) / pageRect.width)) : 0.5,
      pointY: pageRect.height > 0 ? Math.min(1, Math.max(0, (clampedClientY - pageRect.top) / pageRect.height)) : 0.5,
      anchorX: centerX,
      anchorY: centerY,
      targetZoom,
    }

    return true
  }

  const fitCurrentPageToViewport = async () => {
    const viewportElement = readerViewportRef.current
    if (!pdfDocument || !viewportElement) return false
    const pdfPage = await pdfDocument.getPage(page) as {
      getViewport: (args: { scale: number }) => { width: number; height: number }
    }
    const baseSize = pdfPage.getViewport({ scale: 1 })
    if (baseSize.width <= 0 || baseSize.height <= 0) return false
    const availableWidth = Math.max(1, viewportElement.clientWidth - 48)
    const availableHeight = Math.max(1, viewportElement.clientHeight - 48)
    const nextZoom = normalizeZoomLevel(Math.min(
      availableWidth / baseSize.width,
      availableHeight / baseSize.height,
    ) * 100)
    setZoom(nextZoom)
    return true
  }

  useEffect(() => {
    if (!document || !pdfDocument || autoFittedLandscapeDocumentRef.current === document.id) return
    let cancelled = false
    const fitLandscapePage = async () => {
      const pdfPage = await pdfDocument.getPage(page) as {
        getViewport: (args: { scale: number }) => { width: number; height: number }
      }
      const baseSize = pdfPage.getViewport({ scale: 1 })
      if (cancelled || baseSize.width <= baseSize.height) return
      autoFittedLandscapeDocumentRef.current = document.id
      await fitCurrentPageToViewport()
    }
    void fitLandscapePage()
    return () => { cancelled = true }
  }, [document, pdfDocument, page])

  useLayoutEffect(() => {
    const focus = zoomFocusRef.current
    if (!focus) return

    const viewport = readerViewportRef.current
    const pageElement = pageSurfaceRefs.current[focus.pageNumber]
    if (!viewport || !pageElement) return

    // Re-anchor the same page-relative point to the same viewport point during preview and final render.
    const viewportRect = viewport.getBoundingClientRect()
    const pageRect = pageElement.getBoundingClientRect()
    const nextScrollLeft = viewport.scrollLeft + ((pageRect.left + (pageRect.width * focus.pointX)) - (viewportRect.left + focus.anchorX))
    const nextScrollTop = viewport.scrollTop + ((pageRect.top + (pageRect.height * focus.pointY)) - (viewportRect.top + focus.anchorY))

    viewport.scrollLeft = nextScrollLeft
    viewport.scrollTop = nextScrollTop

    const focusedPageRenderedZoom = renderedZoomByPageRef.current[focus.pageNumber]
    if (renderZoom === focus.targetZoom && focusedPageRenderedZoom === focus.targetZoom) {
      zoomFocusRef.current = null
    }
  }, [zoom, renderZoom, page, renderedPageSizes, visiblePageNumbers])

  useEffect(() => {
    const viewport = readerViewportRef.current
    if (!viewport) return

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const zoomStep = event.deltaY < 0 ? READER_WHEEL_ZOOM_STEP : -READER_WHEEL_ZOOM_STEP
        setZoom((current) => {
          const nextZoom = Math.max(READER_MIN_INTERNAL_ZOOM, Math.min(READER_MAX_INTERNAL_ZOOM, current + zoomStep))
          void captureViewportCenterZoomAnchor(nextZoom)
          return nextZoom
        })
      }
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      viewport.removeEventListener('wheel', handleWheel)
    }
  }, [])

  useEffect(() => {
    const viewport = readerViewportRef.current
    if (!viewport || allPageNumbers.length === 0) return

    let rafId = 0

    const updateActivePage = () => {
      rafId = 0
      if (zoomFocusRef.current) return
      const viewportRect = viewport.getBoundingClientRect()
      const viewportCenter = viewportRect.top + (viewportRect.height / 2)
      let closestPage = page
      let closestDistance = Number.POSITIVE_INFINITY

      for (const pageNumber of allPageNumbers) {
        const pageElement = pageContainerRefs.current[pageNumber]
        if (!pageElement) continue
        const rect = pageElement.getBoundingClientRect()
        const pageCenter = rect.top + (rect.height / 2)
        const distance = Math.abs(pageCenter - viewportCenter)
        if (distance < closestDistance) {
          closestDistance = distance
          closestPage = pageNumber
        }
      }

      if (closestPage !== page) {
        pageChangedFromScrollRef.current = true
        setPage(closestPage)
      }
    }

    const handleScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(updateActivePage)
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      viewport.removeEventListener('scroll', handleScroll)
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [allPageNumbers, page])

  useEffect(() => {
    if (zoomFocusRef.current) return
    if (pageChangedFromScrollRef.current) {
      pageChangedFromScrollRef.current = false
      return
    }

    const viewport = readerViewportRef.current
    const pageElement = pageContainerRefs.current[page]
    if (!viewport || !pageElement) return

    const viewportRect = viewport.getBoundingClientRect()
    const pageRect = pageElement.getBoundingClientRect()
    const paddedTop = viewportRect.top + 24
    const paddedBottom = viewportRect.bottom - 24
    const isFullyVisible = pageRect.top >= paddedTop && pageRect.bottom <= paddedBottom

    if (!isFullyVisible) {
      pageElement.scrollIntoView({ block: 'center' })
    }
  }, [page, visiblePageNumbers])

  useEffect(() => {
    let cancelled = false
    const renderTasks = new Map<number, { promise?: Promise<void>; cancel?: () => void }>()
    const previousVisiblePageNumbers = previousVisiblePageNumbersRef.current
    const shouldRerenderVisiblePages = lastRenderedZoomRef.current !== renderZoom
    const pagesToRender = shouldRerenderVisiblePages
      ? visiblePageNumbers
      : visiblePageNumbers.filter((pageNumber) => {
          if (!previousVisiblePageNumbers.includes(pageNumber)) return true
          return renderedZoomByPageRef.current[pageNumber] !== renderZoom
        })

    previousVisiblePageNumbersRef.current = visiblePageNumbers
    lastRenderedZoomRef.current = renderZoom

    const renderVisiblePages = async () => {
      if (!pdfDocument || pagesToRender.length === 0) return

      try {
        const scale = renderZoom / 100
        const devicePixelRatio = window.devicePixelRatio || 1
        await Promise.all(pagesToRender.map(async (pageNumber) => {
          const canvas = pageCanvasRefs.current[pageNumber]
          if (!canvas) return

          const pdfPage = (await pdfDocument.getPage(pageNumber)) as {
            getViewport: (args: { scale: number }) => { width: number; height: number }
            render: (args: {
              canvasContext: CanvasRenderingContext2D
              viewport: { width: number; height: number }
              transform?: number[]
            }) => { promise: Promise<void>; cancel?: () => void }
            cleanup?: () => void
          }
          if (cancelled) return

          const viewport = pdfPage.getViewport({ scale })
          const context = canvas.getContext('2d')
          if (!context) return

          canvas.width = Math.ceil(viewport.width * devicePixelRatio)
          canvas.height = Math.ceil(viewport.height * devicePixelRatio)
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`
          context.setTransform(1, 0, 0, 1, 0, 0)
          context.clearRect(0, 0, canvas.width, canvas.height)

          const renderTask = pdfPage.render({
            canvasContext: context,
            viewport,
            transform: devicePixelRatio === 1 ? undefined : [devicePixelRatio, 0, 0, devicePixelRatio, 0, 0],
          })
          renderTasks.set(pageNumber, renderTask)
          await renderTask.promise

          if (!cancelled) {
            renderedZoomByPageRef.current[pageNumber] = renderZoom
            setRenderedPageSizes((current) => {
              const nextSize = { width: viewport.width, height: viewport.height }
              const currentSize = current[pageNumber]
              if (
                currentSize
                && currentSize.width === nextSize.width
                && currentSize.height === nextSize.height
              ) {
                return current
              }

              return {
                ...current,
                [pageNumber]: nextSize,
              }
            })
          }

          pdfPage.cleanup?.()
        }))
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to render PDF page:', error)
          setViewerError('Embedded PDF preview is unavailable. Open this document in your system PDF app.')
        }
      }
    }

    void renderVisiblePages()

    return () => {
      cancelled = true
      renderTasks.forEach((task) => task.cancel?.())
    }
  }, [pdfDocument, renderZoom, visiblePageNumbers])

  const selectOccurrence = (index: number, options?: { jumpToPage?: boolean }) => {
    const occurrence = searchOccurrences[index]
    if (!occurrence) return

    shouldAutoScrollOccurrenceRef.current = true
    shouldEnsureOccurrenceVisibleRef.current = true
    setActiveOccurrenceIndex(index)
    const targetZoom = Math.max(zoom, READER_DEFAULT_INTERNAL_ZOOM)
    if (targetZoom !== zoom) {
      setZoom(targetZoom)
    }
    if (options?.jumpToPage) {
      setPage(occurrence.estimatedPage)
    }
  }

  const rotateOccurrence = (direction: 'next' | 'prev') => {
    if (groupedSearchOccurrences.length === 0) return
    const nextGroupIndex =
      direction === 'next'
        ? (activeOccurrenceGroupIndex + 1) % groupedSearchOccurrences.length
        : (activeOccurrenceGroupIndex - 1 + groupedSearchOccurrences.length) % groupedSearchOccurrences.length
    const nextOccurrenceIndex = groupedSearchOccurrences[nextGroupIndex]?.occurrenceIndexes[0]
    if (typeof nextOccurrenceIndex !== 'number') return
    selectOccurrence(nextOccurrenceIndex, { jumpToPage: true })
  }

  useEffect(() => {
    if (!searchQuery.trim() || searchOccurrences.length === 0) return
    if (searchQuery.trim() !== queryFromRoute.trim()) return

    const routeKey = `${document?.id ?? ''}:${queryFromRoute}:${pageFromRoute}:${matchTextFromRoute}`
    if (routeSelectionKeyRef.current === routeKey) return

    const normalizedRouteMatch = matchTextFromRoute.trim().toLowerCase()
    const targetPage = Number.isFinite(pageFromRoute) && pageFromRoute > 0 ? pageFromRoute : undefined
    let nextIndex = -1

    if (targetPage && normalizedRouteMatch) {
      nextIndex = searchOccurrences.findIndex((occurrence) =>
        occurrence.estimatedPage === targetPage
        && firstNonEmptyText(occurrence.matchedText, occurrence.snippet).toLowerCase().includes(normalizedRouteMatch),
      )
    }

    if (nextIndex < 0 && targetPage) {
      nextIndex = searchOccurrences.findIndex((occurrence) => occurrence.estimatedPage === targetPage)
    }

    if (nextIndex < 0 && normalizedRouteMatch) {
      nextIndex = searchOccurrences.findIndex((occurrence) =>
        firstNonEmptyText(occurrence.matchedText, occurrence.snippet).toLowerCase().includes(normalizedRouteMatch),
      )
    }

    if (nextIndex >= 0) {
      routeSelectionKeyRef.current = routeKey
      selectOccurrence(nextIndex, { jumpToPage: true })
    }
  }, [document?.id, matchTextFromRoute, pageFromRoute, queryFromRoute, searchOccurrences, searchQuery])

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

    await repo.updateDocumentMetadata(document.id, {
      sourcePath: selected,
      importedFilePath: destination,
      textExtractionStatus: 'pending',
      ocrStatus: 'pending',
      indexingStatus: 'pending',
      tagSuggestionStatus: 'pending',
      classificationResult: '',
      classificationTextHash: '',
      classificationStatus: 'pending',
      processingError: '',
      processingUpdatedAt: new Date().toISOString(),
    })
    await refreshData()
  }

  const runOcrForDocument = async () => {
    if (!isDesktopApp || !document?.id || !activeFilePath) return

    setIsRunningOcr(true)
    try {
      await scanDocumentsOcr([document.id])
    } finally {
      setIsRunningOcr(false)
    }
  }

  const detachReaderWindow = async () => {
    if (!document?.id) return

    await openDetachedReaderWindow({
      documentId: document.id,
      title: document.title,
      page,
      zoom,
      query: searchQuery.trim() || undefined,
      matchText: firstNonEmptyText(activeOccurrence?.matchedText, activeOccurrence?.snippet) || undefined,
    })
  }

  const handlePrintDocument = async (mode: ReaderPrintMode) => {
    if (!document || !activeFilePath || !isTauri()) return
    const currentDocument = document
    const filePath = activeFilePath

    setIsPrinting(true)
    setIsPrintOptionsOpen(false)

    const printFrame = window.document.createElement('iframe')
    printFrame.setAttribute('aria-hidden', 'true')
    printFrame.style.position = 'fixed'
    printFrame.style.right = '0'
    printFrame.style.bottom = '0'
    printFrame.style.width = '1px'
    printFrame.style.height = '1px'
    printFrame.style.opacity = '0'
    printFrame.style.pointerEvents = 'none'
    printFrame.style.border = '0'
    window.document.body.appendChild(printFrame)

    const printWindow = printFrame.contentWindow
    if (!printWindow) {
      printFrame.remove()
      setIsPrinting(false)
      return
    }

    printWindow.document.open()
    printWindow.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${currentDocument.title} - Print</title>
    <style>
      :root { color-scheme: light; }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      @page {
        size: A4 portrait;
        margin: 4mm;
      }
      body {
        margin: 0;
        background: #f5f5f4;
        color: #111827;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      .print-shell {
        padding: 24px;
      }
      .print-status {
        color: #6b7280;
        font-size: 14px;
      }
      .print-page {
        position: relative;
        display: block;
        width: 202mm;
        height: 289mm;
        margin: 0 auto 24px;
        background: white;
        box-shadow: 0 8px 28px rgba(15, 23, 42, 0.12);
        overflow: visible;
        font-size: 0;
        line-height: 0;
      }
      .print-page img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
        object-position: center;
      }
      .print-page-layout {
        display: flex;
        width: 100%;
        height: 100%;
      }
      .print-page-figure {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
      }
      .print-page--with-notes .print-page-figure {
        width: 138mm;
        flex: 0 0 138mm;
      }
      .print-notes-pane {
        width: 60mm;
        flex: 0 0 60mm;
        border-left: 1px solid #d1d5db;
        background: #fafaf9;
        padding: 10mm 6mm 8mm;
        display: flex;
        flex-direction: column;
        gap: 4mm;
      }
      .print-notes-header {
        font-size: 11px;
        line-height: 1.4;
        font-weight: 700;
        color: #374151;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .print-notes-list {
        display: flex;
        flex-direction: column;
        gap: 4mm;
      }
      .print-note-card {
        border: 1px solid #d6d3d1;
        background: white;
        border-radius: 8px;
        padding: 3mm;
        font-size: 11px;
        line-height: 1.45;
        color: #1f2937;
        break-inside: avoid;
      }
      .print-note-label {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 20px;
        height: 20px;
        border-radius: 999px;
        margin-bottom: 2mm;
        padding: 0 6px;
        font-size: 10px;
        line-height: 1;
        font-weight: 700;
        color: white;
      }
      .print-note-title {
        margin: 0 0 1.5mm;
        font-size: 11px;
        line-height: 1.35;
        font-weight: 700;
        color: #111827;
      }
      .print-note-body {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .print-notes-empty {
        font-size: 11px;
        line-height: 1.45;
        color: #6b7280;
      }
      .overlay {
        position: absolute;
        inset: 0;
        overflow: visible;
      }
      .search-highlight {
        position: absolute;
        border-radius: 2px;
      }
      @media print {
        body {
          background: white;
        }
        .print-shell {
          padding: 0;
        }
        .print-status {
          display: none;
        }
        .print-page {
          width: 202mm;
          height: 289mm;
          margin: 0;
          box-shadow: none;
          overflow: hidden;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .print-page:not(:last-child) {
          break-after: page;
          page-break-after: always;
        }
        .print-note-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      }
    </style>
  </head>
  <body>
    <div class="print-shell">
      <div id="print-status" class="print-status">Preparing document for printing...</div>
      <div id="print-pages"></div>
    </div>
  </body>
</html>`)
    printWindow.document.close()

    const statusEl = printWindow.document.getElementById('print-status')
    const pagesRoot = printWindow.document.getElementById('print-pages')

    if (!statusEl || !pagesRoot) {
      printFrame.remove()
      setIsPrinting(false)
      return
    }

    const includeHighlights = mode !== 'original'
    const includeNotesText = mode === 'highlights-notes'

      try {
        const allAreaHighlights = annotations
        .filter((annotation) => annotation.documentId === currentDocument.id)
        .map(parseAreaHighlight)
        .filter((annotation): annotation is ReaderAreaHighlight => Boolean(annotation))

      const areaHighlightsByPage = new Map<number, ReaderAreaHighlight[]>()
      for (const highlight of allAreaHighlights) {
        const existing = areaHighlightsByPage.get(highlight.pageNumber) ?? []
        existing.push(highlight)
        areaHighlightsByPage.set(highlight.pageNumber, existing)
      }

      const noteOverlaysByPage = new Map<number, Array<{
        id: string
        commentNumber: number
        positionX: number
        positionY: number
        areaRect: NoteAreaRect | null
        color: string
        title: string
        content: string
      }>>()

      for (const note of notes) {
        if (note.documentId !== currentDocument.id) continue
        if (typeof note.pageNumber !== 'number') continue
        if (typeof note.positionX !== 'number' || typeof note.positionY !== 'number') continue

        const existing = noteOverlaysByPage.get(note.pageNumber) ?? []
        existing.push({
          id: note.id,
          commentNumber: note.commentNumber ?? nextCommentNumber,
          positionX: note.positionX,
          positionY: note.positionY,
          areaRect: parseAreaNoteAnchor(note.locationHint),
          color: parseNoteAnchorColor(note.locationHint) ?? getReaderColorOption('yellow').note,
          title: note.title?.trim() || buildDocumentCommentTitle(note.commentNumber ?? nextCommentNumber),
          content: note.content?.trim() || '',
        })
        noteOverlaysByPage.set(note.pageNumber, existing)
      }

      noteOverlaysByPage.forEach((pageNotes, pageNumber) => {
        noteOverlaysByPage.set(
          pageNumber,
          [...pageNotes].sort((left, right) => left.commentNumber - right.commentNumber),
        )
      })

      const searchHighlightsByPage = new Map<number, Array<{
        occurrenceIndex: number
        rect: { left: number; top: number; width: number; height: number }
        isActive: boolean
      }>>()

      for (const occurrence of searchOccurrences) {
        if (!occurrence.rects?.length) continue
        const existing = searchHighlightsByPage.get(occurrence.estimatedPage) ?? []
        for (const rect of occurrence.rects) {
          existing.push({
            occurrenceIndex: occurrence.index,
            rect,
            isActive: activeOccurrenceGroupIndexes.has(occurrence.index),
          })
        }
        searchHighlightsByPage.set(occurrence.estimatedPage, existing)
      }

      const pdfjs = await loadPdfJsModule() as unknown as {
        getDocument: (source: Record<string, unknown>) => { promise: Promise<{
          numPages: number
          getPage: (pageNumber: number) => Promise<{
            getViewport: (args: { scale: number }) => { width: number; height: number }
            render: (args: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> }
            cleanup?: () => void
          }>
          destroy?: () => Promise<void>
        }> }
      }

      const bytes = await readFile(filePath)
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes),
        disableWorker: false,
        useWorkerFetch: false,
        isEvalSupported: false,
        stopAtErrors: false,
      })

      const printablePdf = await loadingTask.promise

      try {
        for (let pageNumber = 1; pageNumber <= printablePdf.numPages; pageNumber += 1) {
          statusEl.textContent = `Preparing page ${pageNumber} of ${printablePdf.numPages}...`

          const pdfPage = await printablePdf.getPage(pageNumber)
          const baseViewport = pdfPage.getViewport({ scale: 1 })
          const renderViewport = pdfPage.getViewport({ scale: 2 })
          const renderCanvas = window.document.createElement('canvas')
          renderCanvas.width = Math.ceil(renderViewport.width)
          renderCanvas.height = Math.ceil(renderViewport.height)
          const renderContext = renderCanvas.getContext('2d')
          if (!renderContext) continue

          await pdfPage.render({
            canvasContext: renderContext,
            viewport: renderViewport,
          }).promise

          const pageSection = printWindow.document.createElement('section')
          pageSection.className = 'print-page'
          const scaleX = renderViewport.width / baseViewport.width
          const scaleY = renderViewport.height / baseViewport.height

          if (includeHighlights) {
            const searchHighlights = searchHighlightsByPage.get(pageNumber) ?? []
            for (const searchHighlight of searchHighlights) {
              const left = searchHighlight.rect.left * scaleX
              const top = searchHighlight.rect.top * scaleY
              const width = searchHighlight.rect.width * scaleX
              const height = Math.max(10 * scaleY, searchHighlight.rect.height * scaleY)
              renderContext.fillStyle = searchHighlight.isActive ? 'rgba(253, 224, 71, 0.34)' : 'rgba(186, 230, 253, 0.18)'
              renderContext.fillRect(left, top, width, height)
              if (searchHighlight.isActive) {
                renderContext.strokeStyle = 'rgba(245, 158, 11, 0.38)'
                renderContext.lineWidth = Math.max(1, scaleX * 0.8)
                renderContext.strokeRect(left, top, width, height)
              }
            }

            const savedHighlights = areaHighlightsByPage.get(pageNumber) ?? []
            for (const highlight of savedHighlights) {
              const left = highlight.rect.x * renderViewport.width
              const top = highlight.rect.y * renderViewport.height
              const width = highlight.rect.width * renderViewport.width
              const height = highlight.rect.height * renderViewport.height
              renderContext.fillStyle = hexToRgba(highlight.color, 0.18)
              renderContext.fillRect(left, top, width, height)
              renderContext.strokeStyle = hexToRgba(highlight.color, 0.12)
              renderContext.lineWidth = Math.max(1, scaleX * 0.45)
              renderContext.strokeRect(left, top, width, height)
            }
          }

          const noteOverlays = noteOverlaysByPage.get(pageNumber) ?? []
          const hasPageNotes = includeNotesText && noteOverlays.length > 0
          if (hasPageNotes) {
            pageSection.classList.add('print-page--with-notes')
          }
          if (includeNotesText) {
            for (const note of noteOverlays) {
              const badgeText = String(note.commentNumber)
              const badgeHeight = Math.max(24, 24 * scaleY)
              const badgeRadius = badgeHeight / 2
              renderContext.font = `${Math.max(11, 11 * scaleY)}px "Segoe UI", Arial, sans-serif`
              const textMetrics = renderContext.measureText(badgeText)
              const badgeWidth = Math.max(badgeHeight, textMetrics.width + 12 * scaleX)

              if (note.areaRect) {
                const left = note.areaRect.x * renderViewport.width
                const top = note.areaRect.y * renderViewport.height
                const width = note.areaRect.width * renderViewport.width
                const height = note.areaRect.height * renderViewport.height
                renderContext.fillStyle = hexToRgba(note.color, 0.16)
                renderContext.fillRect(left, top, width, height)
                renderContext.strokeStyle = hexToRgba(note.color, 0.12)
                renderContext.lineWidth = Math.max(1, scaleX * 0.45)
                renderContext.strokeRect(left, top, width, height)

                const badgeX = left + 6 * scaleX
                const badgeY = top + 6 * scaleY
                renderContext.fillStyle = note.color
                renderContext.beginPath()
                renderContext.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, badgeRadius)
                renderContext.fill()
                renderContext.fillStyle = '#ffffff'
                renderContext.textAlign = 'center'
                renderContext.textBaseline = 'middle'
                renderContext.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2)
                continue
              }

              const centerX = note.positionX * renderViewport.width
              const centerY = note.positionY * renderViewport.height - badgeHeight / 2
              renderContext.fillStyle = note.color
              renderContext.beginPath()
              renderContext.roundRect(centerX - badgeWidth / 2, centerY - badgeHeight / 2, badgeWidth, badgeHeight, badgeRadius)
              renderContext.fill()
              renderContext.fillStyle = '#ffffff'
              renderContext.textAlign = 'center'
              renderContext.textBaseline = 'middle'
              renderContext.fillText(badgeText, centerX, centerY)
            }
          }

          const pageLayout = printWindow.document.createElement('div')
          pageLayout.className = 'print-page-layout'
          const pageFigure = printWindow.document.createElement('div')
          pageFigure.className = 'print-page-figure'
          const pageImage = printWindow.document.createElement('img')
          pageImage.src = renderCanvas.toDataURL('image/png')
          pageImage.alt = `${currentDocument.title} page ${pageNumber}`
          pageFigure.appendChild(pageImage)
          pageLayout.appendChild(pageFigure)

          if (hasPageNotes) {
            const notesPane = printWindow.document.createElement('aside')
            notesPane.className = 'print-notes-pane'
            const notesHeader = printWindow.document.createElement('div')
            notesHeader.className = 'print-notes-header'
            notesHeader.textContent = `Comments - Page ${pageNumber}`
            notesPane.appendChild(notesHeader)

            const notesList = printWindow.document.createElement('div')
            notesList.className = 'print-notes-list'
            for (const note of noteOverlays) {
              const noteCard = printWindow.document.createElement('section')
              noteCard.className = 'print-note-card'

              const noteLabel = printWindow.document.createElement('div')
              noteLabel.className = 'print-note-label'
              noteLabel.textContent = String(note.commentNumber)
              noteLabel.style.backgroundColor = note.color
              noteCard.appendChild(noteLabel)

              const noteTitle = printWindow.document.createElement('h3')
              noteTitle.className = 'print-note-title'
              noteTitle.textContent = note.title
              noteCard.appendChild(noteTitle)

              const noteBody = printWindow.document.createElement('p')
              noteBody.className = 'print-note-body'
              noteBody.textContent = note.content || 'No comment text.'
              noteCard.appendChild(noteBody)

              notesList.appendChild(noteCard)
            }
            notesPane.appendChild(notesList)

            pageLayout.appendChild(notesPane)
          }

          pageSection.appendChild(pageLayout)
          pagesRoot.appendChild(pageSection)
          pdfPage.cleanup?.()
        }
      } finally {
        await printablePdf.destroy?.()
      }

      statusEl.remove()
      printWindow.focus()
      const cleanupPrintFrame = () => {
        window.setTimeout(() => {
          printFrame.remove()
        }, 400)
      }
      printWindow.addEventListener('afterprint', cleanupPrintFrame, { once: true })
      window.setTimeout(() => {
        printWindow.print()
      }, 120)
    } catch (error) {
      console.error('Failed to prepare printable document:', error)
      statusEl.textContent = 'Unable to prepare document for printing.'
      printFrame.remove()
    } finally {
      setIsPrinting(false)
    }
  }

  const handlePageCommentSelection = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelectingCommentPosition || renderedPageSize.width <= 0 || renderedPageSize.height <= 0) return

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const x = clamp01((event.clientX - bounds.left) / bounds.width)
    const y = clamp01((event.clientY - bounds.top) / bounds.height)

    setCommentDraftPosition({ x, y })
    setCommentDraftAreaRect(null)
    shouldAutoFocusNoteEditorRef.current = true
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(true)
  }

  const handlePlacementCursorMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if ((!isSelectingCommentPosition && !(isHighlightMode && !isHighlightDeleteMode)) || renderedPageSize.width <= 0 || renderedPageSize.height <= 0) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const nextCursor = {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
    }

    if (isSelectingCommentPosition) {
      setNotePlacementCursor(nextCursor)
    }

    if (isHighlightMode && !isHighlightDeleteMode) {
      setHighlightPlacementCursor(nextCursor)
    }
  }

  const handlePlacementCursorLeave = () => {
    if (isSelectingCommentPosition && !notePlacementStartRef.current) {
      setNotePlacementCursor(null)
    }

    if (isHighlightMode && !isHighlightDeleteMode && !highlightDragStartRef.current) {
      setHighlightPlacementCursor(null)
    }
  }

  const updateDraftNoteRect = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = notePlacementStartRef.current

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const currentX = clamp01((event.clientX - bounds.left) / bounds.width)
    const currentY = clamp01((event.clientY - bounds.top) / bounds.height)

    setNotePlacementCursor({ x: currentX, y: currentY })

    if (!start) return

    setCommentDraftAreaRect({
      x: Math.min(start.x, currentX),
      y: Math.min(start.y, currentY),
      width: Math.abs(currentX - start.x),
      height: Math.abs(currentY - start.y),
    })
  }

  const handleNotePlacementPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isSelectingCommentPosition) return
    if (event.button !== 0) return

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    event.preventDefault()
    event.stopPropagation()

    const start = {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
    }

    notePlacementStartRef.current = start
    setNotePlacementCursor(start)
    setCommentDraftPosition(start)
    setCommentDraftAreaRect({
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleNotePlacementPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!notePlacementStartRef.current) return
    updateDraftNoteRect(event)
  }

  const handleNotePlacementPointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = notePlacementStartRef.current
    if (!start) return

    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    updateDraftNoteRect(event)

    const nextRect = commentDraftAreaRect ?? {
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
    }

    notePlacementStartRef.current = null
    setNotePlacementCursor(null)

    if (nextRect.width >= 0.01 && nextRect.height >= 0.01) {
      setCommentDraftPosition({ x: nextRect.x, y: nextRect.y })
      setCommentDraftAreaRect(nextRect)
    } else {
      setCommentDraftPosition(start)
      setCommentDraftAreaRect(null)
    }

    shouldAutoFocusNoteEditorRef.current = true
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(true)
  }

  const updateDraftHighlightRect = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = highlightDragStartRef.current

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    const currentX = clamp01((event.clientX - bounds.left) / bounds.width)
    const currentY = clamp01((event.clientY - bounds.top) / bounds.height)

    setHighlightPlacementCursor({ x: currentX, y: currentY })

    if (!start) return

    setDraftHighlightRect({
      x: Math.min(start.x, currentX),
      y: Math.min(start.y, currentY),
      width: Math.abs(currentX - start.x),
      height: Math.abs(currentY - start.y),
    })
  }

  const handleHighlightPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isHighlightMode || isHighlightDeleteMode || !canUsePreciseViewer) return
    if (event.button !== 0) return

    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return

    event.preventDefault()
    event.stopPropagation()

    const start = {
      x: clamp01((event.clientX - bounds.left) / bounds.width),
      y: clamp01((event.clientY - bounds.top) / bounds.height),
    }

    highlightDragStartRef.current = start
    setHighlightPlacementCursor(start)
    setDraftHighlightRect({
      x: start.x,
      y: start.y,
      width: 0,
      height: 0,
    })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleHighlightPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!highlightDragStartRef.current) return
    updateDraftHighlightRect(event)
  }

  const handleHighlightPointerEnd = async (event: React.PointerEvent<HTMLDivElement>) => {
    const start = highlightDragStartRef.current
    if (!start) return

    event.preventDefault()
    event.stopPropagation()

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    updateDraftHighlightRect(event)

    const rect = draftHighlightRect
      ?? {
        x: start.x,
        y: start.y,
        width: 0,
        height: 0,
      }

    highlightDragStartRef.current = null
    setHighlightPlacementCursor(null)
    setDraftHighlightRect(null)

    if (!id || !isDesktopApp) return
    if (rect.width < 0.01 || rect.height < 0.01) return

    await repo.createAnnotation({
      documentId: id,
      pageNumber: page,
      kind: 'highlight',
      content: JSON.stringify({
        rect,
        color: selectedHighlightColor.highlight,
      }),
    })
    await refreshData()
    setIsHighlightDeleteMode(false)
    setHighlightPlacementCursor(null)
  }

  const handleDeleteAreaHighlight = async (highlightId: string) => {
    if (!isDesktopApp) return
    await repo.deleteAnnotation(highlightId)
    await refreshData()
  }

  const handleStartNewComment = () => {
    deactivateTextSelectionMode()
    setIsHighlightMode(false)
    setIsHighlightDeleteMode(false)
    setDraftHighlightRect(null)
    highlightDragStartRef.current = null
    setIsNoteDeleteMode(false)
    setSelectedCommentId(null)
    setCommentDraftContent('')
    setCommentDraftPosition(null)
    setCommentDraftAreaRect(null)
    setIsNoteEditorOpen(false)
    setIsSelectingCommentPosition(true)
    setNotePlacementCursor({ x: 0.5, y: 0.12 })
  }

  const exitHighlightMode = () => {
    setIsHighlightMode(false)
    setIsHighlightDeleteMode(false)
    setDraftHighlightRect(null)
    setHighlightPlacementCursor(null)
    highlightDragStartRef.current = null
  }

  const activateHighlightPlacementMode = (colorId = selectedHighlightColor.id) => {
    deactivateTextSelectionMode()
    exitNoteMode()
    setSelectedHighlightColorId(colorId)
    setIsHighlightDeleteMode(false)
    setIsHighlightMode(true)
    setDraftHighlightRect(null)
    setHighlightPlacementCursor(null)
    highlightDragStartRef.current = null
  }

  const exitNoteMode = () => {
    setIsSelectingCommentPosition(false)
    setIsNoteDeleteMode(false)
    setIsNoteEditorOpen(false)
    setNotePlacementCursor(null)
    notePlacementStartRef.current = null
    setCommentDraftAreaRect(null)
  }

  const cancelDraftNote = () => {
    if (selectedCommentId) return
    setIsSelectingCommentPosition(false)
    setIsNoteDeleteMode(false)
    setIsNoteEditorOpen(false)
    setNotePlacementCursor(null)
    notePlacementStartRef.current = null
    setCommentDraftContent('')
    setCommentDraftPosition(null)
    setCommentDraftAreaRect(null)
  }

  const activateNotePlacementMode = (colorId = selectedNoteColor.id) => {
    deactivateTextSelectionMode()
    exitHighlightMode()
    setSelectedNoteColorId(colorId)
    setIsNoteDeleteMode(false)
    handleStartNewComment()
  }

  useEffect(() => {
    const hasDraftNoteFlow =
      !selectedCommentId
      && (
        isSelectingCommentPosition
        || isNoteEditorOpen
        || Boolean(commentDraftPosition)
        || Boolean(commentDraftAreaRect)
      )

    if (!hasDraftNoteFlow) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      cancelDraftNote()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [commentDraftAreaRect, commentDraftPosition, isNoteEditorOpen, isSelectingCommentPosition, selectedCommentId])

  const handleSelectComment = (commentId: string, options?: { scrollIntoView?: boolean }) => {
    if (isNoteDeleteMode) {
      void handleDeleteCommentById(commentId)
      return
    }
    if (options?.scrollIntoView) {
      shouldAutoScrollCommentRef.current = true
    }
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(false)
    setSelectedCommentId(commentId)
  }

  const selectedCommentIndex = useMemo(
    () => documentComments.findIndex((comment) => comment.id === selectedCommentId),
    [documentComments, selectedCommentId],
  )

  const handleStepComment = (direction: 'prev' | 'next') => {
    if (documentComments.length === 0) return

    const currentIndex = selectedCommentIndex >= 0
      ? selectedCommentIndex
      : direction === 'next'
        ? -1
        : 0

    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % documentComments.length
        : (currentIndex - 1 + documentComments.length) % documentComments.length

    const nextComment = documentComments[nextIndex]
    if (!nextComment) return
    shouldAutoScrollCommentRef.current = true
    if (typeof nextComment.pageNumber === 'number' && nextComment.pageNumber > 0) {
      setPage(nextComment.pageNumber)
    }
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(false)
    setSelectedCommentId(nextComment.id)
  }

  const handleOpenCommentEditor = () => {
    if (!selectedComment && !commentDraftPosition) return
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(true)
  }

  const handleCancelCommentEditor = () => {
    if (selectedComment) {
      setCommentDraftContent(selectedComment.content)
      setCommentDraftPosition(
        typeof selectedComment.positionX === 'number' && typeof selectedComment.positionY === 'number'
          ? { x: selectedComment.positionX, y: selectedComment.positionY }
          : null,
      )
      setCommentDraftAreaRect(selectedComment.areaRect ?? null)
    } else {
      setCommentDraftContent('')
      setCommentDraftPosition(null)
      setCommentDraftAreaRect(null)
    }

    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(false)
    setNotePlacementCursor(null)
  }

  const handleSaveComment = async () => {
    if (!id || !isDesktopApp || !commentDraftContent.trim() || !commentDraftPosition) return

    setIsSavingComment(true)
    try {
      if (selectedComment) {
        await repo.updateNote(selectedComment.id, {
          pageNumber: page,
          title: selectedComment.title || buildDocumentCommentTitle(selectedComment.commentNumber ?? nextCommentNumber),
          content: commentDraftContent.trim(),
          locationHint: commentDraftAreaRect
            ? serializeAreaNoteAnchor(commentDraftAreaRect, selectedComment.color ?? selectedNoteColor.note)
            : serializePointNoteAnchor(selectedComment.color ?? selectedNoteColor.note),
          positionX: commentDraftPosition.x,
          positionY: commentDraftPosition.y,
        })
      } else {
        const created = await repo.createNote({
          documentId: id,
          pageNumber: page,
          title: buildDocumentCommentTitle(nextCommentNumber),
          content: commentDraftContent.trim(),
          locationHint: commentDraftAreaRect
            ? serializeAreaNoteAnchor(commentDraftAreaRect, selectedNoteColor.note)
            : serializePointNoteAnchor(selectedNoteColor.note),
          positionX: commentDraftPosition.x,
          positionY: commentDraftPosition.y,
        })
        setSelectedCommentId(created.id)
      }

      await loadNotes()
      setIsNoteEditorOpen(false)
    } finally {
      setIsSavingComment(false)
      setIsSelectingCommentPosition(false)
      notePlacementStartRef.current = null
    }
  }

  const handleDeleteComment = async () => {
    if (!selectedComment || !isDesktopApp) return

    await repo.deleteNote(selectedComment.id)
    await loadNotes()
    setIsDeleteCommentDialogOpen(false)
    setSelectedCommentId(null)
    setCommentDraftContent('')
    setCommentDraftPosition(null)
    setCommentDraftAreaRect(null)
    setIsSelectingCommentPosition(false)
    setIsNoteEditorOpen(false)
  }

  const handleDeleteCommentById = async (commentId: string) => {
    if (!isDesktopApp) return

    await repo.deleteNote(commentId)
    await loadNotes()

    if (selectedCommentId === commentId) {
      setIsDeleteCommentDialogOpen(false)
      setSelectedCommentId(null)
      setCommentDraftContent('')
      setCommentDraftPosition(null)
      setCommentDraftAreaRect(null)
      setIsSelectingCommentPosition(false)
      setIsNoteEditorOpen(false)
    }
  }

  if (!document) {
    return <div className="p-6">Document not found.</div>
  }

  const fallbackBackHref = returnTo === 'search' ? '/search' : '/libraries'
  const backLabel = isDetachedReaderWindow ? 'Close window' : returnTo === 'search' ? 'Back to Search' : 'Back'

  return (
    <>
      <ResizablePanelGroup direction="horizontal" className="h-full">
      <ResizablePanel defaultSize={74} minSize={45}>
        <div className="flex h-full flex-1 flex-col">
        <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b px-2 py-2">
          <ReaderNavigationToolbar
            backLabel={backLabel}
            onBack={() => {
              if (isDetachedReaderWindow) {
                if (isTauri()) {
                  void getCurrentWindow().close()
                  return
                }
                window.close()
                return
              }

              if (typeof window !== 'undefined' && window.history.length > 1) {
                router.back()
                return
              }
              router.push(fallbackBackHref)
            }}
            page={page}
            onPageChange={setPage}
            totalPages={pdfDocument?.numPages ?? document.pageCount ?? '-'}
            onPreviousPage={() => setPage((current) => Math.max(1, current - 1))}
            onNextPage={() => setPage((current) => Math.min(pdfDocument?.numPages ?? current + 1, current + 1))}
            displayedZoom={displayedZoom}
            onResetZoom={() => {
              void fitCurrentPageToViewport()
            }}
            onZoomOut={() => {
              setZoom((current) => {
                const nextZoom = Math.max(READER_MIN_INTERNAL_ZOOM, current - READER_BUTTON_ZOOM_STEP)
                void captureViewportCenterZoomAnchor(nextZoom)
                return nextZoom
              })
            }}
            onZoomIn={() => {
              setZoom((current) => {
                const nextZoom = Math.min(READER_MAX_INTERNAL_ZOOM, current + READER_BUTTON_ZOOM_STEP)
                void captureViewportCenterZoomAnchor(nextZoom)
                return nextZoom
              })
            }}
          />
          <ReaderToolbarActions
            canUsePreciseViewer={canUsePreciseViewer}
            viewerMode={viewerMode}
            isHighlightPickerOpen={isHighlightPickerOpen}
            onHighlightPickerOpenChange={setIsHighlightPickerOpen}
            isHighlightMode={isHighlightMode}
            isHighlightDeleteMode={isHighlightDeleteMode}
            selectedHighlightColorId={selectedHighlightColorId}
            selectedHighlightColor={selectedHighlightColor}
            activateHighlightPlacementMode={activateHighlightPlacementMode}
            deactivateTextSelectionMode={deactivateTextSelectionMode}
            exitNoteMode={exitNoteMode}
            setIsHighlightMode={setIsHighlightMode}
            setIsHighlightDeleteMode={setIsHighlightDeleteMode}
            exitHighlightMode={exitHighlightMode}
            isNotePickerOpen={isNotePickerOpen}
            onNotePickerOpenChange={setIsNotePickerOpen}
            isSelectingCommentPosition={isSelectingCommentPosition}
            isNoteDeleteMode={isNoteDeleteMode}
            isNoteEditorOpen={isNoteEditorOpen}
            selectedNoteColorId={selectedNoteColorId}
            selectedNoteColor={selectedNoteColor}
            activateNotePlacementMode={activateNotePlacementMode}
            setSelectedCommentId={setSelectedCommentId}
            setCommentDraftPosition={setCommentDraftPosition}
            setIsNoteDeleteMode={setIsNoteDeleteMode}
            handleCancelCommentEditor={handleCancelCommentEditor}
            isTextSelectionLayerVisible={isTextSelectionLayerVisible}
            setIsTextSelectionMode={setIsTextSelectionMode}
            activeFilePath={activeFilePath}
            isPrintOptionsOpen={isPrintOptionsOpen}
            onPrintOptionsOpenChange={setIsPrintOptionsOpen}
            isDesktopApp={isDesktopApp}
            isPrinting={isPrinting}
            onPrintDocument={(mode) => void handlePrintDocument(mode)}
            onDetachReaderWindow={() => void detachReaderWindow()}
            onOpenDetails={() => router.push(`/documents?id=${document.id}`)}
            onRunOcr={() => void runOcrForDocument()}
            isRunningOcr={isRunningOcr}
            ocrStatus={document.ocrStatus}
            hasNativeTextLayer={hasNativeTextLayer}
            hasOcrText={document.hasOcrText}
          />
        </div>
        <div ref={readerViewportRef} className="flex-1 overflow-auto bg-muted/30 p-4">
          {searchQuery.trim() && currentPageOccurrences.length > 0 && !hasExactHighlightOverlay && viewerMode === 'pdfjs' && (
                <div className="mx-auto mb-3 max-w-5xl rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                 Showing page-level matches for this page.
                </div>
              )}
            {canUsePreciseViewer ? (
              <div className="flex min-h-full items-start justify-center">
                <div className="relative flex w-full flex-col items-center gap-6 py-2">
                  {allPageNumbers.map((pageNumber) => {
                    const pageSize = renderedPageSizes[pageNumber] ?? fallbackRenderedPageSize
                    const pageRenderedZoom = renderedZoomByPageRef.current[pageNumber] ?? renderZoom
                    const pagePreviewScale = pageRenderedZoom > 0 ? zoom / pageRenderedZoom : 1
                    const isActivePage = pageNumber === page
                    const isVisiblePage = visiblePageNumbers.includes(pageNumber)
                    const pageOccurrences = occurrencesByPage.get(pageNumber) ?? []
                    const pageHighlights = pageOccurrences.filter((occurrence) => occurrence.rects?.length)
                    const pageComments = commentsByPage.get(pageNumber) ?? []
                    const pagePositionedComments = pageComments.filter(
                      (comment) => typeof comment.positionX === 'number' && typeof comment.positionY === 'number',
                    )
                    const pageNoteAreaComments = pagePositionedComments.filter((comment) => comment.areaRect)
                    const pageNotePointComments = pagePositionedComments.filter((comment) => !comment.areaRect)
                    const pageAreaHighlights = areaHighlightsByPage.get(pageNumber) ?? []

                    return (
                      <div
                        key={pageNumber}
                        ref={(element) => {
                          pageContainerRefs.current[pageNumber] = element
                        }}
                        className={cn(
                          'relative overflow-hidden rounded border bg-white shadow-sm transition-shadow',
                          isActivePage && (isSelectingCommentPosition || isNoteDeleteMode || isHighlightMode) && 'ring-2 ring-primary/25',
                          isActivePage && (isSelectingCommentPosition || (isHighlightMode && !isHighlightDeleteMode)) && 'cursor-crosshair',
                          isActivePage && (isHighlightDeleteMode || isNoteDeleteMode) && 'cursor-not-allowed',
                          !isActivePage && 'opacity-95',
                        )}
                        onClick={isActivePage && isSelectingCommentPosition ? handlePageCommentSelection : undefined}
                        onContextMenu={(event) => {
                          if (!isActivePage) return
                          if (!isHighlightMode && !isHighlightDeleteMode && !isSelectingCommentPosition && !isNoteDeleteMode) return
                          event.preventDefault()
                          event.stopPropagation()
                          exitHighlightMode()
                          exitNoteMode()
                        }}
                        onClickCapture={() => {
                          if (!isActivePage) return
                          if (!isHighlightMode && !isSelectingCommentPosition) {
                            handleTransientTextSelectionDismiss()
                          }
                        }}
                        onPointerMoveCapture={isActivePage ? handlePlacementCursorMove : undefined}
                        onPointerLeave={isActivePage ? handlePlacementCursorLeave : undefined}
                        onPointerDownCapture={isActivePage ? handleTextSelectionGestureStart : undefined}
                        onPointerUpCapture={isActivePage ? handleTextSelectionGestureEnd : undefined}
                        onPointerCancel={isActivePage ? handleTextSelectionGestureEnd : undefined}
                        style={{
                          width: pageSize.width > 0 ? `${pageSize.width * pagePreviewScale}px` : undefined,
                          height: pageSize.height > 0 ? `${pageSize.height * pagePreviewScale}px` : undefined,
                        }}
                      >
                        <div
                          ref={(element) => {
                            pageSurfaceRefs.current[pageNumber] = element
                          }}
                          className="relative origin-top-left"
                          style={{
                            width: pageSize.width > 0 ? `${pageSize.width}px` : undefined,
                            height: pageSize.height > 0 ? `${pageSize.height}px` : undefined,
                            transform: `scale(${pagePreviewScale})`,
                          }}
                        >
                          {isVisiblePage ? (
                            <canvas
                              ref={(element) => {
                                pageCanvasRefs.current[pageNumber] = element
                              }}
                              className="relative z-0 block bg-white"
                            />
                          ) : (
                            <div
                              className="flex items-center justify-center border border-dashed border-border/60 bg-gradient-to-br from-muted/20 via-background to-muted/30 text-sm text-muted-foreground"
                              style={{
                                width: pageSize.width > 0 ? `${pageSize.width}px` : undefined,
                                height: pageSize.height > 0 ? `${pageSize.height}px` : undefined,
                              }}
                            >
                              <div className="rounded-full border border-border/70 bg-background/90 px-4 py-1.5 shadow-sm">
                                Page {pageNumber}
                              </div>
                            </div>
                          )}
                          {isVisiblePage && pageSize.width > 0 && (
                            <ReaderPageOverlays
                              isActivePage={isActivePage}
                              pageSize={pageSize}
                              zoom={zoom}
                              renderZoom={renderZoom}
                              isOverlayZoomTransitioning={isOverlayZoomTransitioning}
                              isTextSelectionLayerVisible={isTextSelectionLayerVisible}
                              pageWords={pageWords}
                              pageNotePointComments={pageNotePointComments}
                              pageNoteAreaComments={pageNoteAreaComments}
                              selectedCommentId={selectedCommentId}
                              hoveredCommentId={hoveredCommentId}
                              defaultNoteColor={getReaderColorOption('yellow').note}
                              selectedNoteColor={selectedNoteColor}
                              nextCommentNumber={nextCommentNumber}
                              draftCommentNumber={selectedComment?.commentNumber ?? nextCommentNumber}
                              isNoteDeleteMode={isNoteDeleteMode}
                              isSelectingCommentPosition={isSelectingCommentPosition}
                              draftNotePreview={draftNotePreview}
                              commentDraftAreaRect={commentDraftAreaRect}
                              notePlacementCursor={notePlacementCursor}
                              isNotePlacementDragging={Boolean(notePlacementStartRef.current)}
                              onSelectComment={(commentId) => handleSelectComment(commentId, { scrollIntoView: true })}
                              onHoveredCommentChange={setHoveredCommentId}
                              onDisableNoteDeleteMode={() => setIsNoteDeleteMode(false)}
                              onNotePlacementPointerDown={isActivePage ? handleNotePlacementPointerDown : undefined}
                              onNotePlacementPointerMove={isActivePage ? handleNotePlacementPointerMove : undefined}
                              onNotePlacementPointerUp={isActivePage ? handleNotePlacementPointerEnd : undefined}
                              onCancelNotePlacementPointer={() => {
                                notePlacementStartRef.current = null
                                setNotePlacementCursor(null)
                                setCommentDraftAreaRect(null)
                              }}
                              pageHighlights={pageHighlights}
                              activeOccurrenceGroupIndexes={activeOccurrenceGroupIndexes}
                              activeOccurrenceIndex={activeOccurrenceIndex}
                              activeOccurrenceHighlightRef={(element) => {
                                activeOccurrenceHighlightRef.current = element
                              }}
                              pageAreaHighlights={pageAreaHighlights}
                              isHighlightMode={isHighlightMode}
                              isHighlightDeleteMode={isHighlightDeleteMode}
                              highlightPlacementCursor={highlightPlacementCursor}
                              isHighlightPlacementDragging={Boolean(highlightDragStartRef.current)}
                              draftHighlightRect={draftHighlightRect}
                              selectedHighlightColor={selectedHighlightColor}
                              onHighlightPointerDown={isActivePage ? handleHighlightPointerDown : undefined}
                              onHighlightPointerMove={isActivePage ? handleHighlightPointerMove : undefined}
                              onHighlightPointerUp={isActivePage ? (event) => {
                                void handleHighlightPointerEnd(event)
                              } : undefined}
                              onCancelHighlightPointer={() => {
                                highlightDragStartRef.current = null
                                setHighlightPlacementCursor(null)
                                setDraftHighlightRect(null)
                              }}
                              onDeleteAreaHighlight={(highlightId) => {
                                void handleDeleteAreaHighlight(highlightId)
                              }}
                              onDisableHighlightDeleteMode={() => setIsHighlightDeleteMode(false)}
                            />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : showViewerLoading ? (
              <div className="flex min-h-[calc(100vh-13rem)] items-center justify-center">
                <div className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 text-sm shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t('readerView.openingPdf')}
                </div>
              </div>
            ) : embeddedPdfUrl ? (
              <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col gap-3">
                {viewerError ? (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    {viewerError}
                  </div>
                ) : null}
                <div className="overflow-hidden rounded border bg-white shadow-sm">
                  <iframe
                    key={`${embeddedPdfUrl}-${page}-${zoom}`}
                    src={`${embeddedPdfUrl}#page=${page}&zoom=${zoom}`}
                    aria-label={document?.title ?? 'PDF preview'}
                    className="h-[calc(100vh-13rem)] w-full bg-white"
                  />
                </div>
                <div className="px-1 text-xs text-muted-foreground">
                  Highlights, notes, and precise text overlays are disabled in this fallback preview. Use the external-open button if this embedded preview still appears blank.
                </div>
              </div>
            ) : (
              <div className="space-y-2 p-6">
               <p>{hasViewerTimedOut ? t('readerView.pdfUnavailable') : viewerError ?? t('readerView.pdfUnavailable')}</p>
                {isDesktopApp && document.id && (
                  <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => void importPdfForDocument()}>
                    {t('readerView.importPdf')}
                  </Button>
                  {!hasNativeTextLayer ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void runOcrForDocument()}
                      disabled={!activeFilePath || isRunningOcr || document.ocrStatus === 'processing'}
                    >
                      {isRunningOcr || document.ocrStatus === 'processing' ? t('readerView.runningOcr') : t('readerView.runOcr')}
                    </Button>
                  ) : null}
                </div>
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
          <ReaderSearchPanel
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            groupedSearchOccurrences={groupedSearchOccurrences}
            searchOccurrencesLength={searchOccurrences.length}
            activeOccurrenceIndex={activeOccurrenceIndex}
            activeOccurrenceGroupIndex={activeOccurrenceGroupIndex}
            onRotateOccurrence={rotateOccurrence}
            onSelectOccurrence={(occurrenceIndex) => {
              selectOccurrence(occurrenceIndex, { jumpToPage: true })
            }}
            setOccurrenceRef={(groupIndex, element) => {
              occurrenceRefs.current[groupIndex] = element
            }}
            renderHighlightedSnippet={(snippet) => highlightText(snippet, searchQuery)}
          />

          <ReaderNotesPanel
            canUsePreciseViewer={canUsePreciseViewer}
            isSelectingCommentPosition={isSelectingCommentPosition}
            isNoteEditorOpen={isNoteEditorOpen}
            isDesktopApp={isDesktopApp}
            isSavingComment={isSavingComment}
            commentDraftPosition={commentDraftPosition}
            commentDraftContent={commentDraftContent}
            onCommentDraftContentChange={setCommentDraftContent}
            noteEditorTextareaRef={noteEditorTextareaRef}
            currentPageComments={currentPageComments}
            documentCommentsLength={documentComments.length}
            selectedComment={selectedComment}
            selectedCommentId={selectedCommentId}
            hoveredCommentId={hoveredCommentId}
            nextCommentNumber={nextCommentNumber}
            onStartNewComment={handleStartNewComment}
            onCancelCommentEditor={handleCancelCommentEditor}
            onStartChoosingPosition={() => setIsSelectingCommentPosition(true)}
            onSaveComment={() => void handleSaveComment()}
            onStepComment={handleStepComment}
            onSelectComment={(commentId) => handleSelectComment(commentId)}
            onOpenCommentEditor={handleOpenCommentEditor}
            onRequestDeleteComment={() => setIsDeleteCommentDialogOpen(true)}
            setCommentCardRef={(commentId, element) => {
              commentCardRefs.current[commentId] = element
            }}
            onHoveredCommentChange={setHoveredCommentId}
          />
        </div>
        </div>
      </ResizablePanel>
      </ResizablePanelGroup>
      <AlertDialog open={isDeleteCommentDialogOpen} onOpenChange={setIsDeleteCommentDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('readerView.deleteNoteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedComment
                ? t('readerView.deleteNoteDescription', { label: buildDocumentCommentTitle(selectedComment.commentNumber ?? nextCommentNumber) })
                : t('readerView.deleteNoteDescriptionFallback')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('readerView.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void handleDeleteComment()}
            >
              {t('readerView.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function ReaderViewPage() {
  const params = useSearchParams()
  if (params.get('tour') === '1') {
    return <ReaderViewTourDemo />
  }

  return <RealReaderViewPage />
}


