import { createClient } from '@/lib/supabase/server'
import { getReviseQueue, getSettings, tzOf, type Group, type Item } from '@/lib/data'
import { todayIn } from '@/lib/time'
import { RoadmapClient } from '@/components/roadmap/roadmap-client'

export default async function RoadmapPage() {
  const s = await createClient()
  const st = (await getSettings(s))!
  const today = todayIn(tzOf(st))
  const { data: tracker } = await s.from('trackers').select('id').eq('key', 'dsa_roadmap').maybeSingle()
  if (!tracker) return <div className="card p-8 text-center sub">The roadmap is not seeded yet. Run <code>npm run seed</code>.</div>
  const [g, i, revise] = await Promise.all([
    s.from('tracker_groups').select('*').eq('tracker_id', tracker.id).order('sort_order'),
    s.from('tracker_items').select('*').eq('tracker_id', tracker.id).order('sort_order'),
    getReviseQueue(s),
  ])
  return (
    <RoadmapClient groups={(g.data ?? []) as Group[]} initialItems={(i.data ?? []) as Item[]} revise={revise}
      settings={{ currentDay: st.roadmap_current_day, startedOn: st.roadmap_started_on ?? today, daysPerWeek: st.days_per_week, phase: st.dsa_phase }} today={today} />
  )
}
