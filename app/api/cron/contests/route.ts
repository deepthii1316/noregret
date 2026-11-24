import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { fetchUpcomingContests } from '@/lib/contests/adapters'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'Contest sync is not configured' }, { status: 503 })

  const db = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: settings, error } = await db.from('settings').select('user_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const sources = await fetchUpcomingContests()
  const syncedAt = new Date().toISOString()
  const failures: { userId: string; platform: string; error: string }[] = []
  for (const setting of settings ?? []) {
    for (const source of sources) {
      if (source.error) {
        failures.push({ userId: setting.user_id, platform: source.platform, error: source.error })
        continue
      }
      if (!source.contests.length) continue
      const { error: writeError } = await db.from('contests').upsert(source.contests.map((contest) => ({
        user_id: setting.user_id,
        platform: contest.platform,
        external_id: contest.externalId,
        name: contest.name,
        url: contest.url,
        start_time: contest.startTime,
        duration_minutes: contest.durationMinutes,
        synced_at: syncedAt,
        manual: false,
      })), { onConflict: 'user_id,platform,external_id' })
      if (writeError) failures.push({ userId: setting.user_id, platform: source.platform, error: writeError.message })
    }
  }
  return NextResponse.json({ syncedAt, sources: sources.map(({ platform, contests, error: sourceError }) => ({ platform, count: contests.length, error: sourceError })), failures })
}
