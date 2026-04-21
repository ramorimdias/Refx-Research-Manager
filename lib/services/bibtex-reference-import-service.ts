'use client'

import type { DbCreateReferenceInput } from '@/lib/repositories/local-db'
import { normalizeWhitespace, serializeAuthors } from '@/lib/services/work-reference-service'

type BibtexEntry = {
  type: string
  citationKey?: string
  fields: Record<string, string>
  raw: string
}

export type ImportedReferenceDraft = DbCreateReferenceInput & {
  sourceProvider: 'mendeley' | 'endnote' | 'paperpile'
}

function splitBibtexEntries(input: string): string[] {
  const entries: string[] = []
  let start = -1
  let depth = 0
  let quote: '"' | null = null

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]
    const previous = input[index - 1]

    if (start < 0 && char === '@') {
      start = index
      depth = 0
      quote = null
    }

    if (start < 0) continue

    if (char === '"' && previous !== '\\') {
      quote = quote ? null : '"'
      continue
    }

    if (quote) continue

    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        entries.push(input.slice(start, index + 1))
        start = -1
      }
    }
  }

  return entries
}

function parseBibtexFields(body: string) {
  const fields: Record<string, string> = {}
  let index = 0

  while (index < body.length) {
    while (index < body.length && /[\s,]/.test(body[index] ?? '')) index += 1
    const keyMatch = body.slice(index).match(/^([A-Za-z][A-Za-z0-9_-]*)\s*=/)
    if (!keyMatch) break

    const key = keyMatch[1].toLowerCase()
    index += keyMatch[0].length
    while (index < body.length && /\s/.test(body[index] ?? '')) index += 1

    const opener = body[index]
    let value = ''

    if (opener === '{') {
      index += 1
      let depth = 1
      const valueStart = index
      while (index < body.length && depth > 0) {
        const char = body[index]
        if (char === '{') depth += 1
        else if (char === '}') depth -= 1
        index += 1
      }
      value = body.slice(valueStart, Math.max(valueStart, index - 1))
    } else if (opener === '"') {
      index += 1
      const valueStart = index
      while (index < body.length) {
        if (body[index] === '"' && body[index - 1] !== '\\') break
        index += 1
      }
      value = body.slice(valueStart, index)
      index += 1
    } else {
      const valueStart = index
      while (index < body.length && body[index] !== ',') index += 1
      value = body.slice(valueStart, index)
    }

    fields[key] = normalizeBibtexValue(value)
  }

  return fields
}

function normalizeBibtexValue(input: string) {
  return normalizeWhitespace(
    input
      .replace(/[{}]/g, '')
      .replace(/\\"/g, '"')
      .replace(/\\&/g, '&')
      .replace(/--/g, '-'),
  )
}

function parseBibtexEntry(raw: string): BibtexEntry | null {
  const match = raw.match(/^@([A-Za-z]+)\s*[{(]\s*([^,\s]+)\s*,([\s\S]*)[})]\s*$/)
  if (!match) return null

  return {
    type: match[1].toLowerCase(),
    citationKey: normalizeWhitespace(match[2]),
    fields: parseBibtexFields(match[3]),
    raw,
  }
}

function normalizeReferenceType(type: string): string {
  switch (type.toLowerCase()) {
    case 'article':
      return 'article'
    case 'book':
    case 'booklet':
      return 'book'
    case 'inproceedings':
    case 'conference':
    case 'proceedings':
      return 'inproceedings'
    case 'phdthesis':
    case 'mastersthesis':
    case 'thesis':
      return 'thesis'
    case 'techreport':
    case 'report':
      return 'report'
    case 'online':
    case 'misc':
    default:
      return type.toLowerCase() === 'online' ? 'online' : 'misc'
  }
}

function normalizeAuthors(input?: string) {
  if (!input) return undefined
  return serializeAuthors(
    input
      .split(/\s+and\s+/i)
      .map((author) => normalizeWhitespace(author.replace(/^(.+),\s*(.+)$/, '$2 $1')))
      .filter(Boolean),
  )
}

export function parseBibtexReferences(
  input: string,
  sourceProvider: ImportedReferenceDraft['sourceProvider'],
): ImportedReferenceDraft[] {
  return splitBibtexEntries(input)
    .map(parseBibtexEntry)
    .filter((entry): entry is BibtexEntry => Boolean(entry))
    .map((entry) => {
      const fields = entry.fields
      const title = fields.title || fields.booktitle || fields.journal || entry.citationKey || 'Untitled reference'
      const yearValue = Number.parseInt(fields.year ?? fields.date ?? '', 10)

      return {
        sourceProvider,
        type: normalizeReferenceType(entry.type),
        isManual: false,
        citationKey: entry.citationKey,
        title,
        authors: normalizeAuthors(fields.author ?? fields.editor),
        year: Number.isFinite(yearValue) ? yearValue : undefined,
        journal: fields.journal ?? fields.journaltitle,
        volume: fields.volume,
        issue: fields.number ?? fields.issue,
        chapter: fields.chapter,
        pages: fields.pages,
        publisher: fields.publisher ?? fields.organization ?? fields.institution,
        booktitle: fields.booktitle,
        doi: fields.doi,
        url: fields.url,
        abstract: fields.abstract ?? fields.note,
        keywords: fields.keywords,
        bibtex: entry.raw,
      }
    })
}
