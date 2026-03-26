'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { BookMarked, FileText, MessageSquare, MoreHorizontal, Settings2, Star } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Document } from '@/lib/types'
import { ReadingStageBadge, MetadataStatusBadge, OcrStatusBadge, StarRating } from './common'
import { useAppStore } from '@/lib/store'
import { DocumentActions, DocumentContextMenu } from './document-actions'

interface DocumentTableProps {
  documents: Document[]
}

type ColumnKey = 'favorite' | 'title' | 'authors' | 'year' | 'status' | 'annotations' | 'rating'

type ColumnDefinition = {
  key: ColumnKey
  label: string
  defaultWidth: number
  minWidth: number
  hideable?: boolean
}

const TABLE_WIDTHS_KEY = 'refx-library-table-widths'
const TABLE_VISIBILITY_KEY = 'refx-library-table-visibility'

const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  { key: 'favorite', label: 'Favorite', defaultWidth: 56, minWidth: 48, hideable: true },
  { key: 'title', label: 'Title', defaultWidth: 360, minWidth: 220 },
  { key: 'authors', label: 'Authors', defaultWidth: 220, minWidth: 140, hideable: true },
  { key: 'year', label: 'Year', defaultWidth: 80, minWidth: 70, hideable: true },
  { key: 'status', label: 'Status', defaultWidth: 150, minWidth: 120, hideable: true },
  { key: 'annotations', label: 'Annotations', defaultWidth: 120, minWidth: 90, hideable: true },
  { key: 'rating', label: 'Rating', defaultWidth: 140, minWidth: 110, hideable: true },
]

const DEFAULT_WIDTHS = Object.fromEntries(COLUMN_DEFINITIONS.map((column) => [column.key, column.defaultWidth])) as Record<ColumnKey, number>
const DEFAULT_VISIBILITY = Object.fromEntries(COLUMN_DEFINITIONS.map((column) => [column.key, true])) as Record<ColumnKey, boolean>

export function DocumentTable({ documents }: DocumentTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_WIDTHS)
  const [columnVisibility, setColumnVisibility] = useState<Record<ColumnKey, boolean>>(DEFAULT_VISIBILITY)
  const [resizingColumn, setResizingColumn] = useState<{ key: ColumnKey; startX: number; startWidth: number } | null>(null)
  const { toggleFavorite, updateDocument, generateKeywordsForDocuments } = useAppStore()

  useEffect(() => {
    const storedWidths = window.sessionStorage.getItem(TABLE_WIDTHS_KEY)
    const storedVisibility = window.sessionStorage.getItem(TABLE_VISIBILITY_KEY)

    if (storedWidths) {
      try {
        const parsed = JSON.parse(storedWidths) as Partial<Record<ColumnKey, number>>
        setColumnWidths((current) => ({ ...current, ...parsed }))
      } catch {
        // Ignore malformed session state.
      }
    }

    if (storedVisibility) {
      try {
        const parsed = JSON.parse(storedVisibility) as Partial<Record<ColumnKey, boolean>>
        setColumnVisibility((current) => ({ ...current, ...parsed }))
      } catch {
        // Ignore malformed session state.
      }
    }
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem(TABLE_WIDTHS_KEY, JSON.stringify(columnWidths))
  }, [columnWidths])

  useEffect(() => {
    window.sessionStorage.setItem(TABLE_VISIBILITY_KEY, JSON.stringify(columnVisibility))
  }, [columnVisibility])

  useEffect(() => {
    if (!resizingColumn) return

    const handlePointerMove = (event: MouseEvent) => {
      const definition = COLUMN_DEFINITIONS.find((column) => column.key === resizingColumn.key)
      if (!definition) return

      const nextWidth = Math.max(definition.minWidth, resizingColumn.startWidth + event.clientX - resizingColumn.startX)
      setColumnWidths((current) => ({
        ...current,
        [resizingColumn.key]: nextWidth,
      }))
    }

    const handlePointerUp = () => {
      setResizingColumn(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [resizingColumn])

  const visibleColumns = useMemo(
    () => COLUMN_DEFINITIONS.filter((column) => columnVisibility[column.key]),
    [columnVisibility],
  )

  const toggleSelection = (id: string) => {
    const newSelection = new Set(selectedIds)
    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }
    setSelectedIds(newSelection)
  }

  const toggleAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)))
    }
  }

  const beginResize = (key: ColumnKey, event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setResizingColumn({
      key,
      startX: event.clientX,
      startWidth: columnWidths[key],
    })
  }

  const setColumnVisible = (key: ColumnKey, visible: boolean) => {
    if (!visible && visibleColumns.length <= 1) return
    setColumnVisibility((current) => ({
      ...current,
      [key]: visible,
    }))
  }

  const renderResizeHandle = (key: ColumnKey) => (
    <div
      role="presentation"
      onMouseDown={(event) => beginResize(key, event)}
      className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
    />
  )

  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        {selectedIds.size > 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
            <Button size="sm" variant="outline" onClick={() => void generateKeywordsForDocuments(Array.from(selectedIds))}>
              Auto Keywords
            </Button>
          </div>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Settings2 className="mr-2 h-4 w-4" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_DEFINITIONS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key]}
                  disabled={!column.hideable}
                  onCheckedChange={(checked) => setColumnVisible(column.key, Boolean(checked))}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Table className="table-fixed">
        <colgroup>
          <col style={{ width: 48 }} />
          {visibleColumns.map((column) => (
            <col key={column.key} style={{ width: columnWidths[column.key] }} />
          ))}
          <col style={{ width: 56 }} />
        </colgroup>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12">
              <Checkbox
                checked={selectedIds.size === documents.length && documents.length > 0}
                onCheckedChange={toggleAll}
              />
            </TableHead>
            {columnVisibility.favorite && <TableHead className="relative">Favorite{renderResizeHandle('favorite')}</TableHead>}
            {columnVisibility.title && <TableHead className="relative">Title{renderResizeHandle('title')}</TableHead>}
            {columnVisibility.authors && <TableHead className="relative">Authors{renderResizeHandle('authors')}</TableHead>}
            {columnVisibility.year && <TableHead className="relative text-center">Year{renderResizeHandle('year')}</TableHead>}
            {columnVisibility.status && <TableHead className="relative">Status{renderResizeHandle('status')}</TableHead>}
            {columnVisibility.annotations && <TableHead className="relative text-center">Annotations{renderResizeHandle('annotations')}</TableHead>}
            {columnVisibility.rating && <TableHead className="relative">Rating{renderResizeHandle('rating')}</TableHead>}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <DocumentContextMenu key={doc.id} document={doc}>
              <TableRow className={cn('group', selectedIds.has(doc.id) && 'bg-muted/50')}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(doc.id)}
                    onCheckedChange={() => toggleSelection(doc.id)}
                  />
                </TableCell>

                {columnVisibility.favorite && (
                  <TableCell>
                    <button
                      onClick={() => toggleFavorite(doc.id)}
                      className={cn(
                        'transition-colors',
                        doc.favorite ? 'text-amber-400' : 'text-muted-foreground/30 hover:text-amber-400',
                      )}
                    >
                      <Star className="h-4 w-4" fill={doc.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </TableCell>
                )}

                {columnVisibility.title && (
                  <TableCell>
                    <Link href={doc.documentType === 'physical_book' ? `/books/notes?id=${doc.id}` : `/reader/view?id=${doc.id}`} className="group/link flex items-start gap-2">
                      {doc.documentType === 'physical_book' ? <BookMarked className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-foreground transition-colors group-hover/link:text-primary">
                          {doc.title}
                        </span>
                        {doc.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {doc.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="secondary" className="py-0 text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {doc.tags.length > 3 && (
                              <Badge variant="secondary" className="py-0 text-xs">
                                +{doc.tags.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  </TableCell>
                )}

                {columnVisibility.authors && (
                  <TableCell>
                    <span className="block truncate text-sm text-muted-foreground">
                      {doc.authors.slice(0, 2).join(', ')}
                      {doc.authors.length > 2 && ' et al.'}
                    </span>
                  </TableCell>
                )}

                {columnVisibility.year && (
                  <TableCell className="text-center">
                    <span className="text-sm">{doc.year || '—'}</span>
                  </TableCell>
                )}

                {columnVisibility.status && (
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ReadingStageBadge stage={doc.readingStage} />
                      {doc.hasOcr && <OcrStatusBadge status={doc.ocrStatus} />}
                      {doc.metadataStatus !== 'verified' && doc.metadataStatus !== 'complete' && (
                        <MetadataStatusBadge status={doc.metadataStatus} />
                      )}
                    </div>
                  </TableCell>
                )}

                {columnVisibility.annotations && (
                  <TableCell className="text-center">
                    {doc.annotationCount > 0 ? (
                      <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {doc.annotationCount}
                      </div>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </TableCell>
                )}

                {columnVisibility.rating && (
                  <TableCell>
                    <StarRating rating={doc.rating} onChange={(rating) => updateDocument(doc.id, { rating })} />
                  </TableCell>
                )}

                <TableCell>
                  <DocumentActions
                    document={doc}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    }
                  />
                </TableCell>
              </TableRow>
            </DocumentContextMenu>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
