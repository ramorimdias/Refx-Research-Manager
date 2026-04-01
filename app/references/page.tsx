'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  Copy,
  GripVertical,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { EmptyState } from '@/components/refx/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/store'
import type { CitationStyle, Document } from '@/lib/types'
import * as repo from '@/lib/repositories/local-db'
import {
  findMatchingDocuments,
  findReusableReference,
  formatReference,
  matchReferenceToDocument,
  mergeReferenceDraft,
  normalizeWhitespace,
  seedReferenceFromDocument,
} from '@/lib/services/work-reference-service'
import { cn } from '@/lib/utils'

type ReferenceFormState = {
  title: string
  authors: string
  year: string
  doi: string
  publisher: string
  journal: string
  booktitle: string
  url: string
  abstract: string
  type: string
}

const DEFAULT_REFERENCE_FORM: ReferenceFormState = {
  title: '',
  authors: '',
  year: '',
  doi: '',
  publisher: '',
  journal: '',
  booktitle: '',
  url: '',
  abstract: '',
  type: 'misc',
}

const CITATION_STYLES: Array<{ value: CitationStyle; label: string }> = [
  { value: 'apa', label: 'APA' },
  { value: 'mla', label: 'MLA' },
  { value: 'chicago', label: 'Chicago' },
]

function buildDocumentResumeHref(document: Document) {
  if (document.documentType === 'pdf') {
    const params = new URLSearchParams({ id: document.id })
    if (document.lastReadPage && document.lastReadPage > 0) {
      params.set('page', String(document.lastReadPage))
    }
    return `/reader/view?${params.toString()}`
  }

  return document.documentType === 'physical_book'
    ? `/books/notes?id=${document.id}`
    : `/documents?id=${document.id}`
}

export default function ReferencesPage() {
  const router = useRouter()
  const libraries = useAppStore((state) => state.libraries)
  const documents = useAppStore((state) => state.documents)
  const activeLibraryId = useAppStore((state) => state.activeLibraryId)
  const createDocumentRecord = useAppStore((state) => state.createDocumentRecord)
  const myWorks = useMemo(
    () =>
      documents
        .filter((document) => document.documentType === 'my_work')
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()),
    [documents],
  )

  const [selectedWorkId, setSelectedWorkId] = useState<string>('')
  const [workReferences, setWorkReferences] = useState<repo.DbWorkReference[]>([])
  const [allReferences, setAllReferences] = useState<repo.DbReference[]>([])
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [isAddingWork, setIsAddingWork] = useState(false)
  const [newWorkTitle, setNewWorkTitle] = useState('')
  const [isSavingWork, setIsSavingWork] = useState(false)
  const [isAddingReference, setIsAddingReference] = useState(false)
  const [referenceForm, setReferenceForm] = useState<ReferenceFormState>(DEFAULT_REFERENCE_FORM)
  const [preferredMatchDocumentId, setPreferredMatchDocumentId] = useState<string | null>(null)
  const [selectedStyle, setSelectedStyle] = useState<CitationStyle>('apa')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSubmittingReference, setIsSubmittingReference] = useState(false)
  const [isRecheckingMatches, setIsRecheckingMatches] = useState(false)
  const [draggingWorkReferenceId, setDraggingWorkReferenceId] = useState<string | null>(null)
  const [copiedWorkReferenceId, setCopiedWorkReferenceId] = useState<string | null>(null)
  const [pendingDeleteWorkReferenceId, setPendingDeleteWorkReferenceId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedWorkId && myWorks[0]?.id) {
      setSelectedWorkId(myWorks[0].id)
      return
    }

    if (selectedWorkId && !myWorks.some((document) => document.id === selectedWorkId)) {
      setSelectedWorkId(myWorks[0]?.id ?? '')
    }
  }, [myWorks, selectedWorkId])

  useEffect(() => {
    let cancelled = false

    const loadSharedReferences = async () => {
      try {
        const nextReferences = await repo.listReferences()
        if (!cancelled) setAllReferences(nextReferences)
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Could not load references.')
        }
      }
    }

    void loadSharedReferences()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadWorkReferences = async () => {
      if (!selectedWorkId) {
        setWorkReferences([])
        return
      }

      setIsLoadingReferences(true)
      try {
        const nextReferences = await repo.listWorkReferences(selectedWorkId)
        if (!cancelled) setWorkReferences(nextReferences)
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Could not load work references.')
        }
      } finally {
        if (!cancelled) setIsLoadingReferences(false)
      }
    }

    void loadWorkReferences()
    return () => {
      cancelled = true
    }
  }, [selectedWorkId])

  const selectedWork = useMemo(
    () => myWorks.find((document) => document.id === selectedWorkId) ?? null,
    [myWorks, selectedWorkId],
  )

  const documentById = useMemo(
    () => new Map(documents.map((document) => [document.id, document])),
    [documents],
  )

  const liveSuggestions = useMemo(
    () =>
      findMatchingDocuments(documents, {
        title: referenceForm.title,
        authors: referenceForm.authors,
        year: Number.parseInt(referenceForm.year, 10) || undefined,
        doi: referenceForm.doi,
      }),
    [documents, referenceForm.authors, referenceForm.doi, referenceForm.title, referenceForm.year],
  )

  const existingWorkDocumentIds = useMemo(
    () =>
      new Set(
        workReferences.flatMap((workReference) => {
          const ids: string[] = []
          if (workReference.matchedDocumentId) ids.push(workReference.matchedDocumentId)
          if (workReference.reference.documentId) ids.push(workReference.reference.documentId)
          return ids
        }),
      ),
    [workReferences],
  )

  const resetReferenceDialog = () => {
    setReferenceForm(DEFAULT_REFERENCE_FORM)
    setPreferredMatchDocumentId(null)
  }

  const saveReferenceToSelectedWork = async (
    referenceDraft: Parameters<typeof mergeReferenceDraft>[0],
    directMatch?: {
      matchedDocumentId?: string
      matchMethod?: string
      matchConfidence?: number
    },
  ) => {
    if (!selectedWork) {
      throw new Error('Select a work before adding references.')
    }

    const reusable = findReusableReference(allReferences, referenceDraft)
    const sharedReference = reusable
      ? await repo.updateReference(reusable.id, referenceDraft) ?? reusable
      : await repo.createReference(referenceDraft)

    const matched = directMatch ?? matchReferenceToDocument(documents, referenceDraft)

    await repo.createWorkReference({
      workDocumentId: selectedWork.id,
      referenceId: sharedReference.id,
      matchedDocumentId: matched.matchedDocumentId,
      matchMethod: matched.matchMethod,
      matchConfidence: matched.matchConfidence,
    })

    const [nextReferences, nextSharedReferences] = await Promise.all([
      repo.listWorkReferences(selectedWork.id),
      repo.listReferences(),
    ])
    setWorkReferences(nextReferences)
    setAllReferences(nextSharedReferences)
  }

  const handleCreateWork = async () => {
    const title = normalizeWhitespace(newWorkTitle)
    if (!title) {
      setStatusMessage('A work name is required.')
      return
    }

    const libraryId = activeLibraryId ?? libraries[0]?.id
    if (!libraryId) {
      setStatusMessage('Create a library before adding a work.')
      return
    }

    setIsSavingWork(true)
    setStatusMessage(null)
    try {
      const created = await createDocumentRecord({
        libraryId,
        title,
        documentType: 'my_work',
      })

      if (created) {
        setSelectedWorkId(created.id)
        setNewWorkTitle('')
        setIsAddingWork(false)
        setStatusMessage(`Created "${created.title}".`)
      }
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not create the work.')
    } finally {
      setIsSavingWork(false)
    }
  }

  const handleUseSuggestion = async (document: Document) => {
    if (!selectedWork) {
      setStatusMessage('Select a work before adding references.')
      return
    }

    const seeded = seedReferenceFromDocument(document)
    setIsSubmittingReference(true)
    setStatusMessage(null)

    try {
      await saveReferenceToSelectedWork(seeded, {
        matchedDocumentId: document.id,
        matchMethod: seeded.doi ? 'doi_exact' : 'title_exact',
        matchConfidence: 0.99,
      })
      setIsAddingReference(false)
      resetReferenceDialog()
      setStatusMessage(`Added "${document.title}" to this work.`)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not add the reference.')
    } finally {
      setIsSubmittingReference(false)
    }
  }

  const handleAddReference = async () => {
    if (!selectedWork) {
      setStatusMessage('Select a work before adding references.')
      return
    }

    const title = normalizeWhitespace(referenceForm.title)
    if (!title) {
      setStatusMessage('Reference title is required.')
      return
    }

    const seededDocument = preferredMatchDocumentId ? documentById.get(preferredMatchDocumentId) ?? null : null
    const baseDraft = seededDocument ? seedReferenceFromDocument(seededDocument) : {
      type: referenceForm.type || 'misc',
      title,
    }

    const referenceDraft = mergeReferenceDraft(baseDraft, {
      title,
      authors: referenceForm.authors || undefined,
      year: Number.parseInt(referenceForm.year, 10) || undefined,
      doi: referenceForm.doi || undefined,
      publisher: referenceForm.publisher || undefined,
      journal: referenceForm.journal || undefined,
      booktitle: referenceForm.booktitle || undefined,
      url: referenceForm.url || undefined,
      abstract: referenceForm.abstract || undefined,
      type: referenceForm.type || baseDraft.type || 'misc',
      documentId: seededDocument?.id ?? baseDraft.documentId,
    })

    setIsSubmittingReference(true)
    setStatusMessage(null)
    try {
      const matched = preferredMatchDocumentId
        ? {
            matchedDocumentId: preferredMatchDocumentId,
            matchMethod: referenceDraft.doi ? 'doi_exact' : 'title_exact',
            matchConfidence: 0.99,
          }
        : matchReferenceToDocument(documents, referenceDraft)

      await saveReferenceToSelectedWork(referenceDraft, matched)
      setIsAddingReference(false)
      resetReferenceDialog()
      setStatusMessage('Reference added.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not add the reference.')
    } finally {
      setIsSubmittingReference(false)
    }
  }

  const handleCopyReference = async (reference: repo.DbReference) => {
    try {
      await navigator.clipboard.writeText(formatReference(reference, selectedStyle))
      const relatedWorkReference = workReferences.find((entry) => entry.reference.id === reference.id)
      setCopiedWorkReferenceId(relatedWorkReference?.id ?? null)
      window.setTimeout(() => {
        setCopiedWorkReferenceId((current) =>
          current === (relatedWorkReference?.id ?? null) ? null : current,
        )
      }, 1600)
    } catch {
      setStatusMessage('Could not copy the reference.')
    }
  }

  const handleDeleteWorkReference = async (id: string) => {
    try {
      await repo.deleteWorkReference(id)
      const nextReferences = selectedWork ? await repo.listWorkReferences(selectedWork.id) : []
      setWorkReferences(nextReferences)
      setStatusMessage('Reference removed from this work.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not remove the reference.')
    }
  }

  const handleRecheckMatches = async () => {
    if (!selectedWork) return

    setIsRecheckingMatches(true)
    setStatusMessage(null)
    try {
      const refreshed = await repo.recheckWorkReferenceMatches(selectedWork.id)
      setWorkReferences(refreshed)
      setStatusMessage('Reference matches refreshed.')
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not refresh matches.')
    } finally {
      setIsRecheckingMatches(false)
    }
  }

  const handleDropWorkReference = async (targetId: string) => {
    if (!selectedWork || !draggingWorkReferenceId || draggingWorkReferenceId === targetId) return

    const current = [...workReferences]
    const fromIndex = current.findIndex((item) => item.id === draggingWorkReferenceId)
    const toIndex = current.findIndex((item) => item.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return

    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    setWorkReferences(current)
    setDraggingWorkReferenceId(null)

    try {
      const reordered = await repo.reorderWorkReferences(
        selectedWork.id,
        current.map((item) => item.id),
      )
      setWorkReferences(reordered)
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Could not reorder references.')
      const restored = await repo.listWorkReferences(selectedWork.id)
      setWorkReferences(restored)
    }
  }

  const pendingDeleteWorkReference = useMemo(
    () => workReferences.find((entry) => entry.id === pendingDeleteWorkReferenceId) ?? null,
    [pendingDeleteWorkReferenceId, workReferences],
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">My References</h1>
          <p className="text-sm text-muted-foreground">
            Build reusable bibliographies for your work, mix matched documents and freeform references, and copy them in your preferred style.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedStyle} onValueChange={(value) => setSelectedStyle(value as CitationStyle)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Citation style" />
            </SelectTrigger>
            <SelectContent>
              {CITATION_STYLES.map((style) => (
                <SelectItem key={style.value} value={style.value}>
                  {style.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" onClick={() => setIsAddingWork(true)}>
            <Plus className="h-4 w-4" />
            Add work
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="min-h-0">
          <CardHeader>
            <Tooltip>
              <TooltipTrigger asChild>
                <CardTitle className="w-fit cursor-help">Works</CardTitle>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={8}>
                Choose a My work item or create a new one.
              </TooltipContent>
            </Tooltip>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={selectedWorkId} onValueChange={setSelectedWorkId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a work" />
              </SelectTrigger>
              <SelectContent>
                {myWorks.map((work) => (
                  <SelectItem key={work.id} value={work.id}>
                    {work.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedWork ? (
              <div className="rounded-2xl bg-muted/60 p-4">
                <div className="text-sm font-medium">{selectedWork.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {workReferences.length} reference{workReferences.length === 1 ? '' : 's'}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No work selected"
                description={myWorks.length ? 'Select a work to manage its bibliography.' : 'Create your first work to start collecting references.'}
              />
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="w-fit cursor-help">Bibliography</CardTitle>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8}>
                  {`Drag to reorder. Copy any entry in ${selectedStyle.toUpperCase()} format.`}
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddingReference(true)}
                disabled={!selectedWork}
              >
                <Plus className="h-4 w-4" />
                Add reference
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleRecheckMatches()}
                disabled={!selectedWork || isRecheckingMatches}
              >
                {isRecheckingMatches ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Recheck matches
              </Button>
            </div>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto">
            {statusMessage ? (
              <div className="rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground">
                {statusMessage}
              </div>
            ) : null}

            {!selectedWork ? (
              <EmptyState
                icon={BookOpen}
                title="Select a work"
                description="Choose a My work item on the left to manage its references."
              />
            ) : isLoadingReferences ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading references...
              </div>
            ) : workReferences.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="No references yet"
                description="Add references to build the bibliography for this work."
              />
            ) : (
              <div className="space-y-3">
                {workReferences.map((workReference, index) => {
                  const matchedDocument = workReference.matchedDocumentId
                    ? documentById.get(workReference.matchedDocumentId) ?? null
                    : null

                  return (
                    <div
                      key={workReference.id}
                      draggable
                      onDragStart={() => setDraggingWorkReferenceId(workReference.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => void handleDropWorkReference(workReference.id)}
                      onClick={() => {
                        if (!matchedDocument) return
                        router.push(buildDocumentResumeHref(matchedDocument))
                      }}
                      className={cn(
                        'h-[78px] overflow-hidden rounded-2xl border bg-card px-4 py-2 transition',
                        matchedDocument && 'cursor-pointer hover:border-primary/40 hover:bg-accent/30',
                        draggingWorkReferenceId === workReference.id && 'opacity-60',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 cursor-grab text-muted-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                                  [{index + 1}]
                                </span>
                                <div className="truncate text-sm font-semibold">{workReference.reference.title}</div>
                                {matchedDocument ? (
                                  <span className="shrink-0 inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] text-sky-700">
                                    Exists in libraries
                                  </span>
                                ) : null}
                              </div>
                              <div className="line-clamp-2 text-xs text-muted-foreground">
                                {formatReference(workReference.reference, selectedStyle)}
                              </div>
                            </div>
                            <div className="ml-auto flex shrink-0 items-start gap-2 self-start">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void handleCopyReference(workReference.reference)
                                }}
                                aria-label="Copy reference"
                                className={cn(
                                  copiedWorkReferenceId === workReference.id
                                    ? 'border-emerald-300 text-emerald-600'
                                    : '',
                                )}
                              >
                                {copiedWorkReferenceId === workReference.id ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setPendingDeleteWorkReferenceId(workReference.id)
                                }}
                                aria-label="Remove reference"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isAddingWork} onOpenChange={setIsAddingWork}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add work</DialogTitle>
            <DialogDescription>Create a My work item that can hold an ordered bibliography.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-work-title">Work name</Label>
            <Input
              id="new-work-title"
              value={newWorkTitle}
              onChange={(event) => setNewWorkTitle(event.target.value)}
              placeholder="My article draft"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsAddingWork(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreateWork()} disabled={isSavingWork}>
              {isSavingWork ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create work
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isAddingReference}
        onOpenChange={(open) => {
          setIsAddingReference(open)
          if (!open) resetReferenceDialog()
        }}
      >
        <DialogContent className="w-[72vw] max-w-[1080px] sm:max-w-[1080px]">
          <DialogHeader>
            <DialogTitle>Add reference</DialogTitle>
            <DialogDescription>
              Match one of your documents when possible, or save a freeform reference that only exists in this bibliography.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reference-title">Title</Label>
                <Input
                  id="reference-title"
                  value={referenceForm.title}
                  onChange={(event) => setReferenceForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Reference title"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reference-authors">Authors</Label>
                  <Input
                    id="reference-authors"
                    value={referenceForm.authors}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, authors: event.target.value }))}
                    placeholder="Author One; Author Two"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-year">Year</Label>
                  <Input
                    id="reference-year"
                    value={referenceForm.year}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, year: event.target.value }))}
                    placeholder="2024"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reference-doi">DOI</Label>
                  <Input
                    id="reference-doi"
                    value={referenceForm.doi}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, doi: event.target.value }))}
                    placeholder="10.1234/example"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-type">Type</Label>
                  <Select
                    value={referenceForm.type}
                    onValueChange={(value) => setReferenceForm((current) => ({ ...current, type: value }))}
                  >
                    <SelectTrigger id="reference-type">
                      <SelectValue placeholder="Reference type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="article">Article</SelectItem>
                      <SelectItem value="book">Book</SelectItem>
                      <SelectItem value="inproceedings">Conference</SelectItem>
                      <SelectItem value="thesis">Thesis</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="misc">Misc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reference-publisher">Publisher / source</Label>
                  <Input
                    id="reference-publisher"
                    value={referenceForm.publisher}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, publisher: event.target.value }))}
                    placeholder="Publisher"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-journal">Journal</Label>
                  <Input
                    id="reference-journal"
                    value={referenceForm.journal}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, journal: event.target.value }))}
                    placeholder="Journal name"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="reference-booktitle">Booktitle / collection</Label>
                  <Input
                    id="reference-booktitle"
                    value={referenceForm.booktitle}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, booktitle: event.target.value }))}
                    placeholder="Book or proceedings"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference-url">URL</Label>
                  <Input
                    id="reference-url"
                    value={referenceForm.url}
                    onChange={(event) => setReferenceForm((current) => ({ ...current, url: event.target.value }))}
                    placeholder="https://example.org"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reference-abstract">Abstract / note</Label>
                <Textarea
                  id="reference-abstract"
                  value={referenceForm.abstract}
                  onChange={(event) => setReferenceForm((current) => ({ ...current, abstract: event.target.value }))}
                  placeholder="Optional summary or note"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex max-h-[70vh] min-h-0 flex-col rounded-2xl bg-muted/50 p-5">
              <div>
                <div className="text-base font-medium">Matching suggestions</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Existing documents are suggested by DOI first, then title, author, and year.
                </div>
              </div>

              {liveSuggestions.length ? (
                <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {liveSuggestions.map(({ document, score }) => {
                    const alreadyInWork = existingWorkDocumentIds.has(document.id)
                    return (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => void handleUseSuggestion(document)}
                      disabled={isSubmittingReference}
                      className={cn(
                        'block w-full rounded-2xl border px-4 py-3 text-left transition hover:bg-card disabled:cursor-wait disabled:opacity-70',
                        preferredMatchDocumentId === document.id
                          ? 'border-sky-300 bg-sky-50'
                          : 'border-border bg-background',
                      )}
                    >
                      <div className="line-clamp-2 text-base font-medium leading-6">{document.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {document.authors.join(', ') || 'Unknown author'}
                        {document.year ? ` • ${document.year}` : ''}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          Match {Math.round(score * 100)}%
                        </span>
                        {alreadyInWork ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
                            Already in this work
                          </span>
                        ) : null}
                      </div>
                    </button>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  Type a title, DOI, or author to see matching documents from your library.
                </div>
              )}

              {preferredMatchDocumentId ? (
                <div className="mt-4 rounded-2xl bg-sky-100 px-4 py-3 text-sm text-sky-700">
                  This reference will be linked to an existing document if the match stays valid.
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                  You can still save a freeform unmatched reference.
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAddingReference(false)
                resetReferenceDialog()
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleAddReference()} disabled={isSubmittingReference}>
              {isSubmittingReference ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add reference
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingDeleteWorkReference)}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteWorkReferenceId(null)
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove reference</DialogTitle>
            <DialogDescription>
              {pendingDeleteWorkReference
                ? `Remove "${pendingDeleteWorkReference.reference.title}" from this work?`
                : 'Remove this reference from the current work?'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDeleteWorkReferenceId(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDeleteWorkReferenceId) return
                void handleDeleteWorkReference(pendingDeleteWorkReferenceId)
                setPendingDeleteWorkReferenceId(null)
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
