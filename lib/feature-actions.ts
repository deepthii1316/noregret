'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { CSES_PRIORITY, orderCsesSections, parseCsesProblemSet, type CsesSection } from '@/lib/cses'
import { parseCsv } from '@/lib/csv'
import { fetchUpcomingContests } from '@/lib/contests/adapters'

async function ctx() {
  const s = await createClient()
  const { data: { user }, error } = await s.auth.getUser()
  if (error) throw new Error(error.message)
  if (!user) throw new Error('Not signed in')
  return s
}

function must<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return r.data
}

const uuid = z.string().uuid()
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const optionalUrl = z.string().url().or(z.literal('')).transform((value) => value || null).optional()
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

async function saveCsesSections(s: Awaited<ReturnType<typeof ctx>>, sections: CsesSection[]) {
  const { data: settings } = await s.from('settings').select('cses_priority').maybeSingle()
  const configured = (settings?.cses_priority as string[] | null) ?? []
  const ordered = orderCsesSections(sections, configured.length ? configured : CSES_PRIORITY)
  const tracker = must(await s.from('trackers')
    .upsert({ key: 'cses', name: 'CSES', icon: 'Code', sort_order: 101 }, { onConflict: 'user_id,key' })
    .select('id').single()) as { id: string }

  for (const [sectionIndex, section] of ordered.entries()) {
    const sectionSlug = slug(section.name)
    const group = must(await s.from('tracker_groups').upsert({
      tracker_id: tracker.id,
      slug: sectionSlug,
      name: section.name,
      sort_order: sectionIndex,
      meta: { priority: sectionIndex + 1 },
    }, { onConflict: 'user_id,tracker_id,slug' }).select('id').single()) as { id: string }

    const rows = section.problems.map((problem, index) => ({
      tracker_id: tracker.id,
      group_id: group.id,
      slug: `cses-${problem.id}`,
      external_id: problem.id,
      title: problem.title,
      platform: 'CSES',
      link: problem.url,
      sort_order: index,
    }))
    if (rows.length) must(await s.from('tracker_items').upsert(rows, { onConflict: 'user_id,tracker_id,slug', ignoreDuplicates: false }))
  }
  must(await s.from('settings').update({ cses_priority: ordered.map((section) => section.name) }))
  return { sections: ordered.length, problems: ordered.reduce((sum, section) => sum + section.problems.length, 0) }
}

export async function syncCsesList() {
  const s = await ctx()
  const response = await fetch('https://cses.fi/problemset/list/', {
    cache: 'no-store',
    headers: { 'User-Agent': 'NoRegret study tracker (polite one-time problem list sync)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`CSES returned HTTP ${response.status}`)
  return saveCsesSections(s, parseCsesProblemSet(await response.text()))
}

export async function importCsesCsv(text: string) {
  const csv = z.string().min(1).max(2_000_000).parse(text)
  const [header, ...body] = parseCsv(csv)
  if (!header) throw new Error('CSV is empty')
  const column = (name: string) => header.findIndex((value) => value.trim().toLowerCase() === name)
  const [groupColumn, titleColumn, urlColumn] = ['group', 'title', 'url'].map(column)
  if (groupColumn < 0 || titleColumn < 0 || urlColumn < 0) throw new Error('CSV needs tracker, group, title, and url columns')
  const at = (row: string[], index: number) => (row[index] ?? '').trim()
  const grouped = new Map<string, CsesSection>()
  for (const row of body) {
    const group = at(row, groupColumn)
    const title = at(row, titleColumn)
    const url = at(row, urlColumn)
    const id = url.match(/\/problemset\/task\/(\d+)/)?.[1]
    if (!group || !title || !id) continue
    const section = grouped.get(group) ?? { name: group, problems: [] }
    if (!section.problems.some((problem) => problem.id === id)) section.problems.push({ id, title, url: `https://cses.fi/problemset/task/${id}` })
    grouped.set(group, section)
  }
  if (!grouped.size) throw new Error('No valid rows. URLs must contain /problemset/task/<id>.')
  return saveCsesSections(await ctx(), [...grouped.values()])
}

export async function saveCsesPriority(names: string[]) {
  const order = z.array(z.string().min(1).max(100)).max(100).parse(names)
  const s = await ctx()
  must(await s.from('settings').update({ cses_priority: order }))
  const { data: tracker } = await s.from('trackers').select('id').eq('key', 'cses').maybeSingle()
  if (tracker) {
    for (const [index, name] of order.entries()) {
      must(await s.from('tracker_groups').update({ sort_order: index }).eq('tracker_id', tracker.id).eq('name', name))
    }
  }
}

export async function reorderTrackerItems(input: { groupId: string; itemIds: string[] }) {
  const v = z.object({ groupId: uuid, itemIds: z.array(uuid).max(500) }).parse(input)
  const s = await ctx()
  for (const [index, itemId] of v.itemIds.entries()) {
    must(await s.from('tracker_items').update({ sort_order: index }).eq('id', itemId).eq('group_id', v.groupId))
  }
}

export async function reorderTrackerGroups(input: { trackerId: string; groupIds: string[] }) {
  const v = z.object({ trackerId: uuid, groupIds: z.array(uuid).max(200) }).parse(input)
  const s = await ctx()
  for (const [index, groupId] of v.groupIds.entries()) {
    must(await s.from('tracker_groups').update({ sort_order: index }).eq('id', groupId).eq('tracker_id', v.trackerId))
  }
}

export async function savePracticeTest(input: { id?: string; trackerKey: 'aws' | 'ml' | 'sql'; date: string; source: string; score?: number | null; weakTopics?: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), trackerKey: z.enum(['aws', 'ml', 'sql']), date: day,
    source: z.string().min(1).max(200), score: z.number().min(0).max(100).nullable().optional(),
    weakTopics: z.string().max(2000).optional(), notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = { tracker_key: v.trackerKey, date: v.date, source: v.source, score: v.score ?? null, weak_topics: v.weakTopics ?? null, notes: v.notes ?? null }
  return must(await (v.id
    ? s.from('practice_tests').update(row).eq('id', v.id)
    : s.from('practice_tests').insert(row)).select('*').single())
}

export async function deletePracticeTest(id: string) {
  const s = await ctx()
  must(await s.from('practice_tests').delete().eq('id', uuid.parse(id)))
}

export async function saveLearningResource(input: { id?: string; trackerKey: 'ml' | 'sql'; title: string; kind: string; url?: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), trackerKey: z.enum(['ml', 'sql']), title: z.string().min(1).max(200),
    kind: z.enum(['course', 'paper', 'notebook', 'playlist', 'other']), url: optionalUrl,
    notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = { tracker_key: v.trackerKey, title: v.title, kind: v.kind, url: v.url ?? null, notes: v.notes ?? null }
  return must(await (v.id
    ? s.from('learning_resources').update(row).eq('id', v.id)
    : s.from('learning_resources').insert(row)).select('*').single())
}

export async function setLearningResourceDone(id: string, completed: boolean) {
  const s = await ctx()
  must(await s.from('learning_resources').update({ completed: z.boolean().parse(completed) }).eq('id', uuid.parse(id)))
}

export async function deleteLearningResource(id: string) {
  const s = await ctx()
  must(await s.from('learning_resources').delete().eq('id', uuid.parse(id)))
}

export async function saveProject(input: { id?: string; name: string; repoUrl?: string; status: string; stack?: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), name: z.string().min(1).max(200), repoUrl: optionalUrl,
    status: z.enum(['idea', 'building', 'shipped']), stack: z.string().max(300).optional(), notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = { name: v.name, repo_url: v.repoUrl ?? null, status: v.status, stack: v.stack ?? null, notes: v.notes ?? null }
  return must(await (v.id ? s.from('projects').update(row).eq('id', v.id) : s.from('projects').insert(row)).select('*').single())
}

export async function deleteProject(id: string) {
  const s = await ctx()
  must(await s.from('projects').delete().eq('id', uuid.parse(id)))
}

export async function saveContribution(input: { id?: string; projectId?: string; repository: string; issueUrl?: string; status: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), projectId: uuid.optional(), repository: z.string().min(1).max(200),
    issueUrl: optionalUrl, status: z.enum(['exploring', 'in_progress', 'submitted', 'merged']),
    notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = { project_id: v.projectId ?? null, repository: v.repository, issue_url: v.issueUrl ?? null, status: v.status, notes: v.notes ?? null }
  return must(await (v.id ? s.from('contributions').update(row).eq('id', v.id) : s.from('contributions').insert(row)).select('*').single())
}

export async function saveGoodFirstIssue(input: { id?: string; repository: string; issueUrl: string; notes?: string }) {
  const v = z.object({ id: uuid.optional(), repository: z.string().min(1).max(200), issueUrl: z.string().url(), notes: z.string().max(2000).optional() }).parse(input)
  const s = await ctx()
  const row = { repository: v.repository, issue_url: v.issueUrl, notes: v.notes ?? null }
  return must(await (v.id ? s.from('good_first_issues').update(row).eq('id', v.id) : s.from('good_first_issues').insert(row)).select('*').single())
}

export async function setGoodFirstIssueStatus(id: string, status: 'watching' | 'claimed' | 'dismissed') {
  const s = await ctx()
  must(await s.from('good_first_issues').update({ status: z.enum(['watching', 'claimed', 'dismissed']).parse(status) }).eq('id', uuid.parse(id)))
}

export async function deleteFeatureRow(table: 'contributions' | 'good_first_issues', id: string) {
  const s = await ctx()
  must(await s.from(table).delete().eq('id', uuid.parse(id)))
}

export async function setContestAttending(id: string, attending: boolean) {
  const s = await ctx()
  must(await s.from('contests').update({ attending: z.boolean().parse(attending) }).eq('id', uuid.parse(id)))
}

export async function syncUpcomingContests() {
  const s = await ctx()
  const results = await fetchUpcomingContests()
  const syncedAt = new Date().toISOString()
  for (const result of results) {
    if (!result.contests.length) continue
    must(await s.from('contests').upsert(result.contests.map((contest) => ({
      platform: contest.platform,
      external_id: contest.externalId,
      name: contest.name,
      url: contest.url,
      start_time: contest.startTime,
      duration_minutes: contest.durationMinutes,
      synced_at: syncedAt,
      manual: false,
    })), { onConflict: 'user_id,platform,external_id', ignoreDuplicates: false }))
  }
  return results.map(({ platform, contests, error }) => ({ platform, count: contests.length, error }))
}

export async function addManualContest(input: { platform: string; name: string; url: string; startTime: string; durationMinutes: number }) {
  const v = z.object({
    platform: z.string().min(1).max(50), name: z.string().min(1).max(200), url: z.string().url(),
    startTime: z.string().datetime(), durationMinutes: z.number().int().min(1).max(10080),
  }).parse(input)
  const s = await ctx()
  return must(await s.from('contests').upsert({
    platform: v.platform, external_id: `manual-${crypto.randomUUID()}`, name: v.name,
    url: v.url, start_time: v.startTime, duration_minutes: v.durationMinutes, manual: true,
  }, { onConflict: 'user_id,platform,external_id' }).select('*').single())
}

export async function saveContestResult(input: { contestId: string; rank?: string; ratingChange?: number | null; solved: number; total: number; notes?: string }) {
  const v = z.object({
    contestId: uuid, rank: z.string().max(50).optional(), ratingChange: z.number().int().nullable().optional(),
    solved: z.number().int().min(0), total: z.number().int().min(0), notes: z.string().max(4000).optional(),
  }).refine((value) => value.total === 0 || value.solved <= value.total, 'Solved cannot exceed total').parse(input)
  const s = await ctx()
  return must(await s.from('contest_results').upsert({
    contest_id: v.contestId, rank: v.rank ?? null, rating_change: v.ratingChange ?? null,
    solved: v.solved, total: v.total, notes: v.notes ?? null,
  }, { onConflict: 'contest_id' }).select('*').single())
}

export async function saveUpsolve(input: { id?: string; contestId: string; title: string; url?: string; status?: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), contestId: uuid, title: z.string().min(1).max(200), url: optionalUrl,
    status: z.enum(['todo', 'doing', 'done']).optional(), notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = { contest_id: v.contestId, title: v.title, url: v.url ?? null, status: v.status ?? 'todo', notes: v.notes ?? null }
  return must(await (v.id ? s.from('upsolve_items').update(row).eq('id', v.id) : s.from('upsolve_items').insert(row)).select('*').single())
}

export async function setUpsolveStatus(id: string, status: 'todo' | 'doing' | 'done') {
  const s = await ctx()
  must(await s.from('upsolve_items').update({ status: z.enum(['todo', 'doing', 'done']).parse(status) }).eq('id', uuid.parse(id)))
}

export async function deleteUpsolve(id: string) {
  const s = await ctx()
  must(await s.from('upsolve_items').delete().eq('id', uuid.parse(id)))
}

export async function saveExploreTopic(input: { id?: string; title: string; status: string; notes?: string; resources?: string; keyLearnings?: string }) {
  const v = z.object({
    id: uuid.optional(), title: z.string().min(1).max(200), status: z.enum(['idea', 'exploring', 'explored']),
    notes: z.string().max(4000).optional(), resources: z.string().max(4000).optional(), keyLearnings: z.string().max(12000).optional(),
  }).parse(input)
  const resources = (v.resources ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, url] = line.split('|').map((part) => part.trim())
    return { name: name ?? '', url: url ?? '' }
  })
  const s = await ctx()
  const row = { title: v.title, status: v.status, notes: v.notes ?? null, resources, key_learnings: v.keyLearnings ?? null }
  return must(await (v.id ? s.from('explore_topics').update(row).eq('id', v.id) : s.from('explore_topics').insert(row)).select('*').single())
}

export async function saveExploreSession(input: { topicId: string; date: string; minutes: number; notes?: string }) {
  const v = z.object({ topicId: uuid, date: day, minutes: z.number().int().min(1).max(1440), notes: z.string().max(2000).optional() }).parse(input)
  const s = await ctx()
  return must(await s.from('explore_sessions').insert({ topic_id: v.topicId, date: v.date, minutes: v.minutes, notes: v.notes ?? null }).select('*').single())
}

export async function deleteExploreTopic(id: string) {
  const s = await ctx()
  must(await s.from('explore_topics').delete().eq('id', uuid.parse(id)))
}

export async function saveBlogPost(input: { id?: string; title: string; status: string; draft?: string; targetDate?: string; publishedUrl?: string }) {
  const v = z.object({
    id: uuid.optional(), title: z.string().min(1).max(200), status: z.enum(['idea', 'drafting', 'ready', 'published']),
    draft: z.string().max(30000).optional(), targetDate: day.optional(), publishedUrl: optionalUrl,
  }).parse(input)
  const s = await ctx()
  const row = { title: v.title, status: v.status, draft: v.draft ?? null, target_date: v.targetDate ?? null, published_url: v.publishedUrl ?? null }
  return must(await (v.id ? s.from('blog_posts').update(row).eq('id', v.id) : s.from('blog_posts').insert(row)).select('*').single())
}

export async function deleteBlogPost(id: string) {
  const s = await ctx()
  must(await s.from('blog_posts').delete().eq('id', uuid.parse(id)))
}

export async function saveWeeklyReview(input: { weekStart: string; wentWell?: string; toFix?: string; priorities: string[] }) {
  const v = z.object({
    weekStart: day, wentWell: z.string().max(5000).optional(), toFix: z.string().max(5000).optional(),
    priorities: z.array(z.string().max(500)).max(3),
  }).parse(input)
  const s = await ctx()
  return must(await s.from('weekly_reviews').upsert({
    week_start: v.weekStart, went_well: v.wentWell ?? null, to_fix: v.toFix ?? null, priorities: v.priorities,
  }, { onConflict: 'user_id,week_start' }).select('*').single())
}

export async function savePushSubscription(input: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const v = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }) }).parse(input)
  const s = await ctx()
  must(await s.from('push_subscriptions').upsert({
    endpoint: v.endpoint, p256dh: v.keys.p256dh, auth: v.keys.auth,
  }, { onConflict: 'user_id,endpoint' }))
  must(await s.from('settings').update({ push_enabled: true }))
}

export async function deletePushSubscription(endpoint: string) {
  const s = await ctx()
  must(await s.from('push_subscriptions').delete().eq('endpoint', z.string().url().parse(endpoint)))
  const { count, error } = await s.from('push_subscriptions').select('id', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  if (count === 0) must(await s.from('settings').update({ push_enabled: false }))
}

export async function disablePushReminders() {
  const s = await ctx()
  must(await s.from('push_subscriptions').delete().not('id', 'is', null))
  must(await s.from('settings').update({ push_enabled: false }))
}

export async function saveEmbroideryOrder(input: { id?: string; orderDate: string; customer: string; design: string; price: number; materialCost: number; otherCost: number; status: string; notes?: string }) {
  const v = z.object({
    id: uuid.optional(), orderDate: day, customer: z.string().min(1).max(200), design: z.string().min(1).max(300),
    price: z.number().min(0).max(1_000_000), materialCost: z.number().min(0).max(1_000_000),
    otherCost: z.number().min(0).max(1_000_000), status: z.enum(['pending', 'in_progress', 'delivered', 'paid']),
    notes: z.string().max(4000).optional(),
  }).parse(input)
  const s = await ctx()
  const row = {
    order_date: v.orderDate, customer: v.customer, design: v.design, price: v.price,
    material_cost: v.materialCost, other_cost: v.otherCost, status: v.status, notes: v.notes ?? null,
  }
  return must(await (v.id ? s.from('embroidery_orders').update(row).eq('id', v.id) : s.from('embroidery_orders').insert(row)).select('*').single())
}

export async function deleteEmbroideryOrder(id: string) {
  const s = await ctx()
  must(await s.from('embroidery_orders').delete().eq('id', uuid.parse(id)))
}

export async function saveEmbroideryPost(input: { postDate: string; platform: string; url?: string; note?: string }) {
  const v = z.object({ postDate: day, platform: z.string().min(1).max(50), url: optionalUrl, note: z.string().max(2000).optional() }).parse(input)
  const s = await ctx()
  return must(await s.from('embroidery_post_logs').insert({
    post_date: v.postDate, platform: v.platform, url: v.url ?? null, note: v.note ?? null,
  }).select('*').single())
}
