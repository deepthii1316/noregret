/**
 * Idempotent seed. Run: npm run seed
 * Keyed by stable slugs, so re-running never duplicates rows or resets progress
 * (only inserts what is missing and refreshes titles/links of roadmap problems).
 */
import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'
import { SCHEDULE, HABITS, TRACKERS, EXPLORE_TOPICS, slugify } from '../lib/seed-data'
import { parseRoadmap } from '../lib/roadmap'
import { todayIn, DEFAULT_TZ } from '../lib/time'
import { CSES_PRIORITY } from '../lib/cses'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
const email = process.env.SEED_USER_EMAIL!
if (!url || !key || !email) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_EMAIL in .env.local')
const db = createClient(url, key, { auth: { persistSession: false } })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function must(p: PromiseLike<{ data: any; error: any }>, what: string): Promise<any> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

async function main() {
  const { data: users, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) throw error
  const user = users.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No auth user with email ${email}. Create the owner account in Supabase Auth first.`)
  const uid = user.id
  console.log('Seeding for', email)

  // settings (only created once; never overwritten)
  await must(db.from('settings').upsert({ user_id: uid, roadmap_started_on: todayIn(DEFAULT_TZ), cses_priority: CSES_PRIORITY }, { onConflict: 'user_id', ignoreDuplicates: true }), 'settings')

  // schedule
  await must(db.from('schedule_blocks').upsert(
    SCHEDULE.map((s, i) => ({
      user_id: uid, seed_slug: s.slug, key: s.key ?? null, title: s.title, subject: s.subject,
      start_time: s.start, end_time: s.end, days: s.days, kind: s.kind, is_study: !!s.study,
      flex_by_day: s.flex ?? null, sort_order: i,
    })),
    { onConflict: 'user_id,seed_slug', ignoreDuplicates: true },
  ), 'schedule_blocks')

  // habits
  await must(db.from('habits').upsert(
    HABITS.map((h, i) => ({ user_id: uid, slug: h.slug, name: h.name, type: h.type, target: h.target ?? null, unit: h.unit ?? null, category: h.category, sort_order: i })),
    { onConflict: 'user_id,slug', ignoreDuplicates: true },
  ), 'habits')

  // generic trackers
  for (const [ti, t] of TRACKERS.entries()) {
    await must(db.from('trackers').upsert({ user_id: uid, key: t.key, name: t.name, icon: t.icon, sort_order: ti }, { onConflict: 'user_id,key', ignoreDuplicates: true }), `tracker ${t.key}`)
    const tr = await must(db.from('trackers').select('id').eq('user_id', uid).eq('key', t.key).single(), 'tracker id')
    for (const [gi, g] of t.groups.entries()) {
      const gslug = slugify(g.name)
      await must(db.from('tracker_groups').upsert({ user_id: uid, tracker_id: tr.id, slug: gslug, name: g.name, sort_order: gi }, { onConflict: 'user_id,tracker_id,slug', ignoreDuplicates: true }), 'group')
      const grp = await must(db.from('tracker_groups').select('id').eq('user_id', uid).eq('tracker_id', tr.id).eq('slug', gslug).single(), 'group id')
      await must(db.from('tracker_items').upsert(
        g.items.map((title, i) => ({ user_id: uid, tracker_id: tr.id, group_id: grp.id, slug: `${gslug}-${i + 1}`, title, sort_order: i })),
        { onConflict: 'user_id,tracker_id,slug', ignoreDuplicates: true },
      ), 'items')
    }
  }

  await must(db.from('explore_topics').upsert(
    EXPLORE_TOPICS.map((title, i) => ({ user_id: uid, title, sort_order: i })),
    { onConflict: 'user_id,title', ignoreDuplicates: true },
  ), 'explore topics')

  // DSA roadmap: one group per day, one item per problem, stable slug d01-p1 ...
  const roadmap = parseRoadmap(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'seed/dsa-roadmap.json'), 'utf8')))
  await must(db.from('trackers').upsert({ user_id: uid, key: 'dsa_roadmap', name: roadmap.name, icon: 'Route', sort_order: 100 }, { onConflict: 'user_id,key', ignoreDuplicates: true }), 'roadmap tracker')
  const rt = await must(db.from('trackers').select('id').eq('user_id', uid).eq('key', 'dsa_roadmap').single(), 'roadmap id')
  for (const d of roadmap.days) {
    const gslug = `day-${String(d.day).padStart(2, '0')}`
    // New groups get meta; existing groups only refresh topic/focus/resources, keeping an edited family.
    const existing = await must(db.from('tracker_groups').select('id,meta').eq('user_id', uid).eq('tracker_id', rt.id).eq('slug', gslug).maybeSingle(), 'group lookup')
    const meta = { day_number: d.day, topic: d.topic, focus: d.focus, resources: d.resources, family: (existing?.meta as any)?.family ?? d.family }
    const grp = await must(db.from('tracker_groups').upsert({ user_id: uid, tracker_id: rt.id, slug: gslug, name: `Day ${d.day}: ${d.topic}`, meta, sort_order: d.day }, { onConflict: 'user_id,tracker_id,slug' }).select('id').single(), 'roadmap group')
    // Progress columns (status, notes, ...) are omitted so an upsert never resets them.
    await must(db.from('tracker_items').upsert(
      d.problems.map((p) => ({ user_id: uid, tracker_id: rt.id, group_id: grp.id, slug: p.slug, title: p.title, difficulty: p.difficulty, label: p.label, platform: p.platform, link: p.url, sort_order: p.order })),
      { onConflict: 'user_id,tracker_id,slug' },
    ), 'roadmap items')
  }
  console.log(`Done: ${SCHEDULE.length} blocks, ${HABITS.length} habits, ${TRACKERS.length + 1} trackers, ${roadmap.days.length} roadmap days, ${EXPLORE_TOPICS.length} explore topics.`)
}
main().catch((e) => { console.error(e); process.exit(1) })
