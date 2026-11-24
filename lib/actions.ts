'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { addDays, weekdayOf } from '@/lib/time'
import { computeMinimum } from '@/lib/minimum'
import { nextRevisionDays } from '@/lib/roadmap'

const DONE = ['done', 'mastered']
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const status = z.enum(['todo', 'doing', 'done', 'mastered'])

async function ctx() {
  const s = await createClient()
  const { data: { user } } = await s.auth.getUser()
  if (!user) throw new Error('Not signed in')
  return s
}
type S = Awaited<ReturnType<typeof ctx>>
function ok<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

/** Recompute the bad-day minimum for a date and store it (drives the streak). */
async function recomputeDay(s: S, d: string) {
  const dow = weekdayOf(d)
  const [st, blocks, comps, entries, ex] = await Promise.all([
    s.from('settings').select('min_study_hours').maybeSingle(),
    s.from('schedule_blocks').select('id,key').contains('days', [dow]),
    s.from('block_completions').select('block_id,sub_key').eq('date', d).eq('completed', true),
    s.from('time_entries').select('minutes').eq('date', d),
    s.from('habit_logs').select('value, habits!inner(slug)').eq('date', d).eq('habits.slug', 'exercise'),
  ])
  const bl = (ok(blocks) ?? []) as { id: string; key: string | null }[]
  const done = new Set(((ok(comps) ?? []) as { block_id: string }[]).map((c) => c.block_id))
  const studyMinutes = ((ok(entries) ?? []) as { minutes: number }[]).reduce((n, e) => n + e.minutes, 0)
  const exHabit = ((ok(ex) ?? []) as { value: number }[]).some((l) => Number(l.value) > 0)
  const dsaBlock = bl.find((b) => b.key === 'dsa')
  const exBlocks = bl.filter((b) => b.key === 'exercise')
  const min = computeMinimum({
    requiresDsa: !!dsaBlock,
    dsaDone: !!dsaBlock && done.has(dsaBlock.id),
    exerciseDone: exHabit || exBlocks.some((b) => done.has(b.id)),
    studyMinutes,
    minStudyMinutes: Number((ok(st) as any)?.min_study_hours ?? 5) * 60,
  })
  ok(await s.from('daily_status').upsert({ date: d, minimum_met: min.met, study_minutes: studyMinutes }, { onConflict: 'user_id,date' }))
  return { minimumMet: min.met, studyMinutes }
}

// ---------- Today: blocks, habits, night check ----------
const blockDone = z.object({
  blockId: z.string().uuid(), subKey: z.string().default(''), date, completed: z.boolean(),
  minutes: z.number().int().min(0).max(1440).optional(), note: z.string().max(500).optional(),
  subject: z.string(), isStudy: z.boolean(), key: z.string().nullable().optional(),
})
export async function setBlockDone(input: z.input<typeof blockDone>) {
  const v = blockDone.parse(input)
  const s = await ctx()
  ok(await s.from('block_completions').upsert(
    { block_id: v.blockId, sub_key: v.subKey, date: v.date, completed: v.completed, actual_minutes: v.completed ? v.minutes ?? null : null, note: v.note ?? null },
    { onConflict: 'user_id,block_id,sub_key,date' }))
  const source = `block:${v.blockId}:${v.subKey}`
  if (v.isStudy) {
    if (v.completed && (v.minutes ?? 0) > 0) {
      ok(await s.from('time_entries').upsert({ date: v.date, subject: v.subject, minutes: v.minutes!, note: v.note ?? null, source }, { onConflict: 'user_id,date,source' }))
    } else {
      ok(await s.from('time_entries').delete().eq('date', v.date).eq('source', source))
    }
  }
  if (v.key === 'exercise') { // keep the Exercise habit in sync with the exercise block
    const h = ok(await s.from('habits').select('id').eq('slug', 'exercise').maybeSingle()) as { id: string } | null
    if (h) {
      if (v.completed) ok(await s.from('habit_logs').upsert({ habit_id: h.id, date: v.date, value: v.minutes || 60 }, { onConflict: 'user_id,habit_id,date' }))
      else ok(await s.from('habit_logs').delete().eq('habit_id', h.id).eq('date', v.date))
    }
  }
  return recomputeDay(s, v.date)
}

export async function setHabitValue(input: { habitId: string; date: string; value: number; note?: string }) {
  const v = z.object({ habitId: z.string().uuid(), date, value: z.number().min(0).max(100000), note: z.string().max(200).optional() }).parse(input)
  const s = await ctx()
  if (v.value <= 0 && !v.note) ok(await s.from('habit_logs').delete().eq('habit_id', v.habitId).eq('date', v.date))
  else ok(await s.from('habit_logs').upsert({ habit_id: v.habitId, date: v.date, value: v.value, note: v.note ?? null }, { onConflict: 'user_id,habit_id,date' }))
  return recomputeDay(s, v.date)
}

export async function saveNightCheck(input: { date: string; regret: number; improve?: string; proud?: string }) {
  const v = z.object({ date, regret: z.number().int().min(1).max(5), improve: z.string().max(500).optional(), proud: z.string().max(500).optional() }).parse(input)
  const s = await ctx()
  ok(await s.from('night_checks').upsert({ date: v.date, regret_score: v.regret, improve_note: v.improve ?? null, proud_note: v.proud ?? null }, { onConflict: 'user_id,date' }))
}

// ---------- Schedule editing ----------
const blockInput = z.object({
  id: z.string().uuid().optional(), title: z.string().min(1).max(120), subject: z.string().min(1).max(40),
  start_time: z.string().regex(/^\d{2}:\d{2}$/), end_time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(0).max(6)).min(1), kind: z.enum(['habit', 'meal', 'chore', 'study', 'break', 'flex']), is_study: z.boolean(),
})
export async function saveBlock(input: z.input<typeof blockInput>) {
  const v = blockInput.parse(input)
  if (v.end_time <= v.start_time) throw new Error('End time must be after start time')
  const s = await ctx()
  const { id, ...row } = v
  if (id) ok(await s.from('schedule_blocks').update(row).eq('id', id))
  else ok(await s.from('schedule_blocks').insert(row))
}
export async function deleteBlock(id: string) {
  const s = await ctx()
  ok(await s.from('schedule_blocks').delete().eq('id', z.string().uuid().parse(id)))
}

// ---------- Tracker engine ----------
async function bumpSolveCount(s: S, trackerId: string, delta: number, d: string) {
  const t = ok(await s.from('trackers').select('key').eq('id', trackerId).single()) as { key: string }
  const cur = ok(await s.from('daily_solve_counts').select('count').eq('date', d).eq('tracker_key', t.key).maybeSingle()) as { count: number } | null
  ok(await s.from('daily_solve_counts').upsert({ date: d, tracker_key: t.key, count: Math.max(0, (cur?.count ?? 0) + delta) }, { onConflict: 'user_id,date,tracker_key' }))
  return t.key
}

/** After items change: if this is a roadmap day and it's complete, advance the pointer to the next unfinished day. */
async function advanceRoadmap(s: S, groupId: string): Promise<number | null> {
  const g = ok(await s.from('tracker_groups').select('id,tracker_id,meta,trackers!inner(key)').eq('id', groupId).single()) as any
  if (g.trackers.key !== 'dsa_roadmap') return null
  const [groups, items, st] = await Promise.all([
    s.from('tracker_groups').select('id,meta').eq('tracker_id', g.tracker_id),
    s.from('tracker_items').select('group_id,status').eq('tracker_id', g.tracker_id),
    s.from('settings').select('id,roadmap_current_day').single(),
  ])
  const settings = ok(st) as { id: string; roadmap_current_day: number }
  const byGroup = new Map<string, boolean>()
  for (const it of (ok(items) ?? []) as { group_id: string; status: string }[]) byGroup.set(it.group_id, (byGroup.get(it.group_id) ?? true) && DONE.includes(it.status))
  const dayDone = new Map<number, boolean>()
  for (const gr of (ok(groups) ?? []) as { id: string; meta: { day_number: number } }[]) dayDone.set(gr.meta.day_number, byGroup.get(gr.id) ?? false)
  const day = g.meta.day_number as number
  if (settings.roadmap_current_day !== day || !dayDone.get(day)) return null
  let next = day
  for (let d = day + 1; d <= 60; d++) if (!dayDone.get(d)) { next = d; break }
  if (next === day) return null // Day 60 / everything finished: the UI offers "Start CSES phase"
  ok(await s.from('settings').update({ roadmap_current_day: next }).eq('id', settings.id))
  return next
}

export async function setItemStatus(input: { itemId: string; status: string; today: string }) {
  const v = z.object({ itemId: z.string().uuid(), status, today: date }).parse(input)
  const s = await ctx()
  const it = ok(await s.from('tracker_items').select('id,tracker_id,group_id,status,times_solved').eq('id', v.itemId).single()) as any
  const wasDone = DONE.includes(it.status), nowDone = DONE.includes(v.status)
  const patch: Record<string, unknown> = { status: v.status }
  if (nowDone && !wasDone) {
    const now = new Date()
    Object.assign(patch, { completed_at: now.toISOString(), times_solved: it.times_solved + 1, next_revision_at: new Date(now.getTime() + 14 * 864e5).toISOString() })
  }
  if (!nowDone && wasDone) Object.assign(patch, { completed_at: null, next_revision_at: null })
  const item = ok(await s.from('tracker_items').update(patch).eq('id', v.itemId).select('*').single())
  if (nowDone !== wasDone) await bumpSolveCount(s, it.tracker_id, nowDone ? 1 : -1, v.today)
  const currentDay = await advanceRoadmap(s, it.group_id)
  return { item, currentDay }
}

export async function markGroupDone(input: { groupId: string; today: string }) {
  const v = z.object({ groupId: z.string().uuid(), today: date }).parse(input)
  const s = await ctx()
  const open = (ok(await s.from('tracker_items').select('id,tracker_id,times_solved').eq('group_id', v.groupId).not('status', 'in', '(done,mastered)')) ?? []) as any[]
  const now = new Date()
  for (const it of open) {
    ok(await s.from('tracker_items').update({ status: 'done', completed_at: now.toISOString(), times_solved: it.times_solved + 1, next_revision_at: new Date(now.getTime() + 14 * 864e5).toISOString() }).eq('id', it.id))
  }
  if (open.length) await bumpSolveCount(s, open[0].tracker_id, open.length, v.today)
  const currentDay = await advanceRoadmap(s, v.groupId)
  const items = ok(await s.from('tracker_items').select('*').eq('group_id', v.groupId).order('sort_order'))
  return { items, currentDay }
}

export async function setNeedsRevision(input: { itemId: string; value: boolean }) {
  const v = z.object({ itemId: z.string().uuid(), value: z.boolean() }).parse(input)
  const s = await ctx()
  ok(await s.from('tracker_items').update({ needs_revision: v.value }).eq('id', v.itemId))
}

export async function markRevised(itemId: string) {
  const id = z.string().uuid().parse(itemId)
  const s = await ctx()
  const it = ok(await s.from('tracker_items').select('revision_count').eq('id', id).single()) as { revision_count: number }
  const now = new Date()
  return ok(await s.from('tracker_items').update({
    needs_revision: false, last_revised_at: now.toISOString(), revision_count: it.revision_count + 1,
    next_revision_at: new Date(now.getTime() + nextRevisionDays(it.revision_count) * 864e5).toISOString(),
  }).eq('id', id).select('*').single())
}

export async function saveItemNotes(input: { itemId: string; notes: string }) {
  const v = z.object({ itemId: z.string().uuid(), notes: z.string().max(20000) }).parse(input)
  const s = await ctx()
  ok(await s.from('tracker_items').update({ notes: v.notes }).eq('id', v.itemId))
}

export async function addItem(input: { groupId: string; trackerId: string; title: string; difficulty?: string; link?: string }) {
  const v = z.object({ groupId: z.string().uuid(), trackerId: z.string().uuid(), title: z.string().min(1).max(200), difficulty: z.enum(['easy', 'medium', 'hard']).optional(), link: z.string().url().optional().or(z.literal('')) }).parse(input)
  const s = await ctx()
  const last = ok(await s.from('tracker_items').select('sort_order').eq('group_id', v.groupId).order('sort_order', { ascending: false }).limit(1)) as { sort_order: number }[]
  return ok(await s.from('tracker_items').insert({
    group_id: v.groupId, tracker_id: v.trackerId, title: v.title, difficulty: v.difficulty ?? null, link: v.link || null,
    slug: `u-${crypto.randomUUID().slice(0, 8)}`, sort_order: (last[0]?.sort_order ?? 0) + 1,
  }).select('*').single())
}
export async function deleteItem(itemId: string) {
  const s = await ctx()
  ok(await s.from('tracker_items').delete().eq('id', z.string().uuid().parse(itemId)))
}
export async function addGroup(input: { trackerId: string; name: string }) {
  const v = z.object({ trackerId: z.string().uuid(), name: z.string().min(1).max(120) }).parse(input)
  const s = await ctx()
  const last = ok(await s.from('tracker_groups').select('sort_order').eq('tracker_id', v.trackerId).order('sort_order', { ascending: false }).limit(1)) as { sort_order: number }[]
  return ok(await s.from('tracker_groups').insert({ tracker_id: v.trackerId, name: v.name, slug: `u-${crypto.randomUUID().slice(0, 8)}`, sort_order: (last[0]?.sort_order ?? 0) + 1 }).select('*').single())
}
export async function deleteGroup(groupId: string) {
  const s = await ctx()
  ok(await s.from('tracker_groups').delete().eq('id', z.string().uuid().parse(groupId)))
}

/** CSV/JSON import rows: group, title, difficulty, platform, link, notes. Skips duplicate titles within a group. */
export async function importItems(input: { trackerId: string; rows: { group: string; title: string; difficulty?: string; platform?: string; link?: string; notes?: string }[] }) {
  const v = z.object({
    trackerId: z.string().uuid(),
    rows: z.array(z.object({ group: z.string().min(1), title: z.string().min(1), difficulty: z.string().optional(), platform: z.string().optional(), link: z.string().optional(), notes: z.string().optional() })).max(2000),
  }).parse(input)
  const s = await ctx()
  const groups = (ok(await s.from('tracker_groups').select('id,name').eq('tracker_id', v.trackerId)) ?? []) as { id: string; name: string }[]
  const gid = new Map(groups.map((g) => [g.name.toLowerCase(), g.id]))
  const existing = new Set(((ok(await s.from('tracker_items').select('group_id,title').eq('tracker_id', v.trackerId)) ?? []) as any[]).map((i) => `${i.group_id}|${i.title.toLowerCase()}`))
  let added = 0, skipped = 0
  for (const r of v.rows) {
    let id = gid.get(r.group.toLowerCase())
    if (!id) {
      const g = ok(await s.from('tracker_groups').insert({ tracker_id: v.trackerId, name: r.group, slug: `u-${crypto.randomUUID().slice(0, 8)}`, sort_order: gid.size + 1 }).select('id').single()) as { id: string }
      id = g.id; gid.set(r.group.toLowerCase(), id)
    }
    const k = `${id}|${r.title.toLowerCase()}`
    if (existing.has(k)) { skipped++; continue }
    existing.add(k)
    const diff = ['easy', 'medium', 'hard'].includes((r.difficulty ?? '').toLowerCase()) ? r.difficulty!.toLowerCase() : null
    ok(await s.from('tracker_items').insert({ tracker_id: v.trackerId, group_id: id, title: r.title, difficulty: diff, platform: r.platform || null, link: r.link || null, notes: r.notes || null, slug: `i-${crypto.randomUUID().slice(0, 8)}`, sort_order: added }))
    added++
  }
  return { added, skipped }
}

// ---------- Roadmap + settings ----------
export async function setRoadmapDay(day: number) {
  const d = z.number().int().min(1).max(60).parse(day)
  const s = await ctx()
  const st = ok(await s.from('settings').select('id').single()) as { id: string }
  ok(await s.from('settings').update({ roadmap_current_day: d }).eq('id', st.id))
}
export async function setRoadmapFamily(input: { groupId: string; family: string }) {
  const v = z.object({ groupId: z.string().uuid(), family: z.string().min(1).max(40) }).parse(input)
  const s = await ctx()
  const g = ok(await s.from('tracker_groups').select('meta').eq('id', v.groupId).single()) as { meta: Record<string, unknown> }
  ok(await s.from('tracker_groups').update({ meta: { ...g.meta, family: v.family } }).eq('id', v.groupId))
}
export async function updateSettings(patch: Record<string, unknown>) {
  const v = z.object({
    timezone: z.string().min(1), time_format: z.enum(['12h', '24h']), study_hours_target: z.number().min(0).max(24), min_study_hours: z.number().min(0).max(24),
    water_target: z.number().int().min(0).max(10000), sleep_target: z.number().min(0).max(14), dsa_phase: z.enum(['roadmap', 'cses']),
    roadmap_current_day: z.number().int().min(1).max(60), days_per_week: z.number().int().min(1).max(7), cses_per_day: z.number().int().min(1).max(6),
    jobs_app_url: z.string().url().nullable().or(z.literal('').transform(() => null)),
    aws_cert: z.string().min(1).max(120), aws_exam_date: date.nullable(),
    sql_playlist_url: z.string().url().nullable().or(z.literal('').transform(() => null)),
    push_enabled: z.boolean(), embroidery_reminder_enabled: z.boolean(),
    embroidery_reminder_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  }).partial().strict().parse(patch)
  const s = await ctx()
  const st = ok(await s.from('settings').select('id').single()) as { id: string }
  ok(await s.from('settings').update(v).eq('id', st.id))
}
