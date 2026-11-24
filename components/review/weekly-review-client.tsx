'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/components/toast'
import { saveWeeklyReview } from '@/lib/feature-actions'
import { addDays } from '@/lib/time'

type Metrics = {
  hoursBySubject: { subject: string; hours: number; plannedHours: number }[]
  minimumDays: number
  dsaProblems: number
  roadmapDaysCompleted: number
  contestsAttended: number
  habitCompletion: number
  averageRegret: number | null
}
type Review = { id: string; week_start: string; went_well: string | null; to_fix: string | null; priorities: string[] }

export function WeeklyReviewClient({ weekStart, metrics, current, history }: { weekStart: string; metrics: Metrics; current: Review | null; history: Review[] }) {
  const router = useRouter()
  const [wentWell, setWentWell] = useState(current?.went_well ?? '')
  const [toFix, setToFix] = useState(current?.to_fix ?? '')
  const [priorities, setPriorities] = useState([...(current?.priorities ?? ['', '', ''])])
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    try {
      await saveWeeklyReview({ weekStart, wentWell, toFix, priorities: priorities.map((value) => value.trim()).filter(Boolean).slice(0, 3) })
      toast('Weekly review saved')
      router.refresh()
    } catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }
  const weekEnd = addDays(weekStart, 6)

  return (
    <div className="space-y-5">
      <header><h1 className="h1">Weekly Review</h1><p className="sub">Monday, {weekStart} - Sunday, {weekEnd}. Edit this review any day.</p></header>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric label="Minimum days met" value={`${metrics.minimumDays} / 7`} />
        <Metric label="DSA problems solved" value={metrics.dsaProblems} />
        <Metric label="Roadmap days completed" value={metrics.roadmapDaysCompleted} />
        <Metric label="Contests logged" value={metrics.contestsAttended} />
        <Metric label="Habit completion" value={`${metrics.habitCompletion}%`} />
        <Metric label="Average regret" value={metrics.averageRegret ?? 'Not scored'} />
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">Study hours by subject</h2>
        <div className="mt-3 space-y-3">{metrics.hoursBySubject.map((entry) => <div key={entry.subject}><div className="flex items-center justify-between text-sm"><span>{entry.subject}</span><span className="tabular-nums">{entry.hours} / {entry.plannedHours}h</span></div><div className="bar mt-1"><span style={{ width: `${entry.plannedHours ? Math.min(100, entry.hours / entry.plannedHours * 100) : entry.hours ? 100 : 0}%` }} /></div></div>)}
          {!metrics.hoursBySubject.length && <p className="sub">No study time logged this week yet.</p>}
        </div>
      </section>
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Your review</h2>
        <label className="block text-sm">What went well?<textarea className="input mt-1 min-h-24" value={wentWell} onChange={(e) => setWentWell(e.target.value)} /></label>
        <label className="block text-sm">What would you fix?<textarea className="input mt-1 min-h-24" value={toFix} onChange={(e) => setToFix(e.target.value)} /></label>
        <fieldset><legend className="text-sm">Three priorities for next week</legend><div className="mt-2 space-y-2">{[0, 1, 2].map((index) => <input key={index} className="input" placeholder={`Priority ${index + 1}`} value={priorities[index] ?? ''} onChange={(e) => setPriorities((currentValues) => { const next = [...currentValues]; next[index] = e.target.value; return next })} />)}</div></fieldset>
        <button className="btn btn-primary" disabled={busy} onClick={save}>Save review</button>
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">Past reviews</h2>
        <ul className="mt-2 divide-y">{history.map((review) => <li className="py-2" key={review.id}><p className="font-medium">Week of {review.week_start}</p><p className="sub text-xs">{review.priorities.filter(Boolean).join(' · ') || review.went_well || 'No notes yet'}</p></li>)}</ul>
        {!history.length && <p className="sub mt-2">Your saved reviews will appear here.</p>}
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="card p-4"><p className="sub text-xs">{label}</p><p className="mt-1 text-xl font-semibold">{value}</p></div>
}
