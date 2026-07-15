'use client'

import type { PdfPageWords } from '@/lib/services/document-processing'
import type { WorkType, WorkTypeDetection } from '@/lib/types'

export function requiresDoiForWorkType(workType: WorkType) {
  return workType === 'journal_article' || workType === 'conference_paper'
}

export type PdfWorkTypeInput = {
  pages: Array<PdfPageWords & { width?: number; height?: number }>
  embeddedProducer?: string
  fileName?: string
}

const countMatches = (text: string, pattern: RegExp) => (text.match(pattern) ?? []).length

export function classifyPdfWorkType(input: PdfWorkTypeInput): { workType: WorkType; detection: WorkTypeDetection } {
  const pages = input.pages
  const text = pages.map((page) => page.text).join('\n').toLowerCase()
  const first = pages[0]
  const avgWords = pages.length ? pages.reduce((sum, page) => sum + page.words.length, 0) / pages.length : 0
  const landscapeRatio = pages.length
    ? pages.filter((page) => (page.width ?? 0) > (page.height ?? Number.MAX_SAFE_INTEGER)).length / pages.length
    : 0
  const largeTextRatio = first?.words.length
    ? first.words.filter((word) => word.height >= 20).length / first.words.length
    : 0
  const paperSections = countMatches(text, /\b(abstract|introduction|method(?:s|ology)?|results|discussion|references)\b/g)
  const presentationTerms = countMatches(`${text}\n${input.fileName ?? ''}\n${input.embeddedProducer ?? ''}`.toLowerCase(), /\b(slides?|presentation|keynote|webinar|workshop|powerpoint)\b/g)
  const posterTerms = countMatches(text, /\b(poster|poster session)\b/g)
  const thesisTerms = countMatches(text, /\b(thesis|dissertation|doctoral degree|master'?s degree)\b/g)
  const reportTerms = countMatches(text, /\b(technical report|annual report|white paper|working paper)\b/g)
  const bookTerms = countMatches(text, /\b(isbn|edition|published by|table of contents|chapter 1)\b/g)
  const internalTerms = countMatches(text, /\b(internal|confidential|company confidential|do not distribute)\b/g)
  const conferenceTerms = countMatches(text, /\b(conference|symposium|proceedings|annual meeting)\b/g)
  const signals: string[] = []

  let workType: WorkType = 'other'
  let confidence = 0.45
  if (posterTerms > 0 && pages.length <= 3) {
    workType = 'poster'; confidence = 0.86; signals.push('Poster wording and very short document')
  } else if (thesisTerms > 0 && paperSections >= 3) {
    workType = 'thesis'; confidence = 0.88; signals.push('Thesis or dissertation wording', 'Long-form research sections')
  } else if (reportTerms > 0) {
    workType = 'report'; confidence = 0.8; signals.push('Report wording')
  } else if (bookTerms >= 2 && pages.length > 20) {
    workType = 'book'; confidence = 0.78; signals.push('Book publishing structure')
  } else if (presentationTerms > 0 || (pages.length >= 3 && landscapeRatio >= 0.6 && avgWords < 90) || (pages.length >= 3 && landscapeRatio >= 0.5 && largeTextRatio > 0.18)) {
    workType = 'presentation'
    confidence = Math.min(0.94, 0.62 + (presentationTerms ? 0.16 : 0) + (landscapeRatio >= 0.6 ? 0.1 : 0) + (avgWords < 90 ? 0.06 : 0))
    if (presentationTerms) signals.push('Presentation wording or producer metadata')
    if (landscapeRatio >= 0.6) signals.push('Mostly landscape pages')
    if (avgWords < 90) signals.push('Low text density per page')
    if (largeTextRatio > 0.18) signals.push('Prominent title-sized text')
    if (internalTerms > 0) signals.push('Contains internal or confidential markings')
  } else if (internalTerms > 0) {
    workType = 'internal_document'; confidence = 0.82; signals.push('Internal or confidential wording')
  } else if (paperSections >= 3) {
    workType = conferenceTerms ? 'conference_paper' : 'journal_article'
    confidence = conferenceTerms ? 0.84 : 0.82
    signals.push('Research-paper section structure')
    if (conferenceTerms) signals.push('Conference or proceedings wording')
  }

  return { workType, detection: { source: 'automatic', confidence, signals, locked: false } }
}

export function defaultWorkTypeDetection(): WorkTypeDetection {
  return { source: 'automatic', confidence: 0, signals: ['Not classified yet'], locked: false }
}
