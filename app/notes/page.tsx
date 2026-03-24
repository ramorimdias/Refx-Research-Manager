'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useAppStore } from '@/lib/store'
import * as repo from '@/lib/repositories/local-db'

export default function NotesPage() {
  const { notes, loadNotes, isDesktopApp } = useAppStore()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<any>(null)

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (!selected && notes.length > 0) setSelected(notes[0])
  }, [notes, selected])

  const filtered = useMemo(() => notes.filter((n: any) => `${n.title} ${n.content}`.toLowerCase().includes(query.toLowerCase())), [notes, query])

  return (
    <div className="flex h-full">
      <div className="w-80 border-r p-4 space-y-3">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search notes" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button className="w-full" onClick={async () => {
          if (!isDesktopApp) return
          const note = await repo.createNote({ title: 'New note', content: '', documentId: undefined })
          await loadNotes()
          setSelected(note)
        }}><Plus className="h-4 w-4 mr-2" />New Note</Button>
        <div className="space-y-2">
          {filtered.map((n: any) => (
            <button key={n.id} className="w-full text-left border rounded p-2" onClick={() => setSelected(n)}>
              <div className="font-medium text-sm">{n.title}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{n.content}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        {selected ? (
          <div className="space-y-3">
            <Input value={selected.title} onChange={(e) => setSelected({ ...selected, title: e.target.value })} />
            <Textarea className="min-h-80" value={selected.content} onChange={(e) => setSelected({ ...selected, content: e.target.value })} />
            <div>
              <Button disabled>Save updates (scaffold)</Button>
            </div>
          </div>
        ) : (
          <div>Select a note</div>
        )}
      </div>
    </div>
  )
}
