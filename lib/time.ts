// All "today" logic is computed in the user's timezone (default Asia/Kolkata), never the server's.
export const DEFAULT_TZ = 'Asia/Kolkata'

export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function minutesNowIn(tz: string, now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return h * 60 + m
}

/** 0 = Sunday ... 6 = Saturday, for a yyyy-MM-dd string. */
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay()

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const hhmm = (t: string): string => t.slice(0, 5)

export function fmtClock(t: string, format: '12h' | '24h' = '12h'): string {
  const [h, m] = t.split(':').map(Number)
  if (format === '24h') return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

/** Number of Mon-Fri days in [start, end) (end exclusive). */
export function weekdaysBetween(start: string, end: string): number {
  let n = 0
  for (let d = start; d < end; d = addDays(d, 1)) {
    const w = weekdayOf(d)
    if (w >= 1 && w <= 5) n++
  }
  return n
}
