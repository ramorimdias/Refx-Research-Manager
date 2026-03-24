'use client'

import { appDataDir, copyFile, isTauri, join, mkdir, open } from '@/lib/tauri/client'
import * as repo from '@/lib/repositories/local-db'

function titleFromPath(filePath: string) {
  const name = filePath.split(/[\\/]/).pop() ?? 'Untitled'
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim()
}

export async function bootstrapDesktop() {
  await repo.initializeDatabase()
  const libraries = await repo.listLibraries()
  return libraries
}

export async function importPdfs(libraryId: string) {
  const selected = await open({
    multiple: true,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: 'Import PDF files',
  })

  if (!selected) return []
  const files = Array.isArray(selected) ? selected : [selected]
  const base = await appDataDir()
  const targetDir = await join(base, 'pdfs', libraryId)
  await mkdir(targetDir, { recursive: true })

  const imported = []
  for (const src of files) {
    const doc = await repo.createDocument({
      libraryId,
      title: titleFromPath(src),
      sourcePath: src,
      metadataStatus: 'incomplete',
    } as unknown as never)

    const dst = await join(targetDir, `${doc.id}.pdf`)
    await copyFile(src, dst)

    const updated = await repo.updateDocumentMetadata(doc.id, {
      importedFilePath: dst,
      metadataStatus: 'incomplete',
      readingStage: 'unread',
    })

    imported.push(updated ?? doc)
  }

  return imported
}

export function canUseDesktopFeatures() {
  return isTauri()
}
