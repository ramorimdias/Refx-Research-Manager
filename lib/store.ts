import { create } from 'zustand'
import type {
  Document,
  Library,
  Annotation,
  DocumentFilters,
  DocumentSort,
  ViewMode,
} from './types'
import {
  mockLibraries,
  mockDocuments,
  mockAnnotations,
} from './mock-data'

interface AppState {
  // Active selections
  activeLibraryId: string | null
  activeDocumentId: string | null
  
  // View state
  sidebarCollapsed: boolean
  rightPanelOpen: boolean
  viewMode: ViewMode
  
  // Document filters and sorting
  filters: DocumentFilters
  sort: DocumentSort
  
  // Command palette
  commandPaletteOpen: boolean
  
  // PDF Reader state
  currentPage: number
  zoom: number
  annotationMode: 'select' | 'highlight' | 'note' | 'bookmark' | null
  
  // Data (in real app, this would come from API)
  libraries: Library[]
  documents: Document[]
  annotations: Annotation[]
  
  // Actions
  setActiveLibrary: (id: string | null) => void
  setActiveDocument: (id: string | null) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
  setViewMode: (mode: ViewMode) => void
  setFilters: (filters: DocumentFilters) => void
  setSort: (sort: DocumentSort) => void
  toggleCommandPalette: () => void
  setCurrentPage: (page: number) => void
  setZoom: (zoom: number) => void
  setAnnotationMode: (mode: 'select' | 'highlight' | 'note' | 'bookmark' | null) => void
  addAnnotation: (annotation: Annotation) => void
  updateDocument: (id: string, updates: Partial<Document>) => void
  toggleFavorite: (documentId: string) => void
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  activeLibraryId: null,
  activeDocumentId: null,
  sidebarCollapsed: false,
  rightPanelOpen: true,
  viewMode: 'table',
  filters: {},
  sort: { field: 'addedAt', direction: 'desc' },
  commandPaletteOpen: false,
  currentPage: 1,
  zoom: 100,
  annotationMode: null,
  
  // Initial data
  libraries: mockLibraries,
  documents: mockDocuments,
  annotations: mockAnnotations,
  
  // Actions
  setActiveLibrary: (id) => set({ activeLibraryId: id }),
  setActiveDocument: (id) => set({ activeDocumentId: id }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
  setFilters: (filters) => set({ filters }),
  setSort: (sort) => set({ sort }),
  toggleCommandPalette: () => set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
  setCurrentPage: (page) => set({ currentPage: page }),
  setZoom: (zoom) => set({ zoom }),
  setAnnotationMode: (mode) => set({ annotationMode: mode }),
  
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
      documents: state.documents.map((doc) =>
        doc.id === annotation.documentId
          ? { ...doc, annotationCount: doc.annotationCount + 1 }
          : doc
      ),
    })),
  
  updateDocument: (id, updates) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === id ? { ...doc, ...updates, updatedAt: new Date() } : doc
      ),
    })),
  
  toggleFavorite: (documentId) =>
    set((state) => ({
      documents: state.documents.map((doc) =>
        doc.id === documentId ? { ...doc, favorite: !doc.favorite } : doc
      ),
    })),
}))

// Selectors
export const useActiveLibrary = () => {
  const { activeLibraryId, libraries } = useAppStore()
  return libraries.find((lib) => lib.id === activeLibraryId)
}

export const useActiveDocument = () => {
  const { activeDocumentId, documents } = useAppStore()
  return documents.find((doc) => doc.id === activeDocumentId)
}

export const useFilteredDocuments = () => {
  const { documents, filters, sort, activeLibraryId } = useAppStore()
  
  let filtered = [...documents]
  
  // Filter by library
  if (activeLibraryId) {
    filtered = filtered.filter((doc) => doc.libraryId === activeLibraryId)
  }
  
  // Apply search filter
  if (filters.search) {
    const search = filters.search.toLowerCase()
    filtered = filtered.filter(
      (doc) =>
        doc.title.toLowerCase().includes(search) ||
        doc.authors.some((a) => a.toLowerCase().includes(search)) ||
        doc.abstract?.toLowerCase().includes(search)
    )
  }
  
  // Apply tag filter
  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((doc) =>
      filters.tags!.some((tag) => doc.tags.includes(tag))
    )
  }
  
  // Apply reading stage filter
  if (filters.readingStage && filters.readingStage.length > 0) {
    filtered = filtered.filter((doc) =>
      filters.readingStage!.includes(doc.readingStage)
    )
  }
  
  // Apply metadata status filter
  if (filters.metadataStatus && filters.metadataStatus.length > 0) {
    filtered = filtered.filter((doc) =>
      filters.metadataStatus!.includes(doc.metadataStatus)
    )
  }
  
  // Apply year filter
  if (filters.year) {
    if (filters.year.min) {
      filtered = filtered.filter((doc) => doc.year && doc.year >= filters.year!.min!)
    }
    if (filters.year.max) {
      filtered = filtered.filter((doc) => doc.year && doc.year <= filters.year!.max!)
    }
  }
  
  // Apply favorite filter
  if (filters.favorite) {
    filtered = filtered.filter((doc) => doc.favorite)
  }
  
  // Apply annotations filter
  if (filters.hasAnnotations) {
    filtered = filtered.filter((doc) => doc.annotationCount > 0)
  }
  
  // Sort
  filtered.sort((a, b) => {
    let comparison = 0
    switch (sort.field) {
      case 'title':
        comparison = a.title.localeCompare(b.title)
        break
      case 'authors':
        comparison = (a.authors[0] || '').localeCompare(b.authors[0] || '')
        break
      case 'year':
        comparison = (a.year || 0) - (b.year || 0)
        break
      case 'addedAt':
        comparison = a.addedAt.getTime() - b.addedAt.getTime()
        break
      case 'lastOpenedAt':
        comparison = (a.lastOpenedAt?.getTime() || 0) - (b.lastOpenedAt?.getTime() || 0)
        break
      case 'rating':
        comparison = a.rating - b.rating
        break
    }
    return sort.direction === 'asc' ? comparison : -comparison
  })
  
  return filtered
}

export const useDocumentAnnotations = (documentId: string) => {
  const { annotations } = useAppStore()
  return annotations.filter((ann) => ann.documentId === documentId)
}
