import {
  BookMarked,
  FileChartColumn,
  FileLock2,
  FilePenLine,
  FileText,
  GraduationCap,
  Images,
  Presentation,
  Shapes,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import type { Document, WorkType } from '@/lib/types'

const workTypeIcons: Record<WorkType, LucideIcon> = {
  journal_article: FileText,
  conference_paper: ScrollText,
  presentation: Presentation,
  poster: Images,
  report: FileChartColumn,
  thesis: GraduationCap,
  book: BookMarked,
  internal_document: FileLock2,
  other: Shapes,
}

export function getWorkTypeIcon(workType: WorkType): LucideIcon {
  return workTypeIcons[workType] ?? FileText
}

export function getDocumentDisplayIcon(document: Pick<Document, 'documentType' | 'workType'>): LucideIcon {
  if (document.documentType === 'my_work') return FilePenLine
  if (document.documentType === 'physical_book') return BookMarked
  return getWorkTypeIcon(document.workType)
}

export function getWorkTypeLabel(workType: WorkType) {
  return workType.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())
}
