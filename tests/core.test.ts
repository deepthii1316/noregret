import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { currentStreak, longestStreak } from '@/lib/streak'
import { computeMinimum } from '@/lib/minimum'
import { blocksForWeekday, nowAndNext, type Block } from '@/lib/schedule'
import { addDays, todayIn, weekdayOf, minutesNowIn, weekdaysBetween } from '@/lib/time'
import { parseCsv, toCsv, csvToItemRows } from '@/lib/csv'
import { parseRoadmap, familyFor, pace, nextRevisionDays } from '@/lib/roadmap'

const blk = (o: Partial<Block>): Block => ({ id: 'x', key: null, title: 't', subject: 'DSA', start_time: '09:00', end_time: '10:00', days: [1], kind: 'study', flex_by_day: null, is_study: true, sort_order: 0, color: null, ...o })

describe('streaks', () => {
  it('counts consecutive days ending today', () => expect(currentStreak(['2026-11-22', '2026-11-23', '2026-11-24'], '2026-11-24')).toBe(3))
  it('keeps the streak alive when today is not met yet', () => expect(currentStreak(['2026-11-22', '2026-11-23'], '2026-11-24')).toBe(2))
  it('breaks on a gap', () => expect(currentStreak(['2026-11-20', '2026-11-23'], '2026-11-24')).toBe(1))
  it('longest streak', () => expect(longestStreak(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-10', '2026-11-11'])).toBe(3))
})

describe('minimum', () => {
  const base = { requiresDsa: true, dsaDone: true, exerciseDone: true, studyMinutes: 300, minStudyMinutes: 300 }
  it('met', () => expect(computeMinimum(base).met).toBe(true))
  it('needs exercise', () => expect(computeMinimum({ ...base, exerciseDone: false }).met).toBe(false))
  it('needs hours', () => expect(computeMinimum({ ...base, studyMinutes: 299 }).met).toBe(false))
  it('ignores DSA on days without a DSA block', () => expect(computeMinimum({ ...base, requiresDsa: false, dsaDone: false }).met).toBe(true))
})

describe('time + schedule', () => {
  it('resolves today in IST regardless of server tz', () => {
    expect(todayIn('Asia/Kolkata', new Date('2026-11-23T20:00:00Z'))).toBe('2026-11-24') // 01:30 IST next day
    expect(minutesNowIn('Asia/Kolkata', new Date('2026-11-23T20:00:00Z'))).toBe(90)
  })
  it('weekday and date math', () => {
    expect(weekdayOf('2026-11-24')).toBe(2)
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(weekdaysBetween('2026-11-23', '2026-11-30')).toBe(5)
  })
  it('filters blocks by weekday and finds now/next', () => {
    const blocks = [blk({ id: 'a', start_time: '09:00', end_time: '10:00' }), blk({ id: 'b', start_time: '10:00', end_time: '11:00' }), blk({ id: 'c', days: [6] })]
    expect(blocksForWeekday(blocks, 1).map((b) => b.id)).toEqual(['a', 'b'])
    const { current, next } = nowAndNext(blocksForWeekday(blocks, 1), 9 * 60 + 30)
    expect(current?.id).toBe('a')
    expect(next?.id).toBe('b')
  })
})

describe('roadmap', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(__dirname, '../seed/dsa-roadmap.json'), 'utf8'))
  const parsed = parseRoadmap(raw)
  it('loads 60 days and 207 problems', () => {
    expect(parsed.days).toHaveLength(60)
    expect(parsed.days.reduce((n, d) => n + d.problems.length, 0)).toBe(207)
  })
  it('has unique stable slugs', () => {
    const slugs = parsed.days.flatMap((d) => d.problems.map((p) => p.slug))
    expect(new Set(slugs).size).toBe(207)
    expect(slugs[0]).toBe('d01-p1')
  })
  it('maps every topic to a known family', () => {
    expect(parsed.days.filter((d) => d.family === 'Other').map((d) => d.topic)).toEqual([])
    expect(familyFor('Binary Search Trees (BST)')).toBe('Trees')
    expect(familyFor('Prefix Trees (Tries)')).toBe('Tries')
  })
  it('pace: ahead / behind / on track', () => {
    const o = { startedOn: '2026-11-02', today: '2026-11-09', daysPerWeek: 5 } // 5 weekdays elapsed
    expect(pace({ ...o, daysCompleted: 5 }).status).toBe('on_track')
    expect(pace({ ...o, daysCompleted: 7 })).toMatchObject({ status: 'ahead', diff: 2 })
    expect(pace({ ...o, daysCompleted: 3 })).toMatchObject({ status: 'behind', diff: 2 })
  })
  it('revision intervals 1,3,7,21 then stay at 21', () => {
    expect([0, 1, 2, 3, 4, 9].map(nextRevisionDays)).toEqual([1, 3, 7, 21, 21, 21])
  })
  it('rejects wrong totals', () => expect(() => parseRoadmap({ ...raw, totalProblems: 208 })).toThrow())
})

describe('csv', () => {
  it('handles quotes, commas and CRLF', () => {
    const text = ['a,"b, c","say ""hi"""', 'd,e,f'].join('\r\n')
    expect(parseCsv(text)).toEqual([['a', 'b, c', 'say "hi"'], ['d', 'e', 'f']])
  })
  it('round-trips', () => {
    const rows = [['group', 'title'], ['G, 1', 'He said "x"']]
    expect(parseCsv(toCsv(rows))).toEqual(rows)
  })
  it('maps header columns to import rows', () => {
    expect(csvToItemRows('Group,Title,Difficulty\nArrays,Two Sum,easy\n,skipped,easy')).toEqual([{ group: 'Arrays', title: 'Two Sum', difficulty: 'easy', platform: '', link: '', notes: '' }])
    expect(() => csvToItemRows('a,b\n1,2')).toThrow()
  })
})
