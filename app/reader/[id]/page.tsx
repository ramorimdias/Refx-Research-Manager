'use client'

import { use, useState } from 'react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Search,
  Highlighter,
  MessageSquare,
  Bookmark,
  Copy,
  List,
  FileText,
  Layers,
  MoreHorizontal,
  PanelRightClose,
  PanelRight,
  BookOpen,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { mockDocuments, mockAnnotations } from '@/lib/mock-data'
import { useAppStore, useDocumentAnnotations } from '@/lib/store'
import { StarRating, ReadingStageBadge } from '@/components/refx/common'
import type { AnnotationType } from '@/lib/types'

const highlightColors = [
  { name: 'Yellow', value: '#FBBF24' },
  { name: 'Green', value: '#34D399' },
  { name: 'Blue', value: '#60A5FA' },
  { name: 'Pink', value: '#F472B6' },
  { name: 'Orange', value: '#FB923C' },
]

export default function ReaderPage({
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
  const {
    currentPage,
    setCurrentPage,
    zoom,
    setZoom,
    annotationMode,
    setAnnotationMode,
    rightPanelOpen,
    toggleRightPanel,
  } = useAppStore()

  const [showThumbnails, setShowThumbnails] = useState(true)
  const [showSearch, setShowSearch] = useState(false)
  const [selectedColor, setSelectedColor] = useState(highlightColors[0].value)
  const [searchQuery, setSearchQuery] = useState('')

  const pageCount = document.pageCount || 15

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= pageCount) {
      setCurrentPage(page)
    }
  }

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-muted/30">
        {/* Reader Toolbar */}
        <div className="flex h-12 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={`/documents/${document.id}`}>
                    <ArrowLeft className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Back to document</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6" />

            <div className="flex items-center gap-1">
              <h2 className="text-sm font-medium truncate max-w-xs">
                {document.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Page Navigation */}
            <div className="flex items-center gap-1 mr-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-1 text-sm">
                <Input
                  type="number"
                  value={currentPage}
                  onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
                  className="h-8 w-14 text-center"
                  min={1}
                  max={pageCount}
                />
                <span className="text-muted-foreground">/ {pageCount}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= pageCount}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 mx-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.max(50, zoom - 25))}
                  >
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom out</TooltipContent>
              </Tooltip>
              <span className="text-sm w-12 text-center">{zoom}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setZoom(Math.min(200, zoom + 25))}
                  >
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom in</TooltipContent>
              </Tooltip>
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* Annotation Tools */}
            <div className="flex items-center gap-1 mx-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={annotationMode === 'highlight'}
                    onPressedChange={(pressed) =>
                      setAnnotationMode(pressed ? 'highlight' : null)
                    }
                    className="h-8 w-8"
                  >
                    <Highlighter className="h-4 w-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Highlight text</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={annotationMode === 'note'}
                    onPressedChange={(pressed) =>
                      setAnnotationMode(pressed ? 'note' : null)
                    }
                    className="h-8 w-8"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Add note</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Toggle
                    pressed={annotationMode === 'bookmark'}
                    onPressedChange={(pressed) =>
                      setAnnotationMode(pressed ? 'bookmark' : null)
                    }
                    className="h-8 w-8"
                  >
                    <Bookmark className="h-4 w-4" />
                  </Toggle>
                </TooltipTrigger>
                <TooltipContent>Bookmark page</TooltipContent>
              </Tooltip>

              {/* Color Selector (when highlight mode active) */}
              {annotationMode === 'highlight' && (
                <div className="flex items-center gap-0.5 ml-1">
                  {highlightColors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={cn(
                        'h-5 w-5 rounded-full border-2 transition-all',
                        selectedColor === color.value
                          ? 'border-foreground scale-110'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              )}
            </div>

            <Separator orientation="vertical" className="h-6" />

            {/* View Options */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowSearch(!showSearch)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Search in document</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowThumbnails(!showThumbnails)}
                >
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle thumbnails</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" onClick={toggleRightPanel}>
                  {rightPanelOpen ? (
                    <PanelRightClose className="h-4 w-4" />
                  ) : (
                    <PanelRight className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle sidebar</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Copy className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy citation</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Export annotations</DropdownMenuItem>
                <DropdownMenuItem>Print document</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Reading preferences</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search in document..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 flex-1 max-w-md"
            />
            <span className="text-sm text-muted-foreground">0 results</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSearch(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Main Reader Area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail Strip */}
          {showThumbnails && (
            <div className="w-24 shrink-0 border-r border-border bg-background">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-2">
                  {Array.from({ length: Math.min(pageCount, 20) }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          'w-full aspect-[3/4] rounded border bg-muted/50 flex items-center justify-center text-xs transition-all hover:border-primary',
                          currentPage === page && 'ring-2 ring-primary border-primary'
                        )}
                      >
                        <span className="text-muted-foreground">{page}</span>
                      </button>
                    )
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* PDF Canvas */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-8 bg-muted/50">
            <div
              className="bg-background shadow-lg rounded-sm relative"
              style={{
                width: `${(595 * zoom) / 100}px`,
                height: `${(842 * zoom) / 100}px`,
              }}
            >
              {/* PDF Page Placeholder */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <FileText className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-2">{document.title}</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Page {currentPage} of {pageCount}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  PDF rendering placeholder. In production, this would display the actual PDF
                  using PDF.js or React PDF.
                </p>

                {/* Simulated content based on page */}
                {currentPage === 1 && document.abstract && (
                  <div className="mt-8 text-left max-w-md">
                    <h4 className="font-semibold mb-2">Abstract</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {document.abstract}
                    </p>
                  </div>
                )}
              </div>

              {/* Annotation indicator */}
              {annotationMode && (
                <div className="absolute top-2 right-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
                  {annotationMode === 'highlight' && 'Select text to highlight'}
                  {annotationMode === 'note' && 'Click to add note'}
                  {annotationMode === 'bookmark' && 'Click to bookmark'}
                </div>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          {rightPanelOpen && (
            <div className="w-80 shrink-0 border-l border-border bg-background">
              <Tabs defaultValue="annotations" className="h-full flex flex-col">
                <TabsList className="w-full justify-start rounded-none border-b border-border h-auto p-0 bg-transparent">
                  <TabsTrigger
                    value="annotations"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    Annotations
                  </TabsTrigger>
                  <TabsTrigger
                    value="notes"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    Notes
                  </TabsTrigger>
                  <TabsTrigger
                    value="metadata"
                    className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
                  >
                    Info
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="annotations" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-3">
                      {annotations.length === 0 ? (
                        <div className="text-center py-8">
                          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                          <p className="text-sm text-muted-foreground">No annotations yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Use the highlight or note tools to add annotations
                          </p>
                        </div>
                      ) : (
                        annotations.map((ann) => (
                          <button
                            key={ann.id}
                            onClick={() => setCurrentPage(ann.page)}
                            className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {ann.type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Page {ann.page}
                              </span>
                            </div>
                            {ann.textQuote && (
                              <p
                                className="text-sm border-l-2 pl-2 line-clamp-2"
                                style={{ borderColor: ann.color }}
                              >
                                {ann.textQuote}
                              </p>
                            )}
                            {ann.comment && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {ann.comment}
                              </p>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="notes" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <div className="text-center py-8">
                        <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No linked notes</p>
                        <Button variant="outline" size="sm" className="mt-3">
                          Create Note
                        </Button>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="metadata" className="flex-1 m-0 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-4">
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Title
                        </h4>
                        <p className="text-sm">{document.title}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Authors
                        </h4>
                        <p className="text-sm">{document.authors.join(', ')}</p>
                      </div>
                      {document.year && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">
                            Year
                          </h4>
                          <p className="text-sm">{document.year}</p>
                        </div>
                      )}
                      {document.venue && (
                        <div>
                          <h4 className="text-xs font-medium text-muted-foreground mb-1">
                            Venue
                          </h4>
                          <p className="text-sm">{document.venue}</p>
                        </div>
                      )}
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Status
                        </h4>
                        <ReadingStageBadge stage={document.readingStage} />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Rating
                        </h4>
                        <StarRating rating={document.rating} readonly />
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-muted-foreground mb-1">
                          Tags
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {document.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}
