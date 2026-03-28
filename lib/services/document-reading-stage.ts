import type { ReadingStage } from '@/lib/types'

export type LegacyReadingStage = ReadingStage | 'skimmed' | 'read' | 'archived'

export function normalizeReadingStage(stage: string | null | undefined): ReadingStage {
  switch (stage) {
    case 'reading':
      return 'reading'
    case 'skimmed':
    case 'read':
    case 'archived':
    case 'finished':
      return 'finished'
    case 'unread':
    default:
      return 'unread'
  }
}
