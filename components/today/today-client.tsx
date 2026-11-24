'use client'
import { useEffect, useMemo, useState } from 'react'
import { Check, ExternalLink, Flame, Moon, Play, Square, Clock } from 'lucide-react'
import { toast } from '@/components/toast'
import { HabitControl } from '@/components/habit-control'
import { ItemRow } from '@/components/tracker/item-row'
import { useItemActions } from '@/components/tracker/use-items'
import { saveNightCheck, setBlockDone, setHabitValue } from '@/lib/actions'
import { computeMinimum } from '@/lib/minimum'
import { currentStreak } from '@/lib/streak'
import { flexItems, nowAndNext, plannedMinutes, type Block } from '@/lib/schedule'
import { fmtClock, fmtDuration, minutesNowIn, toMin } from '@/lib/time'
import type { Habit, HabitLog } from '@/lib/habits'
import { habitDone } from '@/lib/habits'
import type { Item } from '@/lib/data'

type Row = { key: string; block: Block; subKey: string; title: string; subject: string; isStudy: boolean; planned: number; indent: boolean }
type Props = {
  date: string; tz: string; timeFormat: '12h' | '24h'; dow: number; initialNowMin: number
  blocks: Block[]; completions: { block_id: string; sub_key: string; actual_minutes: number | null }[]; otherMinutes: number
  habits: Habit[]; habitLogs: HabitLog[]; night: { regret_score: number | null; improve_note: string | null; proud_note: string | null } | null
  pastMetDates: string[]; minStudyMinutes: number; studyTargetMinutes: number; jobsUrl: string | null
  dsa: { phase: 'roadmap' | 'cses'; day: number; topic: string; focus: string; resources: { name: string; url: string }[]; items: Item[] } | null
  revise: Item[]
}

export function TodayClient(p: Props) {
  const [nowMin, setNowMin] = useState(p.initialNowMin)
  const [tick, setTick] = useState(0)
  const [done, setDone] = useState<Record<string, number>>(() => Object.fromEntries(p.completions.map((c) => [`${c.block_id}:${c.sub_key}`, c.actual_minutes ?? 0])))
  const [logs, setLogs] = useState<Record<string, { value: number; note: string | null }>>(() => Object.fromEntries(p.habitLogs.map((l) => [l.habit_id, { value: Number(l.value), note: l.note }])))
  const [logging, setLogging] = useState<string | null>(null)
  const [minutes, setMinutes] = useState('')
  const [timer, setTimer] = useState<{ key: string; startedAt: number } | null>(null)
  const [dsaItems, setDsaItems] = useState<Item[]>(p.dsa?.items ?? [])
  const [revise, setRevise] = useState<Item[]>(p.revise)
  const [dayNo, setDayNo] = useState(p.dsa?.day ?? 0)
  const [nightOpen, setNightOpen] = useState(false)
  const [night, setNight] = useState({ regret: p.night?.regret_score ?? 0, improve: p.night?.improve_note ?? '', proud: p.night?.proud_note ?? '' })
  const [nightSaved, setNightSaved] = useState(!!p.night?.regret_score)

  useEffect(() => {
    const t = setInterval(() => { setNowMin(minutesNowIn(p.tz)); setTick((n) => n + 1) }, 1000)
    return () => clearInterval(t)
  }, [p.tz])

  const rows = useMemo(() => p.blocks.flatMap((b): Row[] => {
    const subs = b.kind === 'flex' ? flexItems(b, p.dow) : []
    if (subs.length) return subs.map((f, i) => ({ key: `${b.id}:${i}`, block: b, subKey: String(i), title: f.title, subject: f.subject, isStudy: true, planned: f.minutes, indent: true }))
    return [{ key: `${b.id}:`, block: b, subKey: '', title: b.title, subject: b.subject, isStudy: b.is_study, planned: plannedMinutes(b), indent: false }]
  }), [p.blocks, p.dow])

  // ---- minimum + streak (computed locally so ticking feels instant) ----
  const studyMinutes = p.otherMinutes + rows.filter((r) => r.isStudy && done[r.key] !== undefined).reduce((n, r) => n + (done[r.key] || 0), 0)
  const dsaBlock = p.blocks.find((b) => b.key === 'dsa')
  const exHabit = p.habits.find((h) => h.slug === 'exercise')
  const exBlocks = p.blocks.filter((b) => b.key === 'exercise')
  const min = computeMinimum({
    requiresDsa: !!dsaBlock, dsaDone: !!dsaBlock && done[`${dsaBlock.id}:`] !== undefined,
    exerciseDone: (exHabit ? (logs[exHabit.id]?.value ?? 0) > 0 : false) || exBlocks.some((b) => done[`${b.id}:`] !== undefined),
    studyMinutes, minStudyMinutes: p.minStudyMinutes,
  })
  const streak = currentStreak(min.met ? [...p.pastMetDates, p.date] : p.pastMetDates, p.date)

  const { current, next } = nowAndNext(p.blocks, nowMin)
  const left = current ? toMin(current.end_time) - nowMin : 0
  const dayLeft = Math.max(0, 23 * 60 - nowMin)
  const showNight = nowMin >= 21 * 60 + 30 || nightOpen

  async function complete(r: Row, completed: boolean, mins: number) {
    const prev = done
    setDone((d) => { const n = { ...d }; if (completed) n[r.key] = mins; else delete n[r.key]; return n })
    setLogging(null)
    try {
      await setBlockDone({ blockId: r.block.id, subKey: r.subKey, date: p.date, completed, minutes: mins, subject: r.subject, isStudy: r.isStudy, key: r.block.key })
      if (completed && r.block.key === 'exercise' && exHabit) setLogs((l) => ({ ...l, [exHabit.id]: { value: mins || 60, note: null } }))
    } catch (e) { setDone(prev); toast(`Could not save: ${(e as Error).message}`) }
  }
  function onTick(r: Row) {
    if (done[r.key] !== undefined) return complete(r, false, 0)
    if (r.isStudy) { setLogging(r.key); setMinutes(String(r.planned)) } else complete(r, true, 0)
  }
  function stopTimer(r: Row) {
    if (!timer) return
    const m = Math.max(1, Math.round((Date.now() - timer.startedAt) / 60000))
    setTimer(null); complete(r, true, m)
  }
  async function setHabit(h: Habit, value: number, note?: string) {
    const prev = logs[h.id]
    setLogs((l) => ({ ...l, [h.id]: { value, note: note ?? l[h.id]?.note ?? null } }))
    try { await setHabitValue({ habitId: h.id, date: p.date, value, note }) } catch (e) { setLogs((l) => ({ ...l, [h.id]: prev ?? { value: 0, note: null } })); toast(`Could not save: ${(e as Error).message}`) }
  }
  const itemActions = useItemActions(setDsaItems, p.date, setDayNo)
  const reviseActions = useItemActions(setRevise, p.date)
  async function saveNight() {
    if (!night.regret) return toast('Pick a regret score from 1 to 5')
    try { await saveNightCheck({ date: p.date, regret: night.regret, improve: night.improve, proud: night.proud }); setNightSaved(true); toast('Night check saved') } catch (e) { toast((e as Error).message) }
  }

  const healthHabits = p.habits.filter((h) => h.category === 'health')
  const homeHabits = p.habits.filter((h) => h.category === 'home')
  const clock = (t: string) => fmtClock(t, p.timeFormat)
  const elapsed = timer ? Math.floor((Date.now() - timer.startedAt) / 1000) : 0
  void tick

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{new Intl.DateTimeFormat('en-IN', { timeZone: p.tz, weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${p.date}T12:00:00Z`))}</h1>
          <p className="sub">{p.dow === 0 || p.dow === 6 ? 'Weekend: contests and upsolving' : 'Weekday'} · {fmtDuration(dayLeft)} until bedtime</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="card flex items-center gap-1.5 px-3 py-1.5"><Flame size={15} className="text-orange-500" />{streak} day streak</span>
          <span className="card flex items-center gap-1.5 px-3 py-1.5"><Clock size={15} className="text-primary" />{fmtDuration(studyMinutes)} / {fmtDuration(p.studyTargetMinutes)}</span>
        </div>
      </header>

      <section className={`card p-4 ${min.met ? 'border-emerald-500/50 bg-emerald-500/5' : ''}`}>
        <p className="font-medium">{min.met ? 'Minimum done. You can sleep without regret.' : 'Bad-day minimum'}</p>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {dsaBlock && <Req ok={min.dsa} label="DSA block" />}
          <Req ok={min.exercise} label="Exercise" />
          <Req ok={min.hours} label={`${fmtDuration(Math.min(studyMinutes, p.minStudyMinutes))} of ${fmtDuration(p.minStudyMinutes)} study`} />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="card border-primary/40 bg-primary/5 p-5">
          <p className="sub">Now</p>
          {current ? (<><p className="mt-1 text-xl font-semibold leading-snug">{current.title}</p>
            <p className="sub mt-1">{clock(current.start_time)} to {clock(current.end_time)} · {fmtDuration(left)} left</p>
            <div className="bar mt-3"><span style={{ width: `${Math.min(100, ((nowMin - toMin(current.start_time)) / plannedMinutes(current)) * 100)}%` }} /></div></>)
            : <p className="mt-1 text-lg">Nothing scheduled right now.</p>}
        </div>
        <div className="card p-5">
          <p className="sub">Next</p>
          {next ? (<><p className="mt-1 text-lg font-medium leading-snug">{next.title}</p><p className="sub mt-1">at {clock(next.start_time)} · in {fmtDuration(toMin(next.start_time) - nowMin)}</p></>) : <p className="mt-1 text-lg">That is the last block of the day.</p>}
        </div>
      </section>

      {p.dsa && (
        <section className={`card p-5 ${current?.key === 'dsa' ? 'border-primary/60' : ''}`}>
          {p.dsa.phase === 'roadmap' ? (<>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><p className="sub">DSA roadmap</p><h2 className="text-lg font-semibold">Day {p.dsa.day}: {p.dsa.topic}</h2><p className="sub">{p.dsa.focus}</p></div>
              <span className="sub tabular-nums">{dsaItems.filter((i) => ['done', 'mastered'].includes(i.status)).length}/{dsaItems.length} done</span>
            </div>
            <div className="mt-2 divide-y">{dsaItems.map((i) => <ItemRow key={i.id} item={i} actions={itemActions} />)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {p.dsa.resources.map((r) => <a key={r.url} className="btn" href={r.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />{r.name}</a>)}
              {dayNo > 0 && dayNo !== p.dsa.day && <button className="btn btn-primary" onClick={() => location.reload()}>Day complete. Go to Day {dayNo}</button>}
            </div>
          </>) : (<>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div><p className="sub">CSES phase</p><h2 className="text-lg font-semibold">{p.dsa.topic}</h2><p className="sub">{p.dsa.focus}</p></div>
              <a className="btn" href="/dsa/cses">Open all sections</a>
            </div>
            {dsaItems.length ? (
              <div className="mt-2 divide-y">
                {dsaItems.map((item) => (
                  <div key={item.id}>
                    <ItemRow item={item} actions={itemActions} />
                    {!['done', 'mastered'].includes(item.status) && (
                      <button className="btn mb-2 !py-1 text-xs" onClick={() => itemActions.toggleRevision(item)}>I'm stuck - mark for revision</button>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="sub mt-3">{p.dsa.focus} <a className="underline" href="/settings">Open Settings</a></p>}
          </>)}
        </section>
      )}

      {revise.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold">Revise today</h2>
          <div className="mt-1 divide-y">{revise.map((i) => <ItemRow key={i.id} item={i} actions={reviseActions} showRevised />)}</div>
        </section>
      )}

      <section className="card p-2 sm:p-4">
        <h2 className="px-2 pb-1 font-semibold sm:px-0">Timetable</h2>
        <ul className="divide-y">
          {rows.map((r, idx) => {
            const isDone = done[r.key] !== undefined
            const isNow = current?.id === r.block.id
            const firstOfBlock = !r.indent || rows[idx - 1]?.block.id !== r.block.id
            const running = timer?.key === r.key
            return (
              <li key={r.key} className={`px-2 py-2.5 ${isNow ? 'rounded-lg bg-primary/5' : ''}`}>
                {r.indent && firstOfBlock && <p className="sub pb-1 text-xs">{r.block.title} · {clock(r.block.start_time)} to {clock(r.block.end_time)}</p>}
                <div className="flex items-center gap-3">
                  <button role="checkbox" aria-checked={isDone} aria-label={r.title} onClick={() => onTick(r)}
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border transition-colors ${isDone ? 'border-primary bg-primary text-primary-fg' : 'bg-card'}`}>{isDone && <Check size={15} />}</button>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${isDone ? 'text-muted line-through' : ''}`}>
                      {r.block.key === 'jobs' && p.jobsUrl ? <a className="underline" href={p.jobsUrl} target="_blank" rel="noreferrer">{r.title}</a> : r.title}
                    </p>
                    {!r.indent && <p className="sub text-xs">{clock(r.block.start_time)} to {clock(r.block.end_time)}{isDone && done[r.key] ? ` · logged ${fmtDuration(done[r.key])}` : ''}</p>}
                    {r.indent && <p className="sub text-xs">{fmtDuration(r.planned)}{isDone && done[r.key] ? ` · logged ${fmtDuration(done[r.key])}` : ''}</p>}
                  </div>
                  {r.isStudy && !isDone && (running
                    ? <button className="btn !border-red-500 text-red-500" onClick={() => stopTimer(r)}><Square size={13} />{String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</button>
                    : <button className="btn !px-2" aria-label={`Start timer for ${r.title}`} disabled={!!timer} onClick={() => setTimer({ key: r.key, startedAt: Date.now() })}><Play size={13} /></button>)}
                </div>
                {logging === r.key && (
                  <form className="mt-2 flex flex-wrap items-center gap-2 pl-10" onSubmit={(e) => { e.preventDefault(); complete(r, true, Math.max(0, Math.round(Number(minutes)) || 0)) }}>
                    <label className="flex items-center gap-2 text-sm">Minutes<input className="input !w-24" type="number" min={0} inputMode="numeric" autoFocus value={minutes} onChange={(e) => setMinutes(e.target.value)} /></label>
                    <button className="btn btn-primary">Save</button><button type="button" className="btn" onClick={() => setLogging(null)}>Cancel</button>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">Daily basics <span className="sub font-normal">{healthHabits.filter((h) => habitDone(h, logs[h.id]?.value ?? 0)).length}/{healthHabits.length}</span></h2>
          <div className="divide-y">{healthHabits.map((h) => <HabitControl key={h.id} habit={h} value={logs[h.id]?.value ?? 0} note={logs[h.id]?.note} onChange={(v, n) => setHabit(h, v, n)} />)}</div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Home <span className="sub font-normal">{homeHabits.filter((h) => habitDone(h, logs[h.id]?.value ?? 0)).length}/{homeHabits.length}</span></h2>
          <div className="divide-y">{homeHabits.map((h) => <HabitControl key={h.id} habit={h} value={logs[h.id]?.value ?? 0} onChange={(v) => setHabit(h, v)} />)}</div>
        </div>
      </section>

      {showNight ? (
        <section className="card border-primary/40 p-5">
          <h2 className="flex items-center gap-2 font-semibold"><Moon size={16} />Night check</h2>
          <p className="sub mt-1">Any regret today? 1 means none.</p>
          <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Regret score">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} role="radio" aria-checked={night.regret === n} onClick={() => { setNight((x) => ({ ...x, regret: n })); setNightSaved(false) }}
                className={`btn !h-10 !w-10 !px-0 ${night.regret === n ? 'btn-primary' : ''}`}>{n}</button>
            ))}
          </div>
          <input className="input mt-3" placeholder="What would I do differently tomorrow?" value={night.improve} onChange={(e) => { setNight((x) => ({ ...x, improve: e.target.value })); setNightSaved(false) }} />
          <input className="input mt-2" placeholder="What I am proud of today" value={night.proud} onChange={(e) => { setNight((x) => ({ ...x, proud: e.target.value })); setNightSaved(false) }} />
          <div className="mt-3 flex items-center gap-3"><button className="btn btn-primary" onClick={saveNight}>Save</button>{nightSaved && <span className="sub">Saved</span>}</div>
        </section>
      ) : <button className="btn" onClick={() => setNightOpen(true)}><Moon size={14} />Open night check</button>}
    </div>
  )
}

function Req({ ok, label }: { ok: boolean; label: string }) {
  return <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted'}`}><span className={`grid h-4 w-4 place-items-center rounded-full border ${ok ? 'border-emerald-500 bg-emerald-500 text-white' : ''}`}>{ok && <Check size={10} />}</span>{label}</span>
}
