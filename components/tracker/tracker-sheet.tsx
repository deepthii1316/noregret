'use client'
import { useMemo, useRef, useState } from 'react'
import { ChevronDown, Download, GripVertical, Plus, Search, Trash2, Upload } from 'lucide-react'
import { toast } from '@/components/toast'
import { addGroup, addItem, deleteGroup, importItems } from '@/lib/actions'
import { reorderTrackerGroups, reorderTrackerItems } from '@/lib/feature-actions'
import { csvToItemRows, toCsv } from '@/lib/csv'
import type { Group, Item } from '@/lib/data'
import { isDone } from '@/lib/data'
import { ItemRow } from './item-row'
import { useItemActions } from './use-items'

type Filter = 'all' | 'todo' | 'done' | 'revision'

export function TrackerSheet({ tracker, initialGroups, initialItems, today }: { tracker: { id: string; key: string; name: string }; initialGroups: Group[]; initialItems: Item[]; today: string }) {
  const [groups, setGroups] = useState(initialGroups)
  const [items, setItems] = useState(initialItems)
  const [filter, setFilter] = useState<Filter>('all')
  const [diff, setDiff] = useState('')
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<Record<string, string>>({})
  const [newGroup, setNewGroup] = useState('')
  const draggedItem = useRef<string | null>(null)
  const draggedGroup = useRef<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const actions = useItemActions(setItems, today)

  const total = items.length, done = items.filter(isDone).length
  const visible = (i: Item) =>
    (filter === 'all' || (filter === 'todo' && !isDone(i)) || (filter === 'done' && isDone(i)) || (filter === 'revision' && i.needs_revision)) &&
    (!diff || i.difficulty === diff) && (!q || i.title.toLowerCase().includes(q.toLowerCase()))
  const byGroup = useMemo(() => { const m = new Map<string, Item[]>(); items.forEach((i) => m.set(i.group_id, [...(m.get(i.group_id) ?? []), i])); return m }, [items])

  async function moveItem(groupId: string, targetId: string) {
    const sourceId = draggedItem.current
    draggedItem.current = null
    if (!sourceId || sourceId === targetId) return
    const before = items
    const ordered = [...(byGroup.get(groupId) ?? [])]
    const from = ordered.findIndex((item) => item.id === sourceId)
    const to = ordered.findIndex((item) => item.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = ordered.splice(from, 1)
    ordered.splice(to, 0, item)
    const groupItems = new Map(ordered.map((value, index) => [value.id, index]))
    setItems((current) => current.map((value) => groupItems.has(value.id) ? { ...value, sort_order: groupItems.get(value.id)! } : value)
      .sort((a, b) => a.group_id === b.group_id ? a.sort_order - b.sort_order : a.group_id.localeCompare(b.group_id)))
    try { await reorderTrackerItems({ groupId, itemIds: ordered.map((value) => value.id) }) }
    catch (error) { setItems(before); toast(`Reorder failed: ${(error as Error).message}`) }
  }

  async function moveGroup(targetId: string) {
    const sourceId = draggedGroup.current
    draggedGroup.current = null
    if (!sourceId || sourceId === targetId) return
    const before = groups
    const ordered = [...groups]
    const from = ordered.findIndex((group) => group.id === sourceId)
    const to = ordered.findIndex((group) => group.id === targetId)
    if (from < 0 || to < 0) return
    const [group] = ordered.splice(from, 1)
    ordered.splice(to, 0, group)
    setGroups(ordered.map((value, index) => ({ ...value, sort_order: index })))
    try { await reorderTrackerGroups({ trackerId: tracker.id, groupIds: ordered.map((value) => value.id) }) }
    catch (error) { setGroups(before); toast(`Reorder failed: ${(error as Error).message}`) }
  }

  async function add(g: Group) {
    const title = (adding[g.id] ?? '').trim(); if (!title) return
    setAdding((a) => ({ ...a, [g.id]: '' }))
    try { const it = (await addItem({ groupId: g.id, trackerId: tracker.id, title })) as Item; setItems((p) => [...p, it]) } catch (e) { toast(`Add failed: ${(e as Error).message}`) }
  }
  async function exportCsv() {
    const rows = [['group', 'title', 'difficulty', 'platform', 'link', 'notes', 'status']]
    groups.forEach((g) => (byGroup.get(g.id) ?? []).forEach((i) => rows.push([g.name, i.title, i.difficulty ?? '', i.platform ?? '', i.link ?? '', i.notes ?? '', i.status])))
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' })), download: `${tracker.key}.csv` })
    a.click(); URL.revokeObjectURL(a.href)
  }
  async function onImport(f: File) {
    try {
      const rows = csvToItemRows(await f.text())
      if (!rows.length) return toast('No rows found. Columns: group, title, difficulty, platform, link, notes')
      if (!confirm(`Import ${rows.length} rows? Duplicates (same group + title) are skipped.`)) return
      const r = await importItems({ trackerId: tracker.id, rows })
      toast(`Imported ${r.added}, skipped ${r.skipped} duplicates. Reloading…`)
      setTimeout(() => location.reload(), 800)
    } catch (e) { toast(`Import failed: ${(e as Error).message}`) }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">{tracker.name}</h1><p className="sub">{done} of {total} done</p></div>
        <div className="flex gap-2">
          <button className="btn" onClick={exportCsv}><Download size={14} />Export</button>
          <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={14} />Import</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </header>
      <div className="bar"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1"><Search size={14} className="absolute left-3 top-2.5 text-muted" /><input className="input !pl-8" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input !w-auto" aria-label="Status filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
          <option value="all">All</option><option value="todo">Not done</option><option value="done">Done</option><option value="revision">Needs revision</option>
        </select>
        <select className="input !w-auto" aria-label="Difficulty filter" value={diff} onChange={(e) => setDiff(e.target.value)}>
          <option value="">Any difficulty</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
        </select>
      </div>

      {groups.length === 0 && <div className="card p-8 text-center sub">No groups yet. Add one below, or import a CSV.</div>}
      {groups.map((g) => {
        const all = byGroup.get(g.id) ?? [], shown = all.filter(visible), gd = all.filter(isDone).length
        if ((q || filter !== 'all' || diff) && shown.length === 0) return null
        const open = !closed.has(g.id)
        return (
          <section key={g.id} className="card" onDragOver={(event) => { if (draggedGroup.current) event.preventDefault() }} onDrop={() => moveGroup(g.id)}>
            <div className="flex items-center gap-3 p-4">
              <button type="button" className="btn !px-2" aria-label={`Reorder group ${g.name}`} draggable onDragStart={(event) => { draggedGroup.current = g.id; event.dataTransfer.effectAllowed = 'move' }} onDragEnd={() => { draggedGroup.current = null }}><GripVertical size={14} /></button>
              <button className="flex flex-1 items-center gap-3 text-left" aria-expanded={open} onClick={() => setClosed((c) => { const n = new Set(c); n.has(g.id) ? n.delete(g.id) : n.add(g.id); return n })}>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
                <span className="font-medium">{g.name}</span>
                <span className="sub ml-auto tabular-nums">{gd}/{all.length}</span>
              </button>
              <div className="bar !w-24 hidden sm:block"><span style={{ width: `${all.length ? (gd / all.length) * 100 : 0}%` }} /></div>
              <button className="btn !px-2" aria-label={`Delete group ${g.name}`} onClick={async () => { if (confirm(`Delete "${g.name}" and its ${all.length} items?`)) { try { await deleteGroup(g.id); setGroups((p) => p.filter((x) => x.id !== g.id)); setItems((p) => p.filter((i) => i.group_id !== g.id)) } catch (e) { toast((e as Error).message) } } }}><Trash2 size={14} /></button>
            </div>
            {open && (
              <div className="divide-y border-t px-4">
                {shown.map((i) => (
                  <div key={i.id} draggable onDragStart={(event) => { draggedItem.current = i.id; event.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { draggedItem.current = null }} onDragOver={(event) => { if (draggedItem.current) event.preventDefault() }}
                    onDrop={(event) => { event.preventDefault(); void moveItem(g.id, i.id) }}>
                    <ItemRow item={i} actions={actions} deletable />
                  </div>
                ))}
                <form className="flex gap-2 py-3" onSubmit={(e) => { e.preventDefault(); add(g) }}>
                  <input className="input" placeholder="Add an item" aria-label={`Add item to ${g.name}`} value={adding[g.id] ?? ''} onChange={(e) => setAdding((a) => ({ ...a, [g.id]: e.target.value }))} />
                  <button className="btn"><Plus size={14} />Add</button>
                </form>
              </div>
            )}
          </section>
        )
      })}

      <form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!newGroup.trim()) return; try { const g = (await addGroup({ trackerId: tracker.id, name: newGroup.trim() })) as Group; setGroups((p) => [...p, g]); setNewGroup('') } catch (err) { toast((err as Error).message) } }}>
        <input className="input" placeholder="New group" aria-label="New group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <button className="btn btn-primary"><Plus size={14} />Add group</button>
      </form>
    </div>
  )
}
