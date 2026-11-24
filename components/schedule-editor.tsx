'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/components/toast'
import { deleteBlock, saveBlock } from '@/lib/actions'
import { blocksForWeekday, flexItems, type Block } from '@/lib/schedule'
import { fmtClock } from '@/lib/time'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SUBJECTS = ['DSA', 'SQL', 'Aptitude', 'AWS', 'ML', 'Web Dev', 'Projects', 'Contest', 'Explore', 'Other']
const KINDS = ['study', 'habit', 'meal', 'chore', 'break', 'flex'] as const
type Draft = { id?: string; title: string; subject: string; start_time: string; end_time: string; days: number[]; kind: (typeof KINDS)[number]; is_study: boolean }

export function ScheduleEditor({ initial, format, todayDow }: { initial: Block[]; format: '12h' | '24h'; todayDow: number }) {
  const router = useRouter()
  const [dow, setDow] = useState(todayDow)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const list = blocksForWeekday(initial, dow)

  async function save() {
    if (!draft) return
    setBusy(true)
    try { await saveBlock(draft); setDraft(null); router.refresh() } catch (e) { toast((e as Error).message) }
    setBusy(false)
  }
  async function remove(b: Block) {
    if (!confirm(`Delete "${b.title}" from every day it appears on?`)) return
    try { await deleteBlock(b.id); router.refresh() } catch (e) { toast((e as Error).message) }
  }
  const edit = (b: Block): Draft => ({ id: b.id, title: b.title, subject: b.subject, start_time: b.start_time, end_time: b.end_time, days: b.days, kind: b.kind as Draft['kind'], is_study: b.is_study })

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3">
        <div><h1 className="h1">Schedule</h1><p className="sub">Your timetable. Changes apply to Today straight away.</p></div>
        <button className="btn btn-primary" onClick={() => setDraft({ title: '', subject: 'Other', start_time: '09:00', end_time: '10:00', days: [dow], kind: 'study', is_study: true })}><Plus size={14} />Add block</button>
      </header>
      <div className="flex gap-1.5 overflow-x-auto" role="tablist">
        {[1, 2, 3, 4, 5, 6, 0].map((d) => (
          <button key={d} role="tab" aria-selected={dow === d} onClick={() => setDow(d)} className={`btn ${dow === d ? 'btn-primary' : ''}`}>{DAYS[d]}</button>
        ))}
      </div>

      {draft && (
        <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); save() }}>
          <input className="input" placeholder="Title" aria-label="Title" required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-sm">Start<input className="input mt-1" type="time" value={draft.start_time} onChange={(e) => setDraft({ ...draft, start_time: e.target.value })} /></label>
            <label className="text-sm">End<input className="input mt-1" type="time" value={draft.end_time} onChange={(e) => setDraft({ ...draft, end_time: e.target.value })} /></label>
            <label className="text-sm">Subject<select className="input mt-1" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="text-sm">Kind<select className="input mt-1" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft['kind'], is_study: e.target.value === 'study' || e.target.value === 'flex' })}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days">
            {DAYS.map((n, d) => (
              <button type="button" key={d} aria-pressed={draft.days.includes(d)} className={`btn !px-2.5 !py-1 ${draft.days.includes(d) ? 'btn-primary' : ''}`}
                onClick={() => setDraft({ ...draft, days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}>{n}</button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_study} onChange={(e) => setDraft({ ...draft, is_study: e.target.checked })} />Counts as study time (logs minutes)</label>
          <div className="flex gap-2"><button className="btn btn-primary" disabled={busy}>Save</button><button type="button" className="btn" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}

      {list.length === 0 ? <div className="card p-8 text-center sub">No blocks on {DAYS[dow]}. Add one to get started.</div> : (
        <ul className="card divide-y">
          {list.map((b) => (
            <li key={b.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-28 shrink-0 text-sm tabular-nums text-muted">{fmtClock(b.start_time, format)}<br />{fmtClock(b.end_time, format)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{b.title}</p>
                <p className="sub text-xs">{b.subject} · {b.kind}{b.kind === 'flex' && flexItems(b, dow).length ? ` · ${flexItems(b, dow).map((f) => f.title).join(' + ')}` : ''}</p>
              </div>
              <button className="btn !px-2" aria-label={`Edit ${b.title}`} onClick={() => setDraft(edit(b))}><Pencil size={14} /></button>
              <button className="btn !px-2" aria-label={`Delete ${b.title}`} onClick={() => remove(b)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
