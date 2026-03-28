export type NoteAreaRect = {
  x: number
  y: number
  width: number
  height: number
}

type SerializedAreaNoteAnchor = {
  kind: 'area_highlight'
  rect: NoteAreaRect
}

export function parseAreaNoteAnchor(locationHint?: string | null): NoteAreaRect | null {
  if (!locationHint) return null

  try {
    const parsed = JSON.parse(locationHint) as SerializedAreaNoteAnchor
    if (
      parsed.kind !== 'area_highlight'
      || typeof parsed.rect?.x !== 'number'
      || typeof parsed.rect?.y !== 'number'
      || typeof parsed.rect?.width !== 'number'
      || typeof parsed.rect?.height !== 'number'
    ) {
      return null
    }

    return parsed.rect
  } catch {
    return null
  }
}

export function serializeAreaNoteAnchor(rect: NoteAreaRect) {
  return JSON.stringify({
    kind: 'area_highlight',
    rect,
  } satisfies SerializedAreaNoteAnchor)
}

export function getNoteLocationLabel(locationHint?: string | null) {
  if (!locationHint) return ''
  if (parseAreaNoteAnchor(locationHint)) return 'Highlighted area'
  return locationHint
}
