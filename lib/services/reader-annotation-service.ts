import type { DbAnnotation } from '@/lib/repositories/local-db'

export const AREA_HIGHLIGHT_KIND = 'area_highlight'
export const DEFAULT_AREA_HIGHLIGHT_COLOR = '#facc15'
export const AREA_HIGHLIGHT_SCHEMA_VERSION = 1

export const READER_COLOR_OPTIONS = [
  { id: 'yellow', highlight: '#fde047', note: '#f59e0b' },
  { id: 'blue', highlight: '#7dd3fc', note: '#0ea5e9' },
  { id: 'red', highlight: '#fda4af', note: '#ef4444' },
  { id: 'green', highlight: '#86efac', note: '#22c55e' },
  { id: 'purple', highlight: '#d8b4fe', note: '#a855f7' },
] as const

export type ReaderColorId = (typeof READER_COLOR_OPTIONS)[number]['id']

export type AreaHighlightRect = {
  x: number
  y: number
  width: number
  height: number
}

export type AreaHighlightContent = {
  rect: AreaHighlightRect
  color: string
}

export type ReaderAreaHighlight = AreaHighlightContent & {
  id: string
  pageNumber: number
}

export function isReaderColorId(value: string): value is ReaderColorId {
  return READER_COLOR_OPTIONS.some((option) => option.id === value)
}

export function getReaderColorOption(id: ReaderColorId) {
  return READER_COLOR_OPTIONS.find((option) => option.id === id) ?? READER_COLOR_OPTIONS[0]
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

export function normalizeAreaHighlightRect(value: unknown): AreaHighlightRect | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<AreaHighlightRect>
  if (
    typeof candidate.x !== 'number'
    || typeof candidate.y !== 'number'
    || typeof candidate.width !== 'number'
    || typeof candidate.height !== 'number'
    || !Number.isFinite(candidate.x)
    || !Number.isFinite(candidate.y)
    || !Number.isFinite(candidate.width)
    || !Number.isFinite(candidate.height)
  ) {
    return null
  }

  const x = clamp01(candidate.x)
  const y = clamp01(candidate.y)
  const width = Math.min(clamp01(candidate.width), 1 - x)
  const height = Math.min(clamp01(candidate.height), 1 - y)

  if (width <= 0 || height <= 0) return null

  return { x, y, width, height }
}

export function isAreaHighlightKind(kind: string) {
  return kind === AREA_HIGHLIGHT_KIND || kind === 'highlight'
}

export function parseAreaHighlightContent(content: string | undefined): AreaHighlightContent | null {
  if (!content) return null

  try {
    const parsed = JSON.parse(content) as {
      schemaVersion?: unknown
      type?: unknown
      rect?: unknown
      color?: unknown
    }

    if (
      (parsed.schemaVersion !== undefined && parsed.schemaVersion !== AREA_HIGHLIGHT_SCHEMA_VERSION)
      || (parsed.type !== undefined && parsed.type !== AREA_HIGHLIGHT_KIND)
    ) {
      return null
    }

    const rect = normalizeAreaHighlightRect(parsed.rect)
    if (!rect) return null

    return {
      rect,
      color: isHexColor(parsed.color) ? parsed.color : DEFAULT_AREA_HIGHLIGHT_COLOR,
    }
  } catch {
    return null
  }
}

export function parseAreaHighlight(annotation: DbAnnotation): ReaderAreaHighlight | null {
  if (!isAreaHighlightKind(annotation.kind)) return null

  const content = parseAreaHighlightContent(annotation.content)
  if (!content) return null

  return {
    id: annotation.id,
    pageNumber: annotation.pageNumber,
    ...content,
  }
}

export function serializeAreaHighlightContent(rect: AreaHighlightRect, color: string) {
  const normalizedRect = normalizeAreaHighlightRect(rect)
  if (!normalizedRect) {
    throw new Error('Cannot save an empty area highlight.')
  }

  return JSON.stringify({
    schemaVersion: AREA_HIGHLIGHT_SCHEMA_VERSION,
    type: AREA_HIGHLIGHT_KIND,
    rect: normalizedRect,
    color: isHexColor(color) ? color : DEFAULT_AREA_HIGHLIGHT_COLOR,
  })
}

export function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return hex

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)
  if ([red, green, blue].some((value) => Number.isNaN(value))) return hex

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}
