import { addDays, weekdaysBetween } from './time'

export type RoadmapProblem = {
  slug: string
  order: number
  title: string
  difficulty: 'easy' | 'medium' | 'hard'
  label: string
  url: string
  platform: string
}
export type RoadmapDay = {
  day: number
  topic: string
  focus: string
  family: string
  resources: { name: string; url: string }[]
  problems: RoadmapProblem[]
}

// Ordered: first match wins (e.g. "Binary Search Trees" must hit Trees before Binary Search).
const FAMILY_RULES: [RegExp, string][] = [
  [/fast-slow/i, 'Linked List'],
  [/sliding window/i, 'Sliding Window'],
  [/prefix sums|difference arrays/i, 'Prefix Sums'],
  [/prefix hashmaps|hash/i, 'Hashing'],
  [/matrix/i, 'Matrix'],
  [/cache/i, 'Design / Caches'],
  [/stack/i, 'Stack'],
  [/trie|prefix trees/i, 'Tries'],
  [/segment|fenwick/i, 'Segment Trees'],
  [/heap|priority/i, 'Heaps'],
  [/topological|\bdag\b|cycle detection/i, 'Topological Sort'],
  [/shortest|dijkstra|spanning/i, 'Shortest Paths'],
  [/disjoint|dsu/i, 'DSU'],
  [/tree|bst|\blca\b/i, 'Trees'],
  [/binary search/i, 'Binary Search'],
  [/two pointers/i, 'Two Pointers'],
  [/backtracking/i, 'Backtracking'],
  [/graph|bfs/i, 'Graphs'],
  [/dynamic|knapsack|subsequence|\bdp\b/i, 'DP'],
  [/interval/i, 'Intervals'],
]
export const FAMILIES = [
  'Two Pointers', 'Sliding Window', 'Prefix Sums', 'Hashing', 'Matrix', 'Linked List', 'Stack', 'Design / Caches',
  'Binary Search', 'Heaps', 'Trees', 'Tries', 'Backtracking', 'Graphs', 'DSU', 'Topological Sort', 'Shortest Paths',
  'Segment Trees', 'DP', 'Intervals',
]

export function familyFor(topic: string): string {
  return FAMILY_RULES.find(([re]) => re.test(topic))?.[1] ?? 'Other'
}

export const problemSlug = (day: number, order: number) => `d${String(day).padStart(2, '0')}-p${order}`

/** Parse + validate the roadmap JSON. Throws if shape or declared totals do not match. */
export function parseRoadmap(raw: unknown): { name: string; days: RoadmapDay[] } {
  const r = raw as any
  if (!r || !Array.isArray(r.days)) throw new Error('Roadmap JSON must have a "days" array')
  const days: RoadmapDay[] = r.days.map((d: any) => {
    if (typeof d.day !== 'number' || !Array.isArray(d.problems)) throw new Error(`Bad day entry: ${JSON.stringify(d).slice(0, 80)}`)
    return {
      day: d.day,
      topic: String(d.topic),
      focus: String(d.focus ?? ''),
      family: familyFor(String(d.topic)),
      resources: (d.resources ?? []).map((x: any) => ({ name: String(x.name), url: String(x.url) })),
      problems: d.problems.map((p: any) => ({
        slug: problemSlug(d.day, p.order),
        order: p.order,
        title: String(p.title),
        difficulty: p.difficulty,
        label: String(p.label ?? ''),
        url: String(p.url),
        platform: String(p.platform ?? 'LeetCode'),
      })),
    }
  })
  const total = days.reduce((n, d) => n + d.problems.length, 0)
  if (r.totalDays && r.totalDays !== days.length) throw new Error(`Expected ${r.totalDays} days, found ${days.length}`)
  if (r.totalProblems && r.totalProblems !== total) throw new Error(`Expected ${r.totalProblems} problems, found ${total}`)
  return { name: String(r.name ?? 'Roadmap'), days }
}

export type Pace = { status: 'ahead' | 'behind' | 'on_track'; diff: number; finishDate: string }

/** Target: one roadmap day per weekday, scaled by days-per-week. Missed days never auto-skip. */
export function pace(o: { daysCompleted: number; startedOn: string; today: string; daysPerWeek: number; totalDays?: number }): Pace {
  const total = o.totalDays ?? 60
  const expected = Math.floor((weekdaysBetween(o.startedOn, o.today) * o.daysPerWeek) / 5)
  const diff = o.daysCompleted - expected
  const remaining = Math.max(total - o.daysCompleted, 0)
  return {
    status: diff > 0 ? 'ahead' : diff < 0 ? 'behind' : 'on_track',
    diff: Math.abs(diff),
    finishDate: addDays(o.today, Math.ceil((remaining / o.daysPerWeek) * 7)),
  }
}

export const REVISION_INTERVALS = [1, 3, 7, 21]
export const nextRevisionDays = (revisionCount: number) => REVISION_INTERVALS[Math.min(revisionCount, REVISION_INTERVALS.length - 1)]
