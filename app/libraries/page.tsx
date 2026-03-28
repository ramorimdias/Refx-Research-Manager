'use client'

import { useEffect, useState } from 'react'
import {
  Search,
  Grid3X3,
  List,
  Table2,
  SortAsc,
  Upload,
  FolderOpen,
  Pencil,
  Plus,
  Trash2,
  Filter,
  PanelLeftClose,
  PanelLeftOpen,
  BookMarked,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { deriveMetadataStatus, serializeMetadataProvenance, serializeMetadataUserEditedFields } from '@/lib/services/document-metadata-service'
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
import { useAppStore, useFilteredDocuments } from '@/lib/store'
import { DocumentTable } from '@/components/refx/document-table'
import { FilterPanel } from '@/components/refx/filter-panel'
import { DocumentCard } from '@/components/refx/document-card'
import { useDocumentViewFlags } from '@/lib/hooks/use-document-view-flags'
import type { SortField, ViewMode } from '@/lib/types'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import * as repo from '@/lib/repositories/local-db'

type LibraryFormState = {
  name: string
  description: string
  color: string
}

type PhysicalBookFormState = {
  title: string
  authors: string
  year: string
  publisher: string
  isbn: string
  description: string
}

const LIBRARY_COLOR_OPTIONS = [
  '#3b82f6',
  '#2563eb',
  '#0f766e',
  '#10b981',
  '#65a30d',
  '#f59e0b',
  '#f97316',
  '#ef4444',
  '#db2777',
  '#7c3aed',
] as const

const DEFAULT_LIBRARY_FORM: LibraryFormState = {
  name: '',
  description: '',
  color: LIBRARY_COLOR_OPTIONS[0],
}

const DEFAULT_PHYSICAL_BOOK_FORM: PhysicalBookFormState = {
  title: '',
  authors: '',
  year: '',
  publisher: '',
  isbn: '',
  description: '',
}

const DOCUMENTS_PER_PAGE = 20
const PENDING_IMPORT_STORAGE_KEY = 'refx.pending-import-paths'

function buildPaginationItems(currentPage: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const items: Array<number | 'ellipsis'> = [1]
  const start = Math.max(2, currentPage - 1)
  const end = Math.min(totalPages - 1, currentPage + 1)

  if (start > 2) {
    items.push('ellipsis')
  }

  for (let page = start; page <= end; page += 1) {
    items.push(page)
  }

  if (end < totalPages - 1) {
    items.push('ellipsis')
  }

  items.push(totalPages)
  return items
}

export default function LibrariesPage() {
  const {
    activeLibraryId,
    currentPage,
    setActiveLibrary,
    setCurrentPage,
    viewMode,
    setViewMode,
    sort,
    setSort,
    filters,
    setFilters,
    libraries,
    importDocuments,
    isDesktopApp,
    loadLibraryDocuments,
    createLibrary,
    updateLibrary,
    deleteLibrary,
    refreshData,
  } = useAppStore()
  const documents = useFilteredDocuments()
  const [isImporting, setIsImporting] = useState(false)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isPhysicalBookDialogOpen, setIsPhysicalBookDialogOpen] = useState(false)
  const [isSavingLibrary, setIsSavingLibrary] = useState(false)
  const [libraryForm, setLibraryForm] = useState<LibraryFormState>(DEFAULT_LIBRARY_FORM)
  const [physicalBookForm, setPhysicalBookForm] = useState<PhysicalBookFormState>(DEFAULT_PHYSICAL_BOOK_FORM)
  const [deleteLibraryConfirmation, setDeleteLibraryConfirmation] = useState('')
  const [pendingImportCount, setPendingImportCount] = useState<number | null>(null)

  const activeLibrary = libraries.find((lib) => lib.id === activeLibraryId)
  const paginationSessionKey = JSON.stringify({
    activeLibraryId,
    filters,
    sort,
  })
  const totalPages = Math.max(1, Math.ceil(documents.length / DOCUMENTS_PER_PAGE))
  const paginatedDocuments = documents.slice(
    (currentPage - 1) * DOCUMENTS_PER_PAGE,
    currentPage * DOCUMENTS_PER_PAGE,
  )
  const documentFlagsById = useDocumentViewFlags({
    currentPage,
    documentIds: paginatedDocuments.map((document) => document.id),
    sessionKey: paginationSessionKey,
  })
  const activeFilterCount = [
    filters.tags?.length || 0,
    filters.readingStage?.length || 0,
    filters.metadataStatus?.length || 0,
    filters.favorite ? 1 : 0,
    filters.hasComments ? 1 : 0,
    filters.hasNotes ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0)

  useEffect(() => {
    void loadLibraryDocuments(activeLibraryId)
  }, [activeLibraryId, loadLibraryDocuments])

  useEffect(() => {
    setCurrentPage(1)
  }, [paginationSessionKey, setCurrentPage])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, setCurrentPage, totalPages])

  useEffect(() => {
    const stored = window.sessionStorage.getItem('refx-libraries-filters-collapsed')
    if (stored !== null) {
      setFiltersCollapsed(stored === 'true')
    }
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem('refx-libraries-filters-collapsed', String(filtersCollapsed))
  }, [filtersCollapsed])

  useEffect(() => {
    const consumePendingImports = () => {
      if (typeof window === 'undefined') return
      const raw = window.sessionStorage.getItem(PENDING_IMPORT_STORAGE_KEY)
      if (!raw) return

      try {
        const parsed = JSON.parse(raw)
        const droppedPaths = Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string' && value.toLowerCase().endsWith('.pdf'))
          : []

        if (droppedPaths.length > 0) {
          window.sessionStorage.removeItem(PENDING_IMPORT_STORAGE_KEY)
          void handleImport(droppedPaths)
        }
      } catch {
        window.sessionStorage.removeItem(PENDING_IMPORT_STORAGE_KEY)
      }
    }

    consumePendingImports()
    window.addEventListener('refx-import-drop-queued', consumePendingImports)
    return () => {
      window.removeEventListener('refx-import-drop-queued', consumePendingImports)
    }
  }, [isDesktopApp, activeLibraryId, isImporting])

  const handleImport = async (paths?: string[]) => {
    if (!isDesktopApp || isImporting) return
    setIsImporting(true)
    setPendingImportCount(paths?.length ?? null)
    try {
      await importDocuments(paths)
    } finally {
      setIsImporting(false)
      setPendingImportCount(null)
    }
  }

  const resetLibraryForm = () => {
    setLibraryForm(DEFAULT_LIBRARY_FORM)
  }

  const resetPhysicalBookForm = () => {
    setPhysicalBookForm(DEFAULT_PHYSICAL_BOOK_FORM)
  }

  const openCreateDialog = () => {
    resetLibraryForm()
    setIsCreateDialogOpen(true)
  }

  const openPhysicalBookDialog = () => {
    resetPhysicalBookForm()
    setIsPhysicalBookDialogOpen(true)
  }

  const openRenameDialog = () => {
    if (!activeLibrary) return
    setLibraryForm({
      name: activeLibrary.name,
      description: activeLibrary.description,
      color: activeLibrary.color,
    })
    setIsRenameDialogOpen(true)
  }

  const handleCreateLibrary = async () => {
    const name = libraryForm.name.trim()
    if (!name) return

    setIsSavingLibrary(true)
    try {
      await createLibrary({
        name,
        description: libraryForm.description.trim(),
        color: libraryForm.color,
      })
      setIsCreateDialogOpen(false)
      resetLibraryForm()
    } finally {
      setIsSavingLibrary(false)
    }
  }

  const handleRenameLibrary = async () => {
    if (!activeLibrary) return
    const name = libraryForm.name.trim()
    if (!name) return

    setIsSavingLibrary(true)
    try {
      await updateLibrary(activeLibrary.id, {
        name,
        description: libraryForm.description.trim(),
        color: libraryForm.color,
      })
      setIsRenameDialogOpen(false)
      resetLibraryForm()
    } finally {
      setIsSavingLibrary(false)
    }
  }

  const handleDeleteLibrary = async () => {
    if (!activeLibrary) return

    setIsSavingLibrary(true)
    try {
      await deleteLibrary(activeLibrary.id)
      setDeleteLibraryConfirmation('')
      setIsRenameDialogOpen(false)
      setIsDeleteDialogOpen(false)
    } finally {
      setIsSavingLibrary(false)
    }
  }

  const handleCreatePhysicalBook = async () => {
    const title = physicalBookForm.title.trim()
    const libraryId = activeLibraryId ?? libraries[0]?.id
    if (!title || !libraryId) return

    setIsSavingLibrary(true)
    try {
      const authors = physicalBookForm.authors
        .split(',')
        .map((author) => author.trim())
        .filter(Boolean)
      const year = physicalBookForm.year ? Number(physicalBookForm.year) : undefined
      const publisher = physicalBookForm.publisher.trim() || undefined
      const isbn = physicalBookForm.isbn.trim() || undefined
      const abstractText = physicalBookForm.description.trim() || undefined
      const extractedAt = new Date()

      await repo.createDocument({
        libraryId,
        documentType: 'physical_book',
        title,
        authors: JSON.stringify(authors),
        year,
        publisher,
        isbn,
        abstractText,
        metadataStatus: deriveMetadataStatus({
          title,
          authors,
          year,
        }),
        metadataProvenance: serializeMetadataProvenance({
          title: { source: 'user', extractedAt, confidence: 1, detail: 'Created manually as a local physical book record.' },
          ...(authors.length > 0 ? { authors: { source: 'user', extractedAt, confidence: 1, detail: 'Created manually as a local physical book record.' } } : {}),
          ...(year ? { year: { source: 'user', extractedAt, confidence: 1, detail: 'Created manually as a local physical book record.' } } : {}),
        }),
        metadataUserEditedFields: serializeMetadataUserEditedFields({
          title: true,
          authors: authors.length > 0 || physicalBookForm.authors.trim().length > 0,
          year: Boolean(year),
          publisher: Boolean(publisher),
          isbn: Boolean(isbn),
          abstract: Boolean(abstractText),
        }),
        textExtractionStatus: 'skipped',
        ocrStatus: 'not_needed',
        indexingStatus: 'skipped',
        tagSuggestionStatus: 'pending',
        classificationStatus: 'pending',
      })
      await refreshData()
      setIsPhysicalBookDialogOpen(false)
      resetPhysicalBookForm()
    } finally {
      setIsSavingLibrary(false)
    }
  }

  return (
    <>
      <div className="flex h-full">
        {!filtersCollapsed && <FilterPanel />}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-4 border-b border-border/80 bg-background/92 px-5 py-4 backdrop-blur">
            <div className="flex items-center gap-4 flex-1">
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setFiltersCollapsed((current) => !current)}>
                {filtersCollapsed ? <PanelLeftOpen className="mr-2 h-4 w-4" /> : <PanelLeftClose className="mr-2 h-4 w-4" />}
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>

              <Select
                value={activeLibraryId || 'all'}
                onValueChange={(val) => setActiveLibrary(val === 'all' ? null : val)}
              >
                <SelectTrigger className="w-60">
                  <SelectValue placeholder="All Libraries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Libraries</SelectItem>
                  {libraries.map((lib) => (
                    <SelectItem key={lib.id} value={lib.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: lib.color }}
                        />
                        {lib.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search"
                  className="pl-9"
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-full" onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Library
              </Button>
              <Button size="sm" className="rounded-full" onClick={() => void handleImport()} disabled={!isDesktopApp || isImporting}>
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? 'Importing...' : 'Import'}
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={openPhysicalBookDialog}>
                <BookMarked className="mr-2 h-4 w-4" />
                Book
              </Button>

              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                <TabsList>
                  <TabsTrigger value="table">
                    <Table2 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="grid">
                    <Grid3X3 className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="list">
                    <List className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {filtersCollapsed && activeFilterCount > 0 && (
            <div className="border-b border-border/70 bg-muted/30 px-5 py-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Filter className="h-4 w-4" />
                <span>{activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''}</span>
              </div>
            </div>
          )}

          {activeLibrary && (
            <div className="flex items-center justify-between border-b border-border/70 bg-muted/25 px-5 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: activeLibrary.color }}
                />
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">{activeLibrary.name}</h2>
                  <p className="text-sm text-muted-foreground">{activeLibrary.description || 'Local library'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{documents.length} documents</Badge>
                <Select
                  value={sort.field}
                  onValueChange={(val) => setSort({ ...sort, field: val as SortField })}
                >
                  <SelectTrigger className="h-9 w-36">
                    <SortAsc className="mr-2 h-4 w-4" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="addedAt">Date Added</SelectItem>
                    <SelectItem value="lastOpenedAt">Last Opened</SelectItem>
                    <SelectItem value="title">Title</SelectItem>
                    <SelectItem value="authors">Authors</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                    <SelectItem value="rating">Rating</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="rounded-full" onClick={openRenameDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </div>
            </div>
          )}

          <div
            className={cn(
              'relative flex-1 overflow-auto p-5 transition-colors',
              isImporting && 'bg-muted/20',
            )}
          >
            {isImporting && (
              <div className="absolute inset-x-5 top-5 z-10 flex items-start justify-center">
                <div className="flex items-center gap-3 rounded-full border border-border/80 bg-background/96 px-4 py-2 shadow-lg">
                  <Spinner className="size-4" />
                  <div className="text-sm">
                    <span className="font-medium">Importing</span>
                    <span className="text-muted-foreground">{pendingImportCount ? ` ${pendingImportCount} file${pendingImportCount === 1 ? '' : 's'}` : ' files'}</span>
                  </div>
                </div>
              </div>
            )}
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/70">
                  <FolderOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">No documents found</h3>
                <p className="mb-6 max-w-sm text-sm text-muted-foreground">
                  {filters.search || Object.keys(filters).length > 1
                    ? 'Try adjusting your filters or search query.'
                    : 'Import PDFs or register a book to get started.'}
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => void handleImport()} disabled={!isDesktopApp || isImporting}>
                    <Upload className="mr-2 h-4 w-4" />
                    {isImporting ? 'Importing PDFs...' : 'Import PDFs'}
                  </Button>
                </div>
              </div>
            ) : viewMode === 'table' ? (
              <div className={cn('transition-opacity', isImporting && 'opacity-60')}>
                <DocumentTable documents={paginatedDocuments} ephemeralFlagsById={documentFlagsById} />
              </div>
            ) : viewMode === 'grid' ? (
              <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4', isImporting && 'opacity-60')}>
                {paginatedDocuments.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} ephemeralFlags={documentFlagsById[doc.id]} />
                ))}
              </div>
            ) : (
              <div className={cn('space-y-2', isImporting && 'opacity-60')}>
                {paginatedDocuments.map((doc) => (
                  <DocumentCard key={doc.id} document={doc} ephemeralFlags={documentFlagsById[doc.id]} variant="list" />
                ))}
              </div>
            )}

            {documents.length > 0 && totalPages > 1 && (
              <div className="mt-6 flex flex-col gap-3 border-t border-border/80 pt-4">
                <div className="text-sm text-muted-foreground">
                  Showing {(currentPage - 1) * DOCUMENTS_PER_PAGE + 1}-{Math.min(currentPage * DOCUMENTS_PER_PAGE, documents.length)} of {documents.length}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (currentPage > 1) {
                            setCurrentPage(currentPage - 1)
                          }
                        }}
                        className={cn(currentPage <= 1 && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                    {buildPaginationItems(currentPage, totalPages).map((item, index) => (
                      item === 'ellipsis' ? (
                        <PaginationItem key={`ellipsis-${index}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            href="#"
                            isActive={item === currentPage}
                            onClick={(event) => {
                              event.preventDefault()
                              setCurrentPage(item)
                            }}
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      )
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault()
                          if (currentPage < totalPages) {
                            setCurrentPage(currentPage + 1)
                          }
                        }}
                        className={cn(currentPage >= totalPages && 'pointer-events-none opacity-50')}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={isPhysicalBookDialogOpen}
        onOpenChange={(open) => {
          setIsPhysicalBookDialogOpen(open)
          if (!open) resetPhysicalBookForm()
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Register Physical Book</DialogTitle>
            <DialogDescription>Add a non-PDF book to this library so you can capture reading notes by page or chapter.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="physical-book-title">Title</Label>
              <Input
                id="physical-book-title"
                value={physicalBookForm.title}
                onChange={(event) => setPhysicalBookForm((state) => ({ ...state, title: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="physical-book-authors">Authors</Label>
              <Input
                id="physical-book-authors"
                placeholder="Comma-separated author names"
                value={physicalBookForm.authors}
                onChange={(event) => setPhysicalBookForm((state) => ({ ...state, authors: event.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="physical-book-year">Year</Label>
                <Input
                  id="physical-book-year"
                  value={physicalBookForm.year}
                  onChange={(event) => setPhysicalBookForm((state) => ({ ...state, year: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="physical-book-isbn">ISBN</Label>
                <Input
                  id="physical-book-isbn"
                  value={physicalBookForm.isbn}
                  onChange={(event) => setPhysicalBookForm((state) => ({ ...state, isbn: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="physical-book-publisher">Publisher</Label>
              <Input
                id="physical-book-publisher"
                value={physicalBookForm.publisher}
                onChange={(event) => setPhysicalBookForm((state) => ({ ...state, publisher: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="physical-book-description">Description</Label>
              <Input
                id="physical-book-description"
                value={physicalBookForm.description}
                onChange={(event) => setPhysicalBookForm((state) => ({ ...state, description: event.target.value }))}
                placeholder="Optional notes or summary"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPhysicalBookDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreatePhysicalBook()} disabled={!physicalBookForm.title.trim() || isSavingLibrary}>
              {isSavingLibrary ? 'Registering...' : 'Register Book'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          setIsCreateDialogOpen(open)
          if (!open) resetLibraryForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Library</DialogTitle>
            <DialogDescription>Add a new local library for organizing your documents.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="library-name">Name</Label>
              <Input
                id="library-name"
                value={libraryForm.name}
                onChange={(event) => setLibraryForm((state) => ({ ...state, name: event.target.value }))}
                placeholder="My Papers"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-description">Description</Label>
              <Input
                id="library-description"
                value={libraryForm.description}
                onChange={(event) => setLibraryForm((state) => ({ ...state, description: event.target.value }))}
                placeholder="Optional description"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="library-color">Color</Label>
              <div id="library-color" className="flex flex-wrap gap-2">
                {LIBRARY_COLOR_OPTIONS.map((color) => {
                  const selected = libraryForm.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Select color ${color}`}
                      aria-pressed={selected}
                      onClick={() => setLibraryForm((state) => ({ ...state, color }))}
                      className={`h-8 w-8 rounded-full border-2 transition ${selected ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreateLibrary()} disabled={!libraryForm.name.trim() || isSavingLibrary}>
              {isSavingLibrary ? 'Creating...' : 'Create Library'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRenameDialogOpen}
        onOpenChange={(open) => {
          setIsRenameDialogOpen(open)
          if (!open) {
            resetLibraryForm()
            setDeleteLibraryConfirmation('')
          }
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Library</DialogTitle>
            <DialogDescription>Update the local library name, description, or color.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-library-name">Name</Label>
              <Input
                id="rename-library-name"
                value={libraryForm.name}
                onChange={(event) => setLibraryForm((state) => ({ ...state, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-library-description">Description</Label>
              <Input
                id="rename-library-description"
                value={libraryForm.description}
                onChange={(event) => setLibraryForm((state) => ({ ...state, description: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rename-library-color">Color</Label>
              <div id="rename-library-color" className="flex flex-wrap gap-2">
                {LIBRARY_COLOR_OPTIONS.map((color) => {
                  const selected = libraryForm.color === color
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Select color ${color}`}
                      aria-pressed={selected}
                      onClick={() => setLibraryForm((state) => ({ ...state, color }))}
                      className={`h-8 w-8 rounded-full border-2 transition ${selected ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  )
                })}
              </div>
            </div>

            {activeLibrary && (
              <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-destructive">Delete Library</p>
                  {libraries.length > 1 ? (
                    <p className="text-sm text-muted-foreground">
                      Type <span className="font-medium text-foreground">{activeLibrary.name}</span> to enable deletion.
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      At least one library must remain, so this library cannot be deleted right now.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="delete-library-confirmation">Library name</Label>
                  <Input
                    id="delete-library-confirmation"
                    value={deleteLibraryConfirmation}
                    onChange={(event) => setDeleteLibraryConfirmation(event.target.value)}
                    placeholder={activeLibrary.name}
                    disabled={libraries.length <= 1}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            {activeLibrary && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto"
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={libraries.length <= 1 || deleteLibraryConfirmation.trim() !== activeLibrary.name}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Library
              </Button>
            )}
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleRenameLibrary()} disabled={!libraryForm.name.trim() || isSavingLibrary}>
              {isSavingLibrary ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete library?</AlertDialogTitle>
            <AlertDialogDescription>
              {activeLibrary
                ? `This will remove "${activeLibrary.name}" and its local documents from the app. This action cannot be undone.`
                : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSavingLibrary}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteLibrary()} disabled={isSavingLibrary}>
              {isSavingLibrary ? 'Deleting...' : 'Delete Library'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
