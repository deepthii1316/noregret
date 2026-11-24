import { addDays } from './time'

/** Streak of consecutive "minimum met" days ending today (or yesterday if today isn't met yet). */
export function currentStreak(metDates: Iterable<string>, today: string): number {
  const met = new Set(metDates)
  let d = met.has(today) ? today : addDays(today, -1)
  let n = 0
  while (met.has(d)) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export function longestStreak(metDates: Iterable<string>): number {
  const days = [...new Set(metDates)].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}
