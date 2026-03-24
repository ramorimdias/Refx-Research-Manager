'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { FileText, Clock, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { mockDocuments } from '@/lib/mock-data'

export default function HomePage() {
  const { documents, isDesktopApp } = useAppStore()
  const docs = isDesktopApp ? documents : mockDocuments
  const recent = useMemo(() => [...docs].slice(0, 8), [docs])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground">Local-first research workspace</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader><CardTitle>Total Documents</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{docs.length}</CardContent></Card>
        <Card><CardHeader><CardTitle>Desktop Mode</CardTitle></CardHeader><CardContent className="text-lg">{isDesktopApp ? 'Enabled' : 'Web preview'}</CardContent></Card>
        <Card><CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader><CardContent><Button asChild size="sm"><Link href="/libraries">Open Library <ArrowRight className="h-4 w-4 ml-2" /></Link></Button></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4" />Recent Documents</CardTitle>
          <Button variant="ghost" size="sm" asChild><Link href="/libraries">View all</Link></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((doc: any) => (
            <Link key={doc.id} href={`/documents?id=${doc.id}`} className="block border rounded p-3 hover:bg-muted/30">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="font-medium">{doc.title}</span></div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
