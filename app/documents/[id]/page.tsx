'use client'

import { use } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Copy,
  Star,
  FileText,
  Calendar,
  User,
  Building,
  Link2,
  Hash,
  MessageSquare,
  StickyNote,
  Clock,
  MoreHorizontal,
  Download,
  Trash2,
  Edit,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ReadingStageBadge,
  MetadataStatusBadge,
  OcrStatusBadge,
  StarRating,
  TagChip,
} from '@/components/refx/common'
import { mockDocuments, mockAnnotations, mockReferences, mockNotes } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const document = mockDocuments.find((d) => d.id === id)

  if (!document) {
    notFound()
  }

  const annotations = mockAnnotations.filter((a) => a.documentId === id)
  const reference = mockReferences.find((r) => r.documentId === id)
  const relatedNotes = mockNotes.filter((n) => n.linkedDocumentIds.includes(id))
  const relatedDocs = mockDocuments.filter(
    (d) => d.id !== id && d.tags.some((t) => document.tags.includes(t))
  ).slice(0, 5)

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/libraries">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold line-clamp-1">{document.title}</h1>
            <p className="text-sm text-muted-foreground">
              {document.authors.slice(0, 3).join(', ')}
              {document.authors.length > 3 && ' et al.'}
              {document.year && ` (${document.year})`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/reader/${document.id}`}>
              <BookOpen className="mr-2 h-4 w-4" />
              Open in Reader
            </Link>
          </Button>
          <Button variant="outline">
            <Copy className="mr-2 h-4 w-4" />
            Copy Citation
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ExternalLink className="mr-2 h-4 w-4" />
                Open DOI
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Document
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Metadata Panel */}
        <div className="w-80 shrink-0 overflow-auto border-r border-border p-6">
          <div className="space-y-6">
            {/* Status */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ReadingStageBadge stage={document.readingStage} />
                <button className="text-amber-400">
                  <Star
                    className="h-5 w-5"
                    fill={document.favorite ? 'currentColor' : 'none'}
                  />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <MetadataStatusBadge status={document.metadataStatus} />
                <OcrStatusBadge status={document.ocrStatus} />
              </div>
            </div>

            <Separator />

            {/* Rating */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Rating</Label>
              <StarRating rating={document.rating} onChange={() => {}} />
            </div>

            <Separator />

            {/* Quick Info */}
            <div className="space-y-3">
              {document.year && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{document.year}</span>
                </div>
              )}
              {document.venue && (
                <div className="flex items-center gap-3 text-sm">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{document.venue}</span>
                </div>
              )}
              {document.doi && (
                <div className="flex items-center gap-3 text-sm">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`https://doi.org/${document.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline truncate"
                  >
                    {document.doi}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <Hash className="h-4 w-4 text-muted-foreground" />
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {document.citationKey}
                </code>
              </div>
              {document.pageCount && (
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>{document.pageCount} pages</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Tags */}
            <div className="space-y-2">
              <Label className="text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {document.tags.map((tag) => (
                  <TagChip key={tag} name={tag} />
                ))}
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                  + Add Tag
                </Button>
              </div>
            </div>

            <Separator />

            {/* Stats */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Annotations</span>
                <span className="font-medium">{document.annotationCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Notes</span>
                <span className="font-medium">{document.notesCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Added</span>
                <span>{document.addedAt.toLocaleDateString()}</span>
              </div>
              {document.lastOpenedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last opened</span>
                  <span>{document.lastOpenedAt.toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="overview" className="h-full">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="annotations">
                Annotations ({annotations.length})
              </TabsTrigger>
              <TabsTrigger value="notes">Notes ({relatedNotes.length})</TabsTrigger>
              <TabsTrigger value="references">References</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6">
              {/* Abstract */}
              {document.abstract && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Abstract</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {document.abstract}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Authors */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Authors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {document.authors.map((author, i) => (
                      <Badge key={i} variant="secondary" className="gap-1.5">
                        <User className="h-3 w-3" />
                        {author}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* AI Features Placeholder */}
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    AI Analysis
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="font-medium mb-2">Key Contributions</h4>
                    <p className="text-sm text-muted-foreground">
                      AI-powered extraction of key contributions will appear here.
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-4">
                    <h4 className="font-medium mb-2">Summary</h4>
                    <p className="text-sm text-muted-foreground">
                      Auto-generated summary will appear here.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="annotations" className="mt-6">
              <div className="space-y-4">
                {annotations.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-medium mb-2">No annotations yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Open this document in the reader to add highlights and notes.
                    </p>
                    <Button asChild>
                      <Link href={`/reader/${document.id}`}>
                        <BookOpen className="mr-2 h-4 w-4" />
                        Open in Reader
                      </Link>
                    </Button>
                  </div>
                ) : (
                  annotations.map((ann) => (
                    <Card key={ann.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="capitalize">
                            {ann.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Page {ann.page}
                          </span>
                        </div>
                        {ann.textQuote && (
                          <p
                            className="text-sm border-l-2 pl-3 italic mb-2"
                            style={{ borderColor: ann.color }}
                          >
                            {ann.textQuote}
                          </p>
                        )}
                        {ann.comment && (
                          <p className="text-sm text-muted-foreground">{ann.comment}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="notes" className="mt-6">
              <div className="space-y-4">
                {relatedNotes.length === 0 ? (
                  <div className="text-center py-12">
                    <StickyNote className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-medium mb-2">No linked notes</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Create a note and link it to this document.
                    </p>
                    <Button asChild>
                      <Link href="/notes">
                        <StickyNote className="mr-2 h-4 w-4" />
                        Go to Notes
                      </Link>
                    </Button>
                  </div>
                ) : (
                  relatedNotes.map((note) => (
                    <Card key={note.id}>
                      <CardContent className="p-4">
                        <h4 className="font-medium mb-2">{note.title}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {note.content}
                        </p>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="references" className="mt-6">
              {reference ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">BibTeX</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-muted rounded-lg p-4 text-xs overflow-auto">
                      {reference.rawBibtex}
                    </pre>
                    <Button variant="outline" size="sm" className="mt-4">
                      <Copy className="mr-2 h-4 w-4" />
                      Copy BibTeX
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="text-center py-12">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="font-medium mb-2">No reference data</h3>
                  <p className="text-sm text-muted-foreground">
                    Reference information will be extracted automatically.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="related" className="mt-6">
              <div className="space-y-4">
                {relatedDocs.length === 0 ? (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
                    <h3 className="font-medium mb-2">No related documents</h3>
                    <p className="text-sm text-muted-foreground">
                      Related documents will appear here based on shared tags and topics.
                    </p>
                  </div>
                ) : (
                  relatedDocs.map((doc) => (
                    <Link key={doc.id} href={`/documents/${doc.id}`}>
                      <Card className="hover:border-primary/50 transition-colors">
                        <CardContent className="flex items-center gap-4 p-4">
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium truncate">{doc.title}</h4>
                            <p className="text-sm text-muted-foreground truncate">
                              {doc.authors[0]}
                              {doc.authors.length > 1 && ' et al.'}
                              {doc.year && ` (${doc.year})`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            {doc.tags
                              .filter((t) => document.tags.includes(t))
                              .slice(0, 2)
                              .map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
