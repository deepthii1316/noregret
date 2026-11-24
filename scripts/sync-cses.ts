import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { CSES_PRIORITY, orderCsesSections, parseCsesProblemSet } from '../lib/cses'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.SEED_USER_EMAIL
if (!url || !key || !email) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_EMAIL')
const ownerEmail = email.toLowerCase()

const db = createClient(url, key, { auth: { persistSession: false } })
function must<T>(result: { data: T; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`)
  return result.data
}
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)

async function main() {
  const response = await fetch('https://cses.fi/problemset/list/', {
    headers: { 'User-Agent': 'NoRegret study tracker (polite one-time problem list sync)' },
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new Error(`CSES returned HTTP ${response.status}`)
  const sections = parseCsesProblemSet(await response.text())

  const { data: users, error: usersError } = await db.auth.admin.listUsers({ perPage: 200 })
  if (usersError) throw usersError
  const user = users.users.find((candidate) => candidate.email?.toLowerCase() === ownerEmail)
  if (!user) throw new Error(`No auth user with email ${ownerEmail}`)
  const { data: settings, error: settingsError } = await db.from('settings').select('cses_priority').eq('user_id', user.id).maybeSingle()
  if (settingsError) throw settingsError
  const ordered = orderCsesSections(sections, settings?.cses_priority?.length ? settings.cses_priority : CSES_PRIORITY)
  const tracker = must(await db.from('trackers').upsert({
    user_id: user.id, key: 'cses', name: 'CSES', icon: 'Code', sort_order: 101,
  }, { onConflict: 'user_id,key' }).select('id').single(), 'CSES tracker')
  if (!tracker) throw new Error('CSES tracker upsert returned no row')

  let total = 0
  for (const [sectionIndex, section] of ordered.entries()) {
    const sectionSlug = slug(section.name)
    const group = must(await db.from('tracker_groups').upsert({
      user_id: user.id, tracker_id: tracker.id, slug: sectionSlug, name: section.name,
      sort_order: sectionIndex, meta: { priority: sectionIndex + 1 },
    }, { onConflict: 'user_id,tracker_id,slug' }).select('id').single(), `CSES group ${section.name}`)
    if (!group) throw new Error(`CSES group upsert returned no row for ${section.name}`)
    const rows = section.problems.map((problem, index) => ({
      user_id: user.id, tracker_id: tracker.id, group_id: group.id, slug: `cses-${problem.id}`,
      external_id: problem.id, title: problem.title, platform: 'CSES', link: problem.url, sort_order: index,
    }))
    if (rows.length) must(await db.from('tracker_items').upsert(rows, {
      onConflict: 'user_id,tracker_id,slug', ignoreDuplicates: false,
    }), `CSES problems in ${section.name}`)
    total += rows.length
  }
  must(await db.from('settings').update({ cses_priority: ordered.map((section) => section.name) }).eq('user_id', user.id), 'CSES priority')
  console.log(`Synced ${total} CSES problems across ${ordered.length} sections.`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
