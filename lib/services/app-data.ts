'use client'

import { mockDocuments, mockLibraries, mockNotes } from '@/lib/mock-data'
import * as repo from '@/lib/repositories/local-db'
import { canUseDesktopFeatures } from './desktop-service'

export async function getLibraries() {
  if (!canUseDesktopFeatures()) return mockLibraries
  return repo.listLibraries()
}

export async function getLibraryDocuments(libraryId: string) {
  if (!canUseDesktopFeatures()) return mockDocuments.filter((d) => d.libraryId === libraryId)
  return repo.listDocumentsByLibrary(libraryId)
}

export async function getDocument(id: string) {
  if (!canUseDesktopFeatures()) return mockDocuments.find((d) => d.id === id) ?? null
  return repo.getDocumentById(id)
}

export async function getNotes() {
  if (!canUseDesktopFeatures()) return mockNotes
  return repo.listNotes()
}
