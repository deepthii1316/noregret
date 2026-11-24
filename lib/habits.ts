import { currentStreak, longestStreak } from './streak'

export type Habit = { id: string; slug: string; name: string; type: 'checkbox' | 'counter' | 'duration' | 'time'; target: number | null; unit: string | null; category: 'health' | 'home'; schedule: number[]; sort_order: number }
export type HabitLog = { habit_id: string; date: string; value: number; note: string | null }

export const habitDone = (h: Pick<Habit, 'type' | 'target'>, value: number) =>
  h.type === 'checkbox' ? value > 0 : h.target ? value >= h.target : value > 0

export function habitStreaks(h: Habit, logs: HabitLog[], today: string) {
  const dates = logs.filter((l) => l.habit_id === h.id && habitDone(h, Number(l.value))).map((l) => l.date)
  return { current: currentStreak(dates, today), longest: longestStreak(dates) }
}
export function sleepHours(bed: string, wake: string) {
  const [bh, bm] = bed.split(':').map(Number), [wh, wm] = wake.split(':').map(Number)
  const mins = (((wh * 60 + wm) - (bh * 60 + bm)) % 1440 + 1440) % 1440
  return Math.round((mins / 60) * 10) / 10
}
