'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import * as repo from '@/lib/repositories/local-db'
import { isTauri } from '@/lib/tauri/client'
import { mockDocuments } from '@/lib/mock-data'

export default function DocumentDetailByQueryPage() {
  const params = useSearchParams()
  const id = params.get('id')
  const [doc, setDoc] = useState<any>(null)

  useEffect(() => {
    if (!id) return
    if (!isTauri()) {
      setDoc(mockDocuments.find((d) => d.id === id) ?? null)
      return
    }
    repo.getDocumentById(id).then(setDoc)
  }, [id])

  if (!id) return <div className="p-6">Missing document id.</div>
  if (!doc) return <div className="p-6">Loading document...</div>

  return (
    <div className="p-6 space-y-4">
      <Button asChild variant="outline" size="sm">
        <Link href="/libraries"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
      </Button>
      <h1 className="text-2xl font-semibold">{doc.title}</h1>
      <p className="text-sm text-muted-foreground">{doc.authors || '[]'}</p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href={`/reader/view?id=${doc.id}`}><BookOpen className="mr-2 h-4 w-4" />Open Reader</Link>
        </Button>
      </div>
      {doc.abstractText && <p className="text-sm leading-relaxed">{doc.abstractText}</p>}
    </div>
  )
}
