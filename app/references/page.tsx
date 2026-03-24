'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Search,
  Plus,
  Upload,
  Download,
  Copy,
  FileText,
  ExternalLink,
  MoreHorizontal,
  Edit,
  Trash2,
  Check,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { mockReferences, mockDocuments } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

const citationStyles = [
  { value: 'apa7', label: 'APA 7th Edition' },
  { value: 'mla9', label: 'MLA 9th Edition' },
  { value: 'chicago', label: 'Chicago' },
  { value: 'harvard', label: 'Harvard' },
  { value: 'ieee', label: 'IEEE' },
  { value: 'vancouver', label: 'Vancouver' },
]

export default function ReferencesPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [citationStyle, setCitationStyle] = useState('apa7')
  const [selectedRef, setSelectedRef] = useState<typeof mockReferences[0] | null>(null)

  // Generate references from documents that don't have explicit references
  const allReferences = mockDocuments.map((doc) => {
    const existingRef = mockReferences.find((r) => r.documentId === doc.id)
    if (existingRef) return existingRef
    
    return {
      id: `ref-auto-${doc.id}`,
      documentId: doc.id,
      rawBibtex: `@article{${doc.citationKey},
  title={${doc.title}},
  author={${doc.authors.join(' and ')}},
  year={${doc.year || ''}},
  journal={${doc.venue || ''}},
  doi={${doc.doi || ''}}
}`,
      itemType: 'article' as const,
      fields: {
        title: doc.title,
        author: doc.authors.join(' and '),
        year: String(doc.year || ''),
        journal: doc.venue || '',
        doi: doc.doi || '',
      },
      doi: doc.doi,
      citationKey: doc.citationKey,
      source: 'auto',
      metadataConfidence: doc.metadataStatus === 'verified' ? 0.95 : 0.7,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  })

  const filteredReferences = allReferences.filter(
    (ref) =>
      ref.fields.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.fields.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ref.citationKey.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCitation = (ref: typeof allReferences[0], style: string) => {
    const { fields } = ref
    const authors = fields.author?.split(' and ') || []
    const firstAuthor = authors[0]?.split(',')[0] || 'Unknown'
    
    switch (style) {
      case 'apa7':
        return `${firstAuthor}${authors.length > 1 ? ' et al.' : ''} (${fields.year}). ${fields.title}. ${fields.journal}.${fields.doi ? ` https://doi.org/${fields.doi}` : ''}`
      case 'mla9':
        return `${firstAuthor}${authors.length > 1 ? ', et al.' : ''}. "${fields.title}." ${fields.journal}, ${fields.year}.`
      case 'chicago':
        return `${firstAuthor}${authors.length > 1 ? ' et al.' : ''}. "${fields.title}." ${fields.journal} (${fields.year}).`
      case 'ieee':
        return `${firstAuthor}${authors.length > 1 ? ' et al.' : ''}, "${fields.title}," ${fields.journal}, ${fields.year}.`
      default:
        return `${firstAuthor} (${fields.year}). ${fields.title}. ${fields.journal}.`
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <div>
          <h1 className="text-xl font-semibold">References</h1>
          <p className="text-sm text-muted-foreground">
            Manage citations and export bibliographies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Import BibTeX
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Reference List */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-4 border-b border-border p-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search references..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={citationStyle} onValueChange={setCitationStyle}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {citationStyles.map((style) => (
                  <SelectItem key={style.value} value={style.value}>
                    {style.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Type</TableHead>
                  <TableHead>Citation Key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Authors</TableHead>
                  <TableHead className="w-16">Year</TableHead>
                  <TableHead className="w-24">Confidence</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReferences.map((ref) => {
                  const doc = mockDocuments.find((d) => d.id === ref.documentId)
                  return (
                    <TableRow
                      key={ref.id}
                      className={cn(
                        'cursor-pointer',
                        selectedRef?.id === ref.id && 'bg-muted'
                      )}
                      onClick={() => setSelectedRef(ref)}
                    >
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {ref.itemType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {ref.citationKey}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {doc && (
                            <Link
                              href={`/documents?id=${doc.id}`}
                              className="shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <FileText className="h-4 w-4 text-muted-foreground hover:text-primary" />
                            </Link>
                          )}
                          <span className="truncate">{ref.fields.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate block max-w-48">
                          {ref.fields.author?.split(' and ').slice(0, 2).join(', ')}
                          {(ref.fields.author?.split(' and ').length || 0) > 2 && ' et al.'}
                        </span>
                      </TableCell>
                      <TableCell>{ref.fields.year || '—'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {ref.metadataConfidence >= 0.9 ? (
                            <Check className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                          )}
                          <span className="text-xs">
                            {Math.round(ref.metadataConfidence * 100)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Citation
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy BibTeX
                            </DropdownMenuItem>
                            {ref.doi && (
                              <DropdownMenuItem>
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Lookup DOI
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        {/* Preview Panel */}
        {selectedRef && (
          <div className="w-96 shrink-0 border-l border-border overflow-auto">
            <div className="p-4 border-b border-border">
              <h2 className="font-semibold">Reference Details</h2>
            </div>
            <div className="p-4 space-y-6">
              {/* Formatted Citation */}
              <div>
                <Label className="text-muted-foreground mb-2 block">
                  Formatted Citation ({citationStyles.find((s) => s.value === citationStyle)?.label})
                </Label>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-sm leading-relaxed">
                      {formatCitation(selectedRef, citationStyle)}
                    </p>
                  </CardContent>
                </Card>
                <Button variant="outline" size="sm" className="mt-2">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </Button>
              </div>

              {/* BibTeX */}
              <div>
                <Label className="text-muted-foreground mb-2 block">BibTeX</Label>
                <Card>
                  <CardContent className="p-3">
                    <pre className="text-xs overflow-auto whitespace-pre-wrap">
                      {selectedRef.rawBibtex}
                    </pre>
                  </CardContent>
                </Card>
                <Button variant="outline" size="sm" className="mt-2">
                  <Copy className="mr-2 h-4 w-4" />
                  Copy BibTeX
                </Button>
              </div>

              {/* Metadata Fields */}
              <div>
                <Label className="text-muted-foreground mb-2 block">Metadata</Label>
                <div className="space-y-2">
                  {Object.entries(selectedRef.fields).map(([key, value]) => (
                    value && (
                      <div key={key} className="grid grid-cols-3 gap-2 text-sm">
                        <span className="text-muted-foreground capitalize">{key}</span>
                        <span className="col-span-2 truncate">{value}</span>
                      </div>
                    )
                  ))}
                </div>
              </div>

              {/* DOI Link */}
              {selectedRef.doi && (
                <div>
                  <a
                    href={`https://doi.org/${selectedRef.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open DOI: {selectedRef.doi}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
