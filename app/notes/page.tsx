'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Pin,
  MoreHorizontal,
  FileText,
  Trash2,
  Edit,
  Calendar,
  Tag,
  Link2,
  PanelRightClose,
  PanelRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { mockNotes, mockDocuments } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function NotesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(mockNotes[0]?.id || null)
  const [showPreview, setShowPreview] = useState(true)

  const filteredNotes = mockNotes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const pinnedNotes = filteredNotes.filter((note) => note.pinned)
  const regularNotes = filteredNotes.filter((note) => !note.pinned)

  const selectedNote = mockNotes.find((n) => n.id === selectedNoteId)

  const getLinkedDocuments = (documentIds: string[]) => {
    return documentIds.map((id) => mockDocuments.find((d) => d.id === id)).filter(Boolean)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h1 className="text-xl font-semibold">Notes</h1>
          <p className="text-sm text-muted-foreground">
            Research notes, ideas, and document excerpts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowPreview(!showPreview)}>
            {showPreview ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRight className="h-4 w-4" />
            )}
          </Button>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Note
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Notes List */}
        <div className="w-80 shrink-0 border-r border-border flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search notes..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <ScrollArea className="flex-1">
            <div className="p-2">
              {/* Pinned Notes */}
              {pinnedNotes.length > 0 && (
                <div className="mb-4">
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </div>
                  <div className="space-y-1">
                    {pinnedNotes.map((note) => (
                      <button
                        key={note.id}
                        onClick={() => setSelectedNoteId(note.id)}
                        className={cn(
                          'w-full text-left rounded-lg p-3 transition-colors',
                          selectedNoteId === note.id
                            ? 'bg-primary/10 border border-primary/20'
                            : 'hover:bg-muted'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-medium text-sm line-clamp-1">{note.title}</h3>
                          <Pin className="h-3 w-3 shrink-0 text-primary" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {note.content.replace(/[#*`]/g, '').slice(0, 100)}
                        </p>
                        {note.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {note.tags.slice(0, 2).map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs py-0">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Regular Notes */}
              <div>
                {pinnedNotes.length > 0 && regularNotes.length > 0 && (
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    All Notes
                  </div>
                )}
                <div className="space-y-1">
                  {regularNotes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => setSelectedNoteId(note.id)}
                      className={cn(
                        'w-full text-left rounded-lg p-3 transition-colors',
                        selectedNoteId === note.id
                          ? 'bg-primary/10 border border-primary/20'
                          : 'hover:bg-muted'
                      )}
                    >
                      <h3 className="font-medium text-sm line-clamp-1">{note.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {note.content.replace(/[#*`]/g, '').slice(0, 100)}
                      </p>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {note.updatedAt.toLocaleDateString()}
                        {note.linkedDocumentIds.length > 0 && (
                          <>
                            <span>•</span>
                            <Link2 className="h-3 w-3" />
                            {note.linkedDocumentIds.length}
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {filteredNotes.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No notes found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Note Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedNote ? (
            <>
              {/* Note Header */}
              <div className="flex items-center justify-between border-b border-border p-4">
                <div className="flex-1 min-w-0">
                  <Input
                    value={selectedNote.title}
                    className="text-lg font-semibold border-none px-0 focus-visible:ring-0"
                    placeholder="Note title..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Pin className={cn('h-4 w-4', selectedNote.pinned && 'text-primary')} />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Link2 className="mr-2 h-4 w-4" />
                        Link to Document
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Note Content */}
              <div className="flex-1 overflow-auto p-4">
                <Textarea
                  value={selectedNote.content}
                  className="min-h-full resize-none border-none focus-visible:ring-0 text-sm leading-relaxed"
                  placeholder="Start writing..."
                />
              </div>

              {/* Note Footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-2">
                <div className="flex items-center gap-2">
                  {selectedNote.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="ghost" size="sm" className="text-xs">
                    + Add tag
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  Last edited {selectedNote.updatedAt.toLocaleDateString()}
                </span>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="font-medium mb-2">No note selected</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Select a note from the list or create a new one
                </p>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Note
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Linked Documents Panel */}
        {showPreview && selectedNote && selectedNote.linkedDocumentIds.length > 0 && (
          <div className="w-72 shrink-0 border-l border-border overflow-auto">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-sm">Linked Documents</h3>
            </div>
            <div className="p-4 space-y-3">
              {getLinkedDocuments(selectedNote.linkedDocumentIds).map((doc) => (
                doc && (
                  <Link key={doc.id} href={`/documents/${doc.id}`}>
                    <Card className="hover:border-primary/50 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          <div className="min-w-0">
                            <h4 className="text-sm font-medium line-clamp-2">{doc.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {doc.authors[0]}
                              {doc.authors.length > 1 && ' et al.'}
                              {doc.year && ` (${doc.year})`}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
