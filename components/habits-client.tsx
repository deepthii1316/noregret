'use client'
import { useState } from 'react'
import { Flame } from 'lucide-react'
import { toast } from '@/components/toast'
import { HabitControl } from '@/components/habit-control'
import { setHabitValue } from '@/lib/actions'
import { habitDone, habitStreaks, type Habit, type HabitLog } from '@/lib/habits'
import { addDays } from '@/lib/time'

export function HabitsClient({ title, habits, logs: initial, today }: { title: string; habits: Habit[]; logs: HabitLog[]; today: string }) {
  const [logs, setLogs] = useState(initial)
  const valueOn = (h: Habit, d: string) => Number(logs.find((l) => l.habit_id === h.id && l.date === d)?.value ?? 0)
  const days = Array.from({ length: 28 }, (_, i) => addDays(today, i - 27))

  async function change(h: Habit, value: number, note?: string) {
    const prev = logs
    setLogs((p) => [...p.filter((l) => !(l.habit_id === h.id && l.date === today)), { habit_id: h.id, date: today, value, note: note ?? null }])
    try { await setHabitValue({ habitId: h.id, date: today, value, note }) } catch (e) { setLogs(prev); toast(`Could not save: ${(e as Error).message}`) }
  }
  const doneToday = habits.filter((h) => habitDone(h, valueOn(h, today))).length

  return (
    <div className="space-y-5">
      <header><h1 className="h1">{title}</h1><p className="sub">{doneToday} of {habits.length} done today</p></header>
      {habits.map((h) => {
        const { current, longest } = habitStreaks(h, logs, today)
        return (
          <section key={h.id} className="card p-4">
            <HabitControl habit={h} value={valueOn(h, today)} note={logs.find((l) => l.habit_id === h.id && l.date === today)?.note} onChange={(v, n) => change(h, v, n)} />
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="grid grid-flow-col grid-rows-1 gap-1" role="img" aria-label={`Last 28 days for ${h.name}`}>
                {days.map((d) => <span key={d} title={d} className={`h-4 w-3 rounded-sm sm:w-4 ${habitDone(h, valueOn(h, d)) ? 'bg-primary' : valueOn(h, d) > 0 ? 'bg-primary/35' : 'bg-soft'}`} />)}
              </div>
              <span className="sub flex shrink-0 items-center gap-1 text-xs"><Flame size={13} className="text-orange-500" />{current} · best {longest}</span>
            </div>
          </section>
        )
      })}
    </div>
  )
}
