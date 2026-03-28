'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Link2,
  Save,
  Star,
  Tag,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState, StarRating, TagChip } from '@/components/refx/common'
import { useAppStore } from '@/lib/store'
import type { DocumentRelationLinkType, ReadingStage } from '@/lib/types'
import { cn } from '@/lib/utils'

const readingStages: Array<{ value: ReadingStage; label: string }> = [
  { value: 'unread', label: 'Unread' },
  { value: 'reading', label: 'Reading' },
  { value: 'skimmed', label: 'Skimmed' },
  { value: 'read', label: 'Read' },
  { value: 'archived', label: 'Archived' },
]

type RelationListItem = {
  relationId: string
  relatedDocumentId: string
}

export default function DocumentDetailPage() {
  const params = useSearchParams()
  const id = params.get('id')
  const {
    documents,
    libraries,
    relations,
    initialized,
    addDocumentTag,
    removeDocumentTag,
    acceptSuggestedTag,
    rejectSuggestedTag,
    updateDocument,
    createRelation,
    deleteRelation,
    setActiveDocument,
  } = useAppStore()

  const document = useMemo(() => documents.find((entry) => entry.id === id) ?? null, [documents, id])
  const documentById = useMemo(() => new Map(documents.map((entry) => [entry.id, entry])), [documents])
  const libraryNameById = useMemo(() => new Map(libraries.map((library) => [library.id, library.name])), [libraries])

  const [title, setTitle] = useState('')
  const [authors, setAuthors] = useState('')
  const [year, setYear] = useState('')
  const [doi, setDoi] = useState('')
  const [isbn, setIsbn] = useState('')
  const [publisher, setPublisher] = useState('')
  const [citationKey, setCitationKey] = useState('')
  const [abstract, setAbstract] = useState('')
  const [readingStage, setReadingStage] = useState<ReadingStage>('unread')
  const [rating, setRating] = useState(0)
  const [favorite, setFavorite] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const [relationDirection, setRelationDirection] = useState<'outbound' | 'inbound'>('outbound')
  const [relationTargetId, setRelationTargetId] = useState('')
  const [relationType, setRelationType] = useState<DocumentRelationLinkType>('manual')
  const [relationLabel, setRelationLabel] = useState('')
  const [relationNotes, setRelationNotes] = useState('')
  const [isCreatingRelation, setIsCreatingRelation] = useState(false)
  const [isRelationTargetPickerOpen, setIsRelationTargetPickerOpen] = useState(false)

  const [detailsExpanded, setDetailsExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(true)
  const [linksExpanded, setLinksExpanded] = useState(true)

  useEffect(() => {
    if (!document) return
    setActiveDocument(document.id)
    setTitle(document.title)
    setAuthors(document.authors.join(', '))
    setYear(document.year ? String(document.year) : '')
    setDoi(document.doi ?? '')
    setIsbn(document.isbn ?? '')
    setPublisher(document.publisher ?? '')
    setCitationKey(document.citationKey ?? '')
    setAbstract(document.abstract ?? '')
    setReadingStage(document.readingStage)
    setRating(document.rating)
    setFavorite(document.favorite)
    setRelationTargetId('')
    setRelationLabel('')
    setRelationNotes('')
    setRelationType('manual')
    setRelationDirection('outbound')
  }, [document, setActiveDocument])

  const relationItems = useMemo(() => {
    if (!document) {
      return {
        outgoing: [] as RelationListItem[],
        incoming: [] as RelationListItem[],
      }
    }

    const outgoing = relations
      .filter((relation) => relation.sourceDocumentId === document.id)
      .map((relation) => ({ relationId: relation.id, relatedDocumentId: relation.targetDocumentId }))
      .filter((entry) => documentById.has(entry.relatedDocumentId))

    const incoming = relations
      .filter((relation) => relation.targetDocumentId === document.id)
      .map((relation) => ({ relationId: relation.id, relatedDocumentId: relation.sourceDocumentId }))
      .filter((entry) => documentById.has(entry.relatedDocumentId))

    return { outgoing, incoming }
  }, [document, documentById, relations])

  const availableRelationTargets = useMemo(() => {
    if (!document) return []

    return documents
      .filter((entry) => entry.id !== document.id)
      .sort((left, right) => left.title.localeCompare(right.title))
  }, [document, documents])

  if (!id) {
    return <div className="p-6">Missing document id.</div>
  }

  if (!document) {
    if (!initialized) return <div className="p-6">Loading document...</div>
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          icon={BookOpen}
          title="Document not found"
          description="This document is no longer available in your local library."
          action={
            <Button asChild>
              <Link href="/libraries">Back to Libraries</Link>
            </Button>
          }
        />
      </div>
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await updateDocument(document.id, {
        title: title.trim() || document.title,
        authors: authors
          .split(',')
          .map((author) => author.trim())
          .filter(Boolean),
        year: year ? Number(year) : undefined,
        doi: doi.trim() || undefined,
        isbn: isbn.trim() || undefined,
        publisher: publisher.trim() || undefined,
        citationKey: citationKey.trim() || '',
        abstract: abstract.trim() || undefined,
        readingStage,
        rating,
        favorite,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleAddTag = async () => {
    if (!document || !tagInput.trim()) return
    await addDocumentTag(document.id, tagInput)
    setTagInput('')
  }

  const handleCreateRelation = async () => {
    if (!document || !relationTargetId) return

    const sourceDocumentId = relationDirection === 'outbound' ? document.id : relationTargetId
    const targetDocumentId = relationDirection === 'outbound' ? relationTargetId : document.id

    const alreadyExists = relations.some(
      (relation) =>
        relation.sourceDocumentId === sourceDocumentId
        && relation.targetDocumentId === targetDocumentId
        && relation.linkOrigin === 'user'
        && relation.linkType === relationType,
    )

    if (alreadyExists) return

    setIsCreatingRelation(true)
    try {
      await createRelation({
        sourceDocumentId,
        targetDocumentId,
        linkType: relationType,
        linkOrigin: 'user',
        label: relationLabel.trim() || undefined,
        notes: relationNotes.trim() || undefined,
      })
      setRelationTargetId('')
      setRelationLabel('')
      setRelationNotes('')
      setRelationType('manual')
      setRelationDirection('outbound')
    } finally {
      setIsCreatingRelation(false)
    }
  }

  const renderRelationList = (
    titleText: string,
    items: RelationListItem[],
    emptyText: string,
  ) => (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">{titleText}</Label>
      </div>
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => {
            const relatedDocument = documentById.get(item.relatedDocumentId)
            const relatedRelation = relations.find((relation) => relation.id === item.relationId)
            if (!relatedDocument || !relatedRelation) return null

            return (
              <div
                key={item.relationId}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border bg-muted/20 p-3"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    href={`/documents?id=${relatedDocument.id}`}
                    className="block text-sm font-medium hover:underline"
                  >
                    {relatedDocument.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {relatedDocument.authors.join(', ') || 'Unknown author'}
                    {relatedDocument.year ? ` • ${relatedDocument.year}` : ''}
                    {libraryNameById.get(relatedDocument.libraryId)
                      ? ` • ${libraryNameById.get(relatedDocument.libraryId)}`
                      : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {relatedRelation.linkOrigin === 'auto' ? 'Automatic' : 'Manual'}
                    {relatedRelation.linkType !== 'manual'
                      ? ` • ${relatedRelation.linkType.replaceAll('_', ' ')}`
                      : ''}
                    {relatedRelation.label ? ` • ${relatedRelation.label}` : ''}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => void deleteRelation(item.relationId)}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}
    </section>
  )

  return (
    <div className="p-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="outline" size="sm">
            <Link href="/libraries">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>

          <div className="flex items-center gap-2">
            <Button asChild variant="outline">
              <Link
                href={
                  document.documentType === 'physical_book'
                    ? `/books/notes?id=${document.id}`
                    : `/reader/view?id=${document.id}`
                }
              >
                <BookOpen className="mr-2 h-4 w-4" />
                {document.documentType === 'physical_book' ? 'Open Notes' : 'Open Reader'}
              </Link>
            </Button>
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <Card>
          <Collapsible open={detailsExpanded} onOpenChange={setDetailsExpanded}>
            <CardHeader>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                <CardTitle>Edit Details</CardTitle>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${detailsExpanded ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label htmlFor="title">Title</Label>
                    <Input id="title" className="mt-1.5" value={title} onChange={(event) => setTitle(event.target.value)} />
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="authors">Authors</Label>
                    <Input
                      id="authors"
                      className="mt-1.5"
                      value={authors}
                      onChange={(event) => setAuthors(event.target.value)}
                      placeholder="Comma-separated author names"
                    />
                  </div>

                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input id="year" className="mt-1.5" value={year} onChange={(event) => setYear(event.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="reading-stage">Reading Stage</Label>
                    <Select value={readingStage} onValueChange={(value) => setReadingStage(value as ReadingStage)}>
                      <SelectTrigger id="reading-stage" className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {readingStages.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="doi">DOI</Label>
                    <Input id="doi" className="mt-1.5" value={doi} onChange={(event) => setDoi(event.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="isbn">ISBN</Label>
                    <Input id="isbn" className="mt-1.5" value={isbn} onChange={(event) => setIsbn(event.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="publisher">Publisher</Label>
                    <Input id="publisher" className="mt-1.5" value={publisher} onChange={(event) => setPublisher(event.target.value)} />
                  </div>

                  <div>
                    <Label htmlFor="citation-key">Citation Key</Label>
                    <Input
                      id="citation-key"
                      className="mt-1.5"
                      value={citationKey}
                      onChange={(event) => setCitationKey(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <StarRating rating={rating} onChange={setRating} />
                  </div>

                  <div className="space-y-2">
                    <Label>Favorite</Label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-md border border-input px-3 py-2 text-sm"
                      onClick={() => setFavorite((current) => !current)}
                    >
                      <Star className="h-4 w-4" fill={favorite ? 'currentColor' : 'none'} />
                      {favorite ? 'Marked Favorite' : 'Mark Favorite'}
                    </button>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="abstract">Abstract</Label>
                    <Textarea
                      id="abstract"
                      className="mt-1.5 min-h-40"
                      value={abstract}
                      onChange={(event) => setAbstract(event.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={tagsExpanded} onOpenChange={setTagsExpanded}>
            <CardHeader>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle>Tags</CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Manual tags, suggestions, and semantic classification
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{document.tags.length} tag{document.tags.length === 1 ? '' : 's'}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${tagsExpanded ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <section className="rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Manual Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {document.tags.length > 0 ? (
                        document.tags.map((tag) => (
                          <TagChip
                            key={tag}
                            name={tag}
                            removable
                            onRemove={() => void removeDocumentTag(document.id, tag)}
                          />
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No tags added yet.</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleAddTag()
                          }
                        }}
                        placeholder="Add a manual tag"
                      />
                      <Button type="button" variant="outline" onClick={() => void handleAddTag()} disabled={!tagInput.trim()}>
                        Add Tag
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Suggested Tags</Label>
                    {document.suggestedTags && document.suggestedTags.length > 0 ? (
                      <div className="space-y-2">
                        {document.suggestedTags.map((tag) => (
                          <div key={tag.name} className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
                            <TagChip name={tag.name} />
                            {typeof tag.confidence === 'number' && (
                              <span className="text-xs text-muted-foreground">
                                {Math.round(tag.confidence * 100)}%
                              </span>
                            )}
                            <Button size="sm" variant="outline" onClick={() => void acceptSuggestedTag(document.id, tag.name)}>
                              Accept
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => void rejectSuggestedTag(document.id, tag.name)}>
                              Reject
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No pending tag suggestions for this document.</p>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-border p-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Semantic Classification</Label>
                    {document.classification ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{document.classification.category}</span>
                          <span className="text-xs text-muted-foreground">/</span>
                          <span className="text-sm">{document.classification.topic}</span>
                          <span className="text-xs text-muted-foreground">
                            {Math.round(document.classification.confidence * 100)}% confidence
                          </span>
                        </div>
                        {document.classification.suggestedTags && document.classification.suggestedTags.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {document.classification.suggestedTags.map((tag) => (
                              <TagChip key={tag.name} name={tag.name} />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No semantic classification saved for this document.</p>
                    )}
                  </div>
                </section>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        <Card>
          <Collapsible open={linksExpanded} onOpenChange={setLinksExpanded}>
            <CardHeader>
              <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <CardTitle>Document Links</CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Incoming, outgoing, and manual relationships
                    </div>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${linksExpanded ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                {renderRelationList(
                  'Makes reference to',
                  relationItems.outgoing,
                  'No outgoing links saved for this document.',
                )}
                {renderRelationList(
                  'Is referenced by',
                  relationItems.incoming,
                  'No incoming links saved for this document.',
                )}

                <section className="rounded-lg border border-dashed border-border p-4">
                  <div className="mb-4">
                    <Label className="text-sm font-medium">Add manual link</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Create a manual relationship without leaving the details page.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="relation-direction">Direction</Label>
                      <Select
                        value={relationDirection}
                        onValueChange={(value) => setRelationDirection(value as 'outbound' | 'inbound')}
                      >
                        <SelectTrigger id="relation-direction" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="outbound">Makes reference to</SelectItem>
                          <SelectItem value="inbound">Is referenced by</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="relation-target">Document</Label>
                      <Popover open={isRelationTargetPickerOpen} onOpenChange={setIsRelationTargetPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            id="relation-target"
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={isRelationTargetPickerOpen}
                            className="mt-1.5 w-full justify-between font-normal"
                          >
                            <span className="truncate">
                              {relationTargetId
                                ? availableRelationTargets.find((targetDocument) => targetDocument.id === relationTargetId)?.title ?? 'Select a document'
                                : 'Select a document'}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search document titles..." />
                            <CommandList>
                              <CommandEmpty>No document found.</CommandEmpty>
                              <CommandGroup>
                                {availableRelationTargets.map((targetDocument) => (
                                  <CommandItem
                                    key={targetDocument.id}
                                    value={[
                                      targetDocument.title,
                                      targetDocument.authors.join(' '),
                                      targetDocument.year ? String(targetDocument.year) : '',
                                    ].join(' ')}
                                    onSelect={() => {
                                      setRelationTargetId(targetDocument.id)
                                      setIsRelationTargetPickerOpen(false)
                                    }}
                                  >
                                    <Check
                                      className={cn(
                                        'mr-2 h-4 w-4',
                                        relationTargetId === targetDocument.id ? 'opacity-100' : 'opacity-0',
                                      )}
                                    />
                                    <div className="min-w-0">
                                      <div className="truncate">{targetDocument.title}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {targetDocument.authors.join(', ') || 'Unknown author'}
                                        {targetDocument.year ? ` • ${targetDocument.year}` : ''}
                                      </div>
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div>
                      <Label htmlFor="relation-type">Relationship type</Label>
                      <Select
                        value={relationType}
                        onValueChange={(value) => setRelationType(value as DocumentRelationLinkType)}
                      >
                        <SelectTrigger id="relation-type" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="related">Related</SelectItem>
                          <SelectItem value="supports">Supports</SelectItem>
                          <SelectItem value="contradicts">Contradicts</SelectItem>
                          <SelectItem value="same_topic">Same topic</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="relation-label">Label</Label>
                      <Input
                        id="relation-label"
                        className="mt-1.5"
                        value={relationLabel}
                        onChange={(event) => setRelationLabel(event.target.value)}
                        placeholder="Optional short label"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label htmlFor="relation-notes">Notes</Label>
                      <Textarea
                        id="relation-notes"
                        className="mt-1.5 min-h-24"
                        value={relationNotes}
                        onChange={(event) => setRelationNotes(event.target.value)}
                        placeholder="Optional note about why these documents are linked"
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleCreateRelation()}
                      disabled={!relationTargetId || isCreatingRelation}
                    >
                      {isCreatingRelation ? 'Adding link...' : 'Add Link'}
                    </Button>
                  </div>
                </section>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      </div>
    </div>
  )
}
