import type { RefxReference } from '../api/refxClient'

export type BibliographyEntry = {
  number: number
  source: RefxReference
}

function formatAuthors(authors: string[]) {
  return authors.length > 0 ? authors.join(', ') : 'Unknown author'
}

export function renderBibliographyEntry(number: number, source: RefxReference) {
  const container = source.journal || source.booktitle || source.publisher || ''
  const year = source.year ? ` (${source.year}).` : '.'
  const details = [
    container,
    source.volume,
    source.issue ? `(${source.issue})` : '',
    source.pages,
  ].filter(Boolean).join(', ')
  const doi = source.doi ? ` doi:${source.doi}` : ''
  const url = !source.doi && source.url ? ` ${source.url}` : ''
  return `[${number}] ${formatAuthors(source.authors)}${year} ${source.title}.${details ? ` ${details}.` : ''}${doi}${url}`
}

export function renderBibliography(entries: BibliographyEntry[]) {
  if (entries.length === 0) {
    return 'References\n\nNo Refx citations found.'
  }

  return [
    'References',
    '',
    ...entries.map((entry) => renderBibliographyEntry(entry.number, entry.source)),
  ].join('\n')
}
