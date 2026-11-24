'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarPlus, ExternalLink, Plus, RefreshCw, Trophy } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from '@/components/toast'
import {
  addManualContest, saveContestResult, saveUpsolve, setContestAttending,
  setUpsolveStatus, syncUpcomingContests,
} from '@/lib/feature-actions'
import { addDays } from '@/lib/time'

type Contest = {
  id: string; platform: string; external_id: string; name: string; url: string; start_time: string
  duration_minutes: number; attending: boolean; manual: boolean; synced_at: string | null
}
type Result = { contest_id: string; rank: string | null; rating_change: number | null; solved: number; total: number; notes: string | null; created_at: string }
type Upsolve = { id: string; contest_id: string; title: string; url: string | null; status: 'todo' | 'doing' | 'done'; notes: string | null; contests: { name: string; platform: string } | null }

export function ContestClient({ today, contests, results, upsolves }: { today: string; contests: Contest[]; results: Result[]; upsolves: Upsolve[] }) {
  const router = useRouter()
  const [now, setNow] = useState(Date.now())
  const [platform, setPlatform] = useState('all')
  const [period, setPeriod] = useState<'all' | 'week' | 'weekend'>('all')
  const [manualOpen, setManualOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [syncErrors, setSyncErrors] = useState<{ platform: string; error: string | null }[]>([])
  const [manual, setManual] = useState({ platform: 'Other', name: '', url: '', startTime: '', durationMinutes: '120' })
  const [upsolve, setUpsolve] = useState({ contestId: '', title: '', url: '' })
  const [resultDrafts, setResultDrafts] = useState<Record<string, { rank: string; rating: string; solved: string; total: string; notes: string }>>({})

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  const nowIso = new Date(now).toISOString()
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weekEnd = addDays(weekStart, 7)
  const weekendStart = addDays(weekStart, 5)
  const weekendEnd = addDays(weekStart, 7)
  const filtered = useMemo(() => contests.filter((contest) => {
    const day = contest.start_time.slice(0, 10)
    if (platform !== 'all' && contest.platform !== platform) return false
    if (period === 'week' && (day < weekStart || day >= weekEnd)) return false
    if (period === 'weekend' && (day < weekendStart || day >= weekendEnd)) return false
    return true
  }), [contests, period, platform, weekEnd, weekStart, weekendEnd, weekendStart])
  const upcoming = filtered.filter((contest) => contest.start_time >= nowIso)
  const past = contests.filter((contest) => contest.start_time < nowIso)
  const resultMap = new Map(results.map((result) => [result.contest_id, result]))
  const contestById = new Map(contests.map((contest) => [contest.id, contest]))
  const resultRows = results.filter((result) => contestById.has(result.contest_id))
    .sort((a, b) => contestById.get(a.contest_id)!.start_time.localeCompare(contestById.get(b.contest_id)!.start_time))
  const ratings: Record<string, number> = {}
  const ratingTrend = resultRows.map((result) => {
    const contest = contestById.get(result.contest_id)!
    ratings[contest.platform] = (ratings[contest.platform] ?? 0) + (result.rating_change ?? 0)
    return { date: contest.start_time.slice(0, 10), ...ratings }
  })
  const monthlyCounts = [...contests.reduce((map, contest) => {
    const month = contest.start_time.slice(0, 7)
    map.set(month, (map.get(month) ?? 0) + 1)
    return map
  }, new Map<string, number>())].map(([month, count]) => ({ month, count }))
  const solveTrend = resultRows.map((result) => ({
    date: contestById.get(result.contest_id)!.start_time.slice(0, 10),
    rate: result.total ? Math.round(result.solved / result.total * 100) : 0,
  }))
  const lastSynced = contests.map((contest) => contest.synced_at).filter((value): value is string => !!value).sort().at(-1)

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try { await action(); toast(message); router.refresh() }
    catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }

  async function refresh() {
    setBusy(true)
    try {
      const outcomes = await syncUpcomingContests()
      setSyncErrors(outcomes.filter((result) => result.error).map((result) => ({ platform: result.platform, error: result.error })))
      const okCount = outcomes.filter((result) => !result.error).length
      toast(`Contest sync completed for ${okCount} of ${outcomes.length} sources`)
      router.refresh()
    } catch (error) { toast(`Contest sync failed: ${(error as Error).message}`) }
    finally { setBusy(false) }
  }

  function downloadIcs(contest: Contest) {
    const start = new Date(contest.start_time)
    const end = new Date(start.getTime() + contest.duration_minutes * 60000)
    const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    const body = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NoRegret//Contest Radar//EN',
      'BEGIN:VEVENT', `UID:${contest.platform}-${contest.external_id}@noregret`,
      `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${contest.name.replace(/[,;]/g, '\\$&')}`, `URL:${contest.url}`, 'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: `${contest.platform}-${contest.external_id}.ics` })
    link.click()
    URL.revokeObjectURL(url)
  }

  function googleCalendarUrl(contest: Contest) {
    const start = new Date(contest.start_time)
    const end = new Date(start.getTime() + contest.duration_minutes * 60000)
    const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(contest.name)}&dates=${fmt(start)}/${fmt(end)}&details=${encodeURIComponent(contest.url)}`
  }

  function countdown(start: string) {
    const minutes = Math.max(0, Math.floor((new Date(start).getTime() - now) / 60000))
    const days = Math.floor(minutes / 1440)
    const hours = Math.floor(minutes % 1440 / 60)
    const mins = minutes % 60
    return days ? `${days}d ${hours}h` : `${hours}h ${mins}m`
  }

  function saveResult(contestId: string) {
    const draft = resultDrafts[contestId] ?? { rank: '', rating: '', solved: '0', total: '0', notes: '' }
    void run(() => saveContestResult({
      contestId, rank: draft.rank, ratingChange: draft.rating === '' ? null : Number(draft.rating),
      solved: Number(draft.solved), total: Number(draft.total), notes: draft.notes,
    }), 'Contest result saved')
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">Contest Radar</h1><p className="sub">Upcoming contests in Indian Standard Time. Weekend contests first.</p></div>
        <div className="flex gap-2"><button className="btn" disabled={busy} onClick={refresh}><RefreshCw size={14} />Refresh now</button><button className="btn btn-primary" onClick={() => setManualOpen((open) => !open)}><Plus size={14} />Add contest</button></div>
      </header>
      <p className="sub text-xs">{lastSynced ? `Last synced ${new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lastSynced))}` : 'Contest sources have not been synced yet.'}</p>
      {syncErrors.length > 0 && <div className="card border-amber-500/40 p-3 text-sm"><p className="font-medium">Some contest sources could not be refreshed.</p>{syncErrors.map((entry) => <p className="sub" key={entry.platform}>{entry.platform}: {entry.error}</p>)}</div>}
      {manualOpen && <form className="card grid gap-2 p-4 sm:grid-cols-5" onSubmit={(event) => {
        event.preventDefault()
        if (!manual.name.trim() || !manual.startTime) return toast('Enter a contest name and start time')
        void run(() => addManualContest({ platform: manual.platform, name: manual.name, url: manual.url, startTime: new Date(manual.startTime).toISOString(), durationMinutes: Number(manual.durationMinutes) }), 'Contest added')
        setManual({ platform: 'Other', name: '', url: '', startTime: '', durationMinutes: '120' })
      }}>
        <select className="input" value={manual.platform} onChange={(e) => setManual({ ...manual, platform: e.target.value })}><option>Other</option><option>Codeforces</option><option>LeetCode</option><option>CodeChef</option></select>
        <input className="input" placeholder="Contest name" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} />
        <input className="input" type="url" required placeholder="Contest URL" value={manual.url} onChange={(e) => setManual({ ...manual, url: e.target.value })} />
        <input className="input" type="datetime-local" value={manual.startTime} onChange={(e) => setManual({ ...manual, startTime: e.target.value })} />
        <div className="flex gap-2"><input className="input" type="number" min="1" value={manual.durationMinutes} aria-label="Duration in minutes" onChange={(e) => setManual({ ...manual, durationMinutes: e.target.value })} /><button className="btn btn-primary" disabled={busy}>Save</button></div>
      </form>}

      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" aria-label="Platform filter" value={platform} onChange={(e) => setPlatform(e.target.value)}><option value="all">All platforms</option>{['Codeforces', 'LeetCode', 'CodeChef', 'Other'].map((name) => <option key={name}>{name}</option>)}</select>
        <select className="input !w-auto" aria-label="Date filter" value={period} onChange={(e) => setPeriod(e.target.value as typeof period)}><option value="all">All dates</option><option value="week">This week</option><option value="weekend">This weekend</option></select>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold">Upcoming</h2>
        {upcoming.map((contest) => (
          <article key={contest.id} className={`card p-4 ${[0, 6].includes(new Date(contest.start_time).getDay()) ? 'border-primary/40' : ''}`}>
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="chip bg-primary/10 text-primary">{contest.platform}</span>{contest.attending && <span className="chip bg-emerald-500/10 text-emerald-600">Attending</span>}</div><h3 className="mt-2 font-semibold">{contest.name}</h3>
                <p className="sub mt-1">{new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(contest.start_time))} IST · {contest.duration_minutes} min · starts in {countdown(contest.start_time)}</p>
              </div>
              <button className={`btn ${contest.attending ? 'btn-primary' : ''}`} onClick={() => void run(() => setContestAttending(contest.id, !contest.attending), 'Attendance updated')}>{contest.attending ? "I'll attend" : "I'll attend?"}</button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2"><a className="btn" href={contest.url} target="_blank" rel="noreferrer"><ExternalLink size={14} />Open contest</a><button className="btn" onClick={() => downloadIcs(contest)}><CalendarPlus size={14} />Add to calendar</button><a className="btn" href={googleCalendarUrl(contest)} target="_blank" rel="noreferrer">Google Calendar</a></div>
          </article>
        ))}
        {!upcoming.length && <div className="card p-6 text-center sub">No upcoming contests match these filters. Refresh the sources or add one manually.</div>}
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Contest log & results</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary title="Contests logged" value={results.length} />
          <Summary title="Rating changes" value={results.reduce((sum, result) => sum + (result.rating_change ?? 0), 0)} />
          <Summary title="Pending upsolves" value={upsolves.length} />
        </div>
        {past.map((contest) => {
          const result = resultMap.get(contest.id)
          const draft = resultDrafts[contest.id] ?? { rank: result?.rank ?? '', rating: result?.rating_change?.toString() ?? '', solved: String(result?.solved ?? 0), total: String(result?.total ?? 0), notes: result?.notes ?? '' }
          return <div key={contest.id} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center gap-2"><span className="chip bg-soft">{contest.platform}</span><span className="flex-1 font-medium">{contest.name}</span><span className="sub text-xs">{new Date(contest.start_time).toLocaleDateString('en-IN')}</span></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-5">
              <input className="input" placeholder="Rank" value={draft.rank} onChange={(e) => setResultDrafts({ ...resultDrafts, [contest.id]: { ...draft, rank: e.target.value } })} />
              <input className="input" type="number" placeholder="Rating +/-" value={draft.rating} onChange={(e) => setResultDrafts({ ...resultDrafts, [contest.id]: { ...draft, rating: e.target.value } })} />
              <input className="input" type="number" min="0" placeholder="Solved" value={draft.solved} onChange={(e) => setResultDrafts({ ...resultDrafts, [contest.id]: { ...draft, solved: e.target.value } })} />
              <input className="input" type="number" min="0" placeholder="Total" value={draft.total} onChange={(e) => setResultDrafts({ ...resultDrafts, [contest.id]: { ...draft, total: e.target.value } })} />
              <button className="btn btn-primary" onClick={() => saveResult(contest.id)} disabled={busy}>Save result</button>
            </div>
            <input className="input mt-2" placeholder="Notes" value={draft.notes} onChange={(e) => setResultDrafts({ ...resultDrafts, [contest.id]: { ...draft, notes: e.target.value } })} />
            <form className="mt-2 flex gap-2" onSubmit={(event) => {
              event.preventDefault()
              if (!upsolve.title.trim()) return toast('Enter a problem title')
              void run(() => saveUpsolve({ ...upsolve, contestId: contest.id }), 'Upsolve added')
              setUpsolve({ contestId: '', title: '', url: '' })
            }}>
              <input className="input" aria-label={`Upsolve title for ${contest.name}`} placeholder="Add an unsolved problem" value={upsolve.contestId === contest.id ? upsolve.title : ''} onChange={(e) => setUpsolve({ ...upsolve, contestId: contest.id, title: e.target.value })} />
              <input className="input" type="url" aria-label="Upsolve problem URL" placeholder="Problem link" value={upsolve.contestId === contest.id ? upsolve.url : ''} onChange={(e) => setUpsolve({ ...upsolve, contestId: contest.id, url: e.target.value })} />
              <button className="btn"><Plus size={14} />Upsolve</button>
            </form>
          </div>
        })}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <div className="card p-4"><h2 className="font-semibold">Rating change by platform</h2><div className="mt-2 h-40">
          {ratingTrend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={ratingTrend}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="date" hide /><YAxis width={35} /><Tooltip /><Line type="monotone" dataKey="Codeforces" stroke="#6366f1" dot={false} /><Line type="monotone" dataKey="LeetCode" stroke="#14b8a6" dot={false} /><Line type="monotone" dataKey="CodeChef" stroke="#f59e0b" dot={false} /></LineChart></ResponsiveContainer> : <p className="sub pt-8 text-center text-xs">Save contest results to see your rating trend.</p>}
        </div></div>
        <div className="card p-4"><h2 className="font-semibold">Contests per month</h2><div className="mt-2 h-40">
          {monthlyCounts.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={monthlyCounts}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="month" tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="sub pt-8 text-center text-xs">No contests in this range.</p>}
        </div></div>
        <div className="card p-4"><h2 className="font-semibold">Solve rate trend</h2><div className="mt-2 h-40">
          {solveTrend.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={solveTrend}><CartesianGrid stroke="var(--border)" /><XAxis dataKey="date" hide /><YAxis domain={[0, 100]} width={35} /><Tooltip formatter={(value) => [`${value}%`, 'Solve rate']} /><Line type="monotone" dataKey="rate" stroke="#14b8a6" dot={{ r: 3 }} /></LineChart></ResponsiveContainer> : <p className="sub pt-8 text-center text-xs">Save results to see solve rate.</p>}
        </div></div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Pending upsolves</h2>
        <ul className="mt-2 divide-y">{upsolves.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span className="flex-1">{item.title} <span className="sub">· {item.contests?.name}</span></span>{item.url && <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}><ExternalLink size={14} /></a>}<select className="input !w-auto" aria-label={`Upsolve status for ${item.title}`} value={item.status} onChange={(e) => void run(() => setUpsolveStatus(item.id, e.target.value as Upsolve['status']), 'Upsolve updated')}><option value="todo">To do</option><option value="doing">Doing</option><option value="done">Done</option></select></li>)}</ul>
        {!upsolves.length && <p className="sub mt-2">No pending upsolves.</p>}
      </section>
    </div>
  )
}

function Summary({ title, value }: { title: string; value: number }) {
  return <div className="rounded-lg bg-soft p-3"><p className="sub text-xs">{title}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>
}
