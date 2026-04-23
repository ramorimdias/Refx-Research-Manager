import type { RefxReference } from '../api/refxClient'

export type CitationGroup = {
  id: string
  sourceIds: string[]
  contentControlId?: string
}

export type CitationSettings = {
  style: 'numeric'
  workDocumentId?: string
  workTitle?: string
  bibliographyOrder: 'firstAppearance' | 'refxWorkOrder'
  textCitationStyle: 'number' | 'authorYearParen' | 'authorYearComma' | 'author'
  citationContainer: 'square' | 'round' | 'none'
}

export type RefxCitationState = {
  version: 1
  sources: Record<string, RefxReference>
  citationGroups: CitationGroup[]
  settings: CitationSettings
}

export const emptyCitationState = (): RefxCitationState => ({
  version: 1,
  sources: {},
  citationGroups: [],
  settings: {
    style: 'numeric',
    bibliographyOrder: 'firstAppearance',
    textCitationStyle: 'number',
    citationContainer: 'square',
  },
})
