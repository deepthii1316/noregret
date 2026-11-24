'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Flame, Target, Trophy } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart as RechartsRadarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { currentStreak, longestStreak } from '@/lib/streak'
import { addDays } from '@/lib/time'

export type DashboardData = {
  today: string
  hours: { date: string; hours: number }[]
  subjects: { subject: string; hours: number }[]
  completion: { key: string; name: string; total: number; done: number }[]
  minimumDates: string[]
  nightChecks: { date: string; score: number | null }[]
  familySkills: { name: string; value: number }[]
  weekSubjects: { subject: string; plannedHours: number; actualHours: number }[]
  weekSolves: number
  weekendContests: number
  currentDsa: string
  revise: { id: string; title: string }[]
}

const RANGES = [
  { label: '7D', days: 7 }, { label: '30D', days: 30 }, { label: '3M', days: 90 }, { label: '6M', days: 182 },
]
const COLORS = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6', '#84cc16', '#f97316']
const displayDate = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-IN', { timeZone: 'UTC', ...options }).format(new Date(`${date}T12:00:00Z`))

export function DashboardClient({ data }: { data: DashboardData }) {
  const [range, setRange] = useState(30)
  const activity = useMemo(() => {
    const start = addDays(data.today, -(range - 1))
    const byDate = new Map(data.hours.map((row) => [row.date, row.hours]))
    return Array.from({ length: range }, (_, index) => {
      const date = addDays(start, index)
      return { date, hours: byDate.get(date) ?? 0 }
    })
  }, [data.hours, data.today, range])
  const totalHours = activity.reduce((sum, row) => sum + row.hours, 0)
  const streak = currentStreak(data.minimumDates, data.today)
  const bestStreak = longestStreak(data.minimumDates)
  const subjects = data.subjects.filter((entry) => entry.hours > 0)
  const totalSubjectHours = subjects.reduce((sum, entry) => sum + entry.hours, 0)
  const skills = [
    ...data.familySkills.slice(0, 5),
    ...data.completion.filter((entry) => entry.key !== 'dsa_roadmap' && entry.total).slice(0, 3)
      .map((entry) => ({ name: entry.name, value: Math.round(entry.done / entry.total * 100) })),
  ].slice(0, 8)
  const monthStart = `${data.today.slice(0, 7)}-01`
  const monthDays = new Date(Date.UTC(Number(data.today.slice(0, 4)), Number(data.today.slice(5, 7)), 0)).getUTCDate()
  const firstOffset = new Date(`${monthStart}T00:00:00Z`).getUTCDay()
  const minimumSet = new Set(data.minimumDates)
  const regretByDate = new Map(data.nightChecks.map((entry) => [entry.date, entry.score]))
  const todayHours = data.hours.find((row) => row.date === data.today)?.hours ?? 0

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="h1">Overview</h1><p className="sub">Track your daily consistency and problem-solving metrics.</p></div>
        <span className="sub">{displayDate(data.today, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={<Flame size={16} />} label="Current streak" value={`${streak} days`} detail={`Longest: ${bestStreak} days`} />
        <Metric icon={<Target size={16} />} label="Today" value={`${todayHours.toFixed(1)}h`} detail="Study time logged" />
        <Metric icon={<Trophy size={16} />} label="This week" value={`${data.weekSolves} solved`} detail={`${data.weekendContests} contests attending`} />
        <Metric icon={<Target size={16} />} label="DSA progress" value={data.currentDsa} detail="Open DSA tracker" href="/dsa/roadmap" />
      </section>

      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="font-semibold">Activity</h2><p className="sub text-xs">Study hours by day · {totalHours.toFixed(1)}h in range</p></div>
          <div className="flex gap-1" role="group" aria-label="Activity date range">
            {RANGES.map((item) => <button key={item.days} className={`btn !px-2.5 !py-1 text-xs ${range === item.days ? 'btn-primary' : ''}`} onClick={() => setRange(item.days)}>{item.label}</button>)}
          </div>
        </div>
        <div className="mt-4 h-48" role="img" aria-label={`Study hours over the last ${range} days`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activity} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
              <XAxis dataKey="date" hide />
              <Tooltip labelFormatter={(value) => String(value)} formatter={(value) => [`${Number(value).toFixed(1)} hours`, 'Study']} />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={24}>
                {activity.map((entry) => <Cell key={entry.date} fill={entry.date === data.today ? '#14b8a6' : '#6366f1'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="sub flex justify-between text-xs"><span>{activity[0]?.date}</span><span>{data.today}</span></div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">Month calendar</h2>
          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => <span key={day} className="sub py-1">{day}</span>)}
            {Array.from({ length: firstOffset }, (_, index) => <span key={`blank-${index}`} />)}
            {Array.from({ length: monthDays }, (_, index) => {
              const date = addDays(monthStart, index)
              const score = regretByDate.get(date)
              const active = minimumSet.has(date)
              return <div key={date} title={`${date}${active ? ' · minimum done' : ''}${score ? ` · regret ${score}` : ''}`}
                className={`relative grid aspect-square place-items-center rounded-lg border text-xs ${date === data.today ? 'border-primary font-semibold' : 'border-transparent'} ${active ? 'bg-primary/15' : 'bg-soft'} ${score && score >= 4 ? 'text-rose-600' : score && score <= 2 ? 'text-emerald-600' : ''}`}>
                {index + 1}{active && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" />}
              </div>
            })}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Planned vs actual this week</h2>
          <div className="mt-3 space-y-3">
            {data.weekSubjects.map((entry) => (
              <div key={entry.subject}>
                <div className="flex justify-between text-xs"><span>{entry.subject}</span><span className="sub">{entry.actualHours} / {entry.plannedHours}h</span></div>
                <div className="bar mt-1"><span style={{ width: `${entry.plannedHours ? Math.min(100, entry.actualHours / entry.plannedHours * 100) : entry.actualHours ? 100 : 0}%` }} /></div>
              </div>
            ))}
            {!data.weekSubjects.length && <p className="sub">No study blocks logged this week yet.</p>}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="font-semibold">Skill Analysis</h2>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-4">
            {skills.length ? <RadarChart skills={skills} /> : <p className="sub">Complete tracker items to see skill progress.</p>}
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold">Category Breakdown</h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-6">
            <div className="relative h-40 w-40">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={subjects} dataKey="hours" nameKey="subject" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {subjects.map((entry, index) => <Cell key={entry.subject} fill={COLORS[index % COLORS.length]} />)}
                </Pie><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Hours']} /></PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-items-center text-center font-semibold">{totalSubjectHours.toFixed(0)}h</div>
            </div>
            <ul className="space-y-2 text-sm">
              {subjects.map((entry, index) => <li key={entry.subject} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{entry.subject}<span className="sub ml-auto pl-2">{entry.hours.toFixed(1)}h</span></li>)}
              {!subjects.length && <li className="sub">No logged hours yet.</li>}
            </ul>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <div className="flex items-center justify-between"><h2 className="font-semibold">Revise today</h2><Link className="sub underline" href="/dsa/roadmap">Open DSA</Link></div>
        {data.revise.length ? <ul className="mt-2 divide-y">{data.revise.map((item) => <li className="py-2 text-sm" key={item.id}>{item.title}</li>)}</ul> : <p className="sub mt-2">Nothing due for revision.</p>}
      </section>
    </div>
  )
}

function Metric({ icon, label, value, detail, href }: { icon: React.ReactNode; label: string; value: string; detail: string; href?: string }) {
  return <div className="card p-4"><p className="sub flex items-center gap-2">{icon}{label}</p><p className="mt-2 text-xl font-semibold">{value}</p>{href ? <Link className="sub mt-1 inline-block underline" href={href}>{detail}</Link> : <p className="sub mt-1 text-xs">{detail}</p>}</div>
}

function RadarChart({ skills }: { skills: { name: string; value: number }[] }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-4">
      <div className="h-48 w-60" role="img" aria-label="Skill completion radar">
        <ResponsiveContainer width="100%" height="100%">
          <RechartsRadarChart data={skills} outerRadius="70%">
            <PolarGrid stroke="var(--border)" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fill: 'currentColor' }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
            <Tooltip formatter={(value) => [`${value}%`, 'Complete']} />
          </RechartsRadarChart>
        </ResponsiveContainer>
      </div>
      <ul className="max-h-44 space-y-1 overflow-y-auto text-xs">{skills.map((skill) => <li key={skill.name} className="flex min-w-36 justify-between gap-4"><span>{skill.name}</span><span className="sub">{skill.value}%</span></li>)}</ul>
    </div>
  )
}
