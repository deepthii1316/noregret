'use client'
import { useState } from 'react'
import { ExternalLink, RotateCcw, StickyNote, Trash2, Check } from 'lucide-react'
import type { Item } from '@/lib/data'
import type { ItemActions } from './use-items'

const STATUS_STYLE: Record<Item['status'], string> = {
  todo: 'bg-soft text-muted', doing: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  done: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', mastered: 'bg-primary/15 text-primary',
}
const DIFF_STYLE = { easy: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', medium: 'bg-amber-500/15 text-amber-600 dark:text-amber-400', hard: 'bg-red-500/15 text-red-600 dark:text-red-400' }

export function ItemRow({ item, actions, deletable = false, showRevised = false }: { item: Item; actions: ItemActions; deletable?: boolean; showRevised?: boolean }) {
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState(item.notes ?? '')
  const [saved, setSaved] = useState(false)
  const done = item.status === 'done' || item.status === 'mastered'

  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <select aria-label={`Status of ${item.title}`} value={item.status} onChange={(e) => actions.setStatus(item, e.target.value as Item['status'])}
          className={`chip cursor-pointer appearance-none border-0 py-1 pl-2.5 pr-2.5 ${STATUS_STYLE[item.status]}`}>
          <option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option><option value="mastered">Mastered</option>
        </select>
        <span className={`min-w-0 flex-1 text-sm ${done ? 'text-muted' : ''}`}>{item.title}</span>
        {item.label && !['Medium', 'Hard'].includes(item.label) && <span className="chip bg-soft text-muted">{item.label}</span>}
        {item.difficulty && <span className={`chip ${DIFF_STYLE[item.difficulty]}`}>{item.difficulty}</span>}
        <div className="flex items-center gap-1">
          {showRevised && item.needs_revision && <button className="btn !px-2 !py-1 text-xs" onClick={() => actions.revised(item)}><Check size={13} />Revised</button>}
          <button className={`btn !px-2 !py-1 ${item.needs_revision ? '!border-amber-500 text-amber-600' : ''}`} aria-pressed={item.needs_revision} aria-label="Needs revision" title="Needs revision" onClick={() => actions.toggleRevision(item)}><RotateCcw size={14} /></button>
          <button className={`btn !px-2 !py-1 ${item.notes ? 'text-primary' : ''}`} aria-label="Notes" title="Notes" onClick={() => setOpen((o) => !o)}><StickyNote size={14} /></button>
          {item.link && <a className="btn !px-2 !py-1" href={item.link} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}><ExternalLink size={14} /></a>}
          {deletable && <button className="btn !px-2 !py-1" aria-label="Delete" onClick={() => confirm(`Delete "${item.title}"?`) && actions.remove(item)}><Trash2 size={14} /></button>}
        </div>
      </div>
      {open && (
        <div className="mt-2">
          <textarea className="input min-h-24 font-mono text-xs" placeholder="Notes (markdown). Saves when you click away." value={notes}
            onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
            onBlur={async () => { if (notes !== (item.notes ?? '') && (await actions.saveNotes(item, notes))) setSaved(true) }} />
          <p className="sub h-4 text-xs">{saved ? 'Saved' : ''}</p>
        </div>
      )}
    </div>
  )
}
