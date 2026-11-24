'use client'
import { useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, PartyPopper } from 'lucide-react'
import { toast } from '@/components/toast'
import { ItemRow } from '@/components/tracker/item-row'
import { useItemActions } from '@/components/tracker/use-items'
import { markGroupDone, setRoadmapDay, setRoadmapFamily, updateSettings } from '@/lib/actions'
import { FAMILIES, pace } from '@/lib/roadmap'
import { isDone, type Group, type Item } from '@/lib/data'

type Props = { groups: Group[]; initialItems: Item[]; revise: Item[]; today: string; settings: { currentDay: number; startedOn: string; daysPerWeek: number; phase: 'roadmap' | 'cses' } }

export function RoadmapClient({ groups: initialGroups, initialItems, revise: initialRevise, today, settings }: Props) {
  const [groups, setGroups] = useState(initialGroups)
  const [items, setItems] = useState(initialItems)
  const [revise, setRevise] = useState(initialRevise)
  const [current, setCurrent] = useState(settings.currentDay)
  const [family, setFamily] = useState('')
  const [hideDone, setHideDone] = useState(false)
  const [open, setOpen] = useState<Set<number>>(new Set([settings.currentDay]))
  const actions = useItemActions(setItems, today, setCurrent)
  const reviseActions = useItemActions(setRevise, today)

  const byGroup = useMemo(() => { const m = new Map<string, Item[]>(); items.forEach((i) => m.set(i.group_id, [...(m.get(i.group_id) ?? []), i])); return m }, [items])
  const dayDone = (g: Group) => { const l = byGroup.get(g.id) ?? []; return l.length > 0 && l.every(isDone) }
  const daysCompleted = groups.filter(dayDone).length
  const total = items.length, done = items.filter(isDone).length
  const pc = pace({ daysCompleted, startedOn: settings.startedOn, today, daysPerWeek: settings.daysPerWeek })
  const families = [...new Set(groups.map((g) => g.meta.family as string))]
  const allDone = daysCompleted === groups.length && groups.length > 0

  const diffStats = (['easy', 'medium', 'hard'] as const).map((d) => ({ d, done: items.filter((i) => i.difficulty === d && isDone(i)).length, total: items.filter((i) => i.difficulty === d).length }))
  const paceText = pc.status === 'on_track' ? 'On track' : `${pc.diff} day${pc.diff === 1 ? '' : 's'} ${pc.status}`
  const fmt = (d: string) => new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))

  return (
    <div className="space-y-5">
      <header><h1 className="h1">DSA roadmap</h1><p className="sub">60 days, one day per weekday. Missed days just stay as the current day.</p></header>

      {allDone && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-primary/50 bg-primary/5 p-5">
          <p className="flex items-center gap-2 font-medium"><PartyPopper size={18} className="text-primary" />Roadmap complete. Nicely done.</p>
          {settings.phase === 'roadmap' && <button className="btn btn-primary" onClick={async () => { try { await updateSettings({ dsa_phase: 'cses' }); toast('CSES phase started'); location.reload() } catch (e) { toast((e as Error).message) } }}>Start CSES phase</button>}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="sub">Progress</p><p className="mt-1 text-2xl font-semibold tabular-nums">{done}<span className="text-base font-normal text-muted"> / {total}</span></p><div className="bar mt-2"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div><p className="sub mt-1 text-xs">{daysCompleted} of {groups.length} days complete</p></div>
        <div className="card p-4"><p className="sub">Pace</p><p className={`mt-1 text-2xl font-semibold ${pc.status === 'behind' ? 'text-amber-500' : pc.status === 'ahead' ? 'text-emerald-500' : ''}`}>{paceText}</p><p className="sub mt-1 text-xs">Finish around {fmt(pc.finishDate)} at {settings.daysPerWeek} days a week</p></div>
        <div className="card p-4"><p className="sub">Difficulty (done / total)</p><div className="mt-2 space-y-1.5">{diffStats.map((s) => <div key={s.d} className="flex items-center gap-2 text-xs"><span className="w-14 capitalize">{s.d}</span><div className="bar"><span style={{ width: `${s.total ? (s.done / s.total) * 100 : 0}%` }} /></div><span className="w-12 text-right tabular-nums text-muted">{s.done}/{s.total}</span></div>)}</div></div>
      </section>

      {revise.length > 0 && (
        <section className="card p-5"><h2 className="font-semibold">Revise today</h2><div className="mt-1 divide-y">{revise.map((i) => <ItemRow key={i.id} item={i} actions={reviseActions} showRevised />)}</div></section>
      )}

      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" aria-label="Topic family" value={family} onChange={(e) => setFamily(e.target.value)}>
          <option value="">All topic families</option>{families.map((f) => <option key={f}>{f}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} />Hide finished days</label>
      </div>

      <div className="space-y-3">
        {groups.filter((g) => (!family || g.meta.family === family) && !(hideDone && dayDone(g))).map((g) => {
          const day = g.meta.day_number as number, list = byGroup.get(g.id) ?? [], gd = list.filter(isDone).length
          const isOpen = open.has(day), isCurrent = day === current
          return (
            <section key={g.id} className={`card ${isCurrent ? 'border-primary/60' : ''}`}>
              <button className="flex w-full items-center gap-3 p-4 text-left" aria-expanded={isOpen} onClick={() => setOpen((o) => { const n = new Set(o); n.has(day) ? n.delete(day) : n.add(day); return n })}>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">Day {day}: {g.meta.topic}{isCurrent && <span className="chip bg-primary/15 text-primary">Current</span>}{dayDone(g) && <span className="chip bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Done</span>}</p>
                  <p className="sub truncate text-xs">{g.meta.focus}</p>
                </div>
                <span className="chip bg-soft text-muted hidden sm:inline-flex">{g.meta.family}</span>
                <div className="hidden w-24 sm:block"><div className="bar"><span style={{ width: `${list.length ? (gd / list.length) * 100 : 0}%` }} /></div></div>
                <span className="sub tabular-nums">{gd}/{list.length}</span>
              </button>
              {isOpen && (
                <div className="border-t px-4 pb-4">
                  <div className="divide-y">{list.map((i) => <ItemRow key={i.id} item={i} actions={actions} />)}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {(g.meta.resources ?? []).map((r: { name: string; url: string }) => <a key={r.url} className="btn" href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />{r.name}</a>)}
                    <span className="flex-1" />
                    <select className="input !w-auto text-xs" aria-label="Topic family for this day" value={g.meta.family}
                      onChange={async (e) => { const f = e.target.value; setGroups((p) => p.map((x) => x.id === g.id ? { ...x, meta: { ...x.meta, family: f } } : x)); try { await setRoadmapFamily({ groupId: g.id, family: f }) } catch (err) { toast((err as Error).message) } }}>
                      {[...new Set([...FAMILIES, g.meta.family])].map((f) => <option key={f}>{f}</option>)}
                    </select>
                    {!isCurrent && <button className="btn" onClick={async () => { setCurrent(day); try { await setRoadmapDay(day) } catch (e) { setCurrent(settings.currentDay); toast((e as Error).message) } }}>Make current day</button>}
                    {gd < list.length && <button className="btn btn-primary" onClick={async () => {
                      try { const r = await markGroupDone({ groupId: g.id, today }); setItems((p) => [...p.filter((i) => i.group_id !== g.id), ...(r.items as Item[])]); if (r.currentDay) setCurrent(r.currentDay) } catch (e) { toast((e as Error).message) }
                    }}>Mark day complete</button>}
                  </div>
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
}
