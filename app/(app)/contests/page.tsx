import { createClient } from '@/lib/supabase/server'
import { addDays, todayIn } from '@/lib/time'
import { getSettings, tzOf } from '@/lib/data'
import { ContestClient } from '@/components/contests/contest-client'

export default async function ContestsPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const today = todayIn(tzOf(settings))
  const from = new Date(`${addDays(today, -90)}T00:00:00Z`).toISOString()
  const to = new Date(`${addDays(today, 120)}T00:00:00Z`).toISOString()
  const [contestResult, resultResult, upsolveResult] = await Promise.all([
    s.from('contests').select('*').gte('start_time', from).lte('start_time', to).order('start_time'),
    s.from('contest_results').select('*').order('created_at', { ascending: true }),
    s.from('upsolve_items').select('*,contests(name,platform)').neq('status', 'done').order('created_at', { ascending: false }),
  ])
  for (const result of [contestResult, resultResult, upsolveResult]) if (result.error) throw new Error(result.error.message)
  return <ContestClient today={today} contests={contestResult.data ?? []} results={resultResult.data ?? []} upsolves={upsolveResult.data ?? []} />
}
