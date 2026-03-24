import { create } from 'zustand'
import { isTauri } from '@/lib/tauri/client'
import { mockAnnotations, mockDocuments, mockLibraries, mockNotes } from './mock-data'
import { bootstrapDesktop, importPdfs } from '@/lib/services/desktop-service'
import * as repo from '@/lib/repositories/local-db'



function toUiDocument(d: any) {
  const authorsParsed = (() => {
    if (Array.isArray(d.authors)) return d.authors
    if (typeof d.authors !== 'string') return []
    try { const parsed = JSON.parse(d.authors); return Array.isArray(parsed) ? parsed : [d.authors] } catch { return d.authors ? [d.authors] : [] }
  })()

  return {
    ...d,
    libraryId: d.libraryId ?? d.library_id,
    abstract: d.abstract ?? d.abstractText,
    citationKey: d.citationKey ?? d.citation_key ?? '',
    hasOcr: d.hasOcr ?? false,
    ocrStatus: d.ocrStatus ?? 'pending',
    metadataStatus: d.metadataStatus ?? 'incomplete',
    readingStage: d.readingStage ?? 'unread',
    favorite: d.favorite ?? false,
    rating: d.rating ?? 0,
    annotationCount: d.annotationCount ?? 0,
    notesCount: d.notesCount ?? 0,
    tags: d.tags ?? [],
    addedAt: d.addedAt ? new Date(d.addedAt) : new Date(d.createdAt ?? Date.now()),
    createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
    updatedAt: d.updatedAt ? new Date(d.updatedAt) : new Date(),
    lastOpenedAt: d.lastOpenedAt ? new Date(d.lastOpenedAt) : undefined,
    authors: authorsParsed,
  }
}

interface AppState {
  initialized: boolean
  isDesktopApp: boolean
  libraries: any[]
  documents: any[]
  annotations: any[]
  notes: any[]
  activeLibraryId: string | null
  viewMode: 'table' | 'grid' | 'list'
  sort: { field: 'addedAt' | 'lastOpenedAt' | 'title' | 'authors' | 'year' | 'rating'; direction: 'asc' | 'desc' }
  filters: Record<string, any>
  currentPage: number
  zoom: number
  annotationMode: 'select' | 'highlight' | 'note' | 'bookmark' | null
  rightPanelOpen: boolean
  initialize: () => Promise<void>
  setActiveLibrary: (id: string | null) => void
  setViewMode: (mode: 'table' | 'grid' | 'list') => void
  setSort: (sort: any) => void
  setFilters: (filters: Record<string, any>) => void
  setCurrentPage: (page: number) => void
  setZoom: (zoom: number) => void
  setAnnotationMode: (mode: any) => void
  toggleRightPanel: () => void
  loadLibraryDocuments: (libraryId: string) => Promise<void>
  importDocuments: () => Promise<number>
  loadNotes: () => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  initialized: false,
  isDesktopApp: false,
  libraries: [],
  documents: [],
  annotations: [],
  notes: [],
  activeLibraryId: null,
  viewMode: 'table',
  sort: { field: 'addedAt', direction: 'desc' },
  filters: {},
  currentPage: 1,
  zoom: 100,
  annotationMode: null,
  rightPanelOpen: true,

  initialize: async () => {
    if (!isTauri()) {
      set({
        initialized: true,
        isDesktopApp: false,
        libraries: mockLibraries,
        documents: mockDocuments,
        annotations: mockAnnotations,
        notes: mockNotes,
        activeLibraryId: mockLibraries[0]?.id ?? null,
      })
      return
    }

    const libraries = await bootstrapDesktop()
    const activeLibraryId = libraries[0]?.id ?? null
    const documents = activeLibraryId ? (await repo.listDocumentsByLibrary(activeLibraryId)).map(toUiDocument) : []
    const notes = await repo.listNotes()

    set({
      initialized: true,
      isDesktopApp: true,
      libraries,
      documents,
      annotations: [],
      notes,
      activeLibraryId,
    })
  },

  setActiveLibrary: (id) => set({ activeLibraryId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSort: (sort) => set({ sort }),
  setFilters: (filters) => set({ filters }),
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),
  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  loadLibraryDocuments: async (libraryId) => {
    if (!get().isDesktopApp) {
      set({ documents: mockDocuments.filter((d) => d.libraryId === libraryId) })
      return
    }
    const documents = (await repo.listDocumentsByLibrary(libraryId)).map(toUiDocument)
    set({ documents })
  },

  importDocuments: async () => {
    const { isDesktopApp, activeLibraryId } = get()
    if (!isDesktopApp || !activeLibraryId) return 0
    const imported = await importPdfs(activeLibraryId)
    const documents = (await repo.listDocumentsByLibrary(activeLibraryId)).map(toUiDocument)
    set({ documents })
    return imported.length
  },

  loadNotes: async () => {
    if (!get().isDesktopApp) {
      set({ notes: mockNotes })
      return
    }
    set({ notes: await repo.listNotes() })
  },
}))

export const useFilteredDocuments = () => {
  const { documents, filters, sort } = useAppStore()
  const search = (filters.search ?? '').toLowerCase()
  let filtered = documents.filter((d: any) => {
    if (!search) return true
    return d.title?.toLowerCase().includes(search)
  })
  filtered = filtered.sort((a: any, b: any) => {
    const A = a.title || ''
    const B = b.title || ''
    const cmp = String(A).localeCompare(String(B))
    return sort.direction === 'asc' ? cmp : -cmp
  })
  return filtered
}

export const useDocumentAnnotations = (documentId: string) => {
  const { annotations } = useAppStore()
  return annotations.filter((ann: any) => ann.documentId === documentId)
}
