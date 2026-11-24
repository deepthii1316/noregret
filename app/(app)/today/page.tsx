import { createClient } from '@/lib/supabase/server'
import { getReviseQueue, getSettings, tzOf, type Item } from '@/lib/data'
import { addDays, hhmm, minutesNowIn, todayIn, weekdayOf } from '@/lib/time'
import { blocksForWeekday, type Block } from '@/lib/schedule'
import type { Habit, HabitLog } from '@/lib/habits'
import { TodayClient } from '@/components/today/today-client'

export default async function TodayPage() {
  const s = await createClient()
  const st = (await getSettings(s))!
  const tz = tzOf(st)
  const today = todayIn(tz)
  const dow = weekdayOf(today)

  const [blocksR, compsR, entriesR, habitsR, logsR, nightR, metR] = await Promise.all([
    s.from('schedule_blocks').select('*').contains('days', [dow]),
    s.from('block_completions').select('block_id,sub_key,completed,actual_minutes').eq('date', today).eq('completed', true),
    s.from('time_entries').select('source,minutes').eq('date', today),
    s.from('habits').select('*').eq('active', true).order('sort_order'),
    s.from('habit_logs').select('habit_id,date,value,note').eq('date', today),
    s.from('night_checks').select('regret_score,improve_note,proud_note').eq('date', today).maybeSingle(),
    s.from('daily_status').select('date').eq('minimum_met', true).gte('date', addDays(today, -400)).lt('date', today),
  ])
  const blocks = blocksForWeekday(((blocksR.data ?? []) as Block[]).map((b) => ({ ...b, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) })), dow)
  const entries = (entriesR.data ?? []) as { source: string; minutes: number }[]
  const otherMinutes = entries.filter((e) => !e.source.startsWith('block:')).reduce((n, e) => n + e.minutes, 0)
  const habits = ((habitsR.data ?? []) as Habit[]).filter((h) => h.schedule.includes(dow))

  // DSA card: only on days that have a DSA block
  let dsa = null as null | { phase: 'roadmap' | 'cses'; day: number; topic: string; focus: string; resources: { name: string; url: string }[]; items: Item[] }
  if (blocks.some((b) => b.key === 'dsa')) {
    if (st.dsa_phase === 'roadmap') {
      const { data: g } = await s.from('tracker_groups').select('id,meta,trackers!inner(key)').eq('trackers.key', 'dsa_roadmap').eq('meta->>day_number', String(st.roadmap_current_day)).maybeSingle()
      if (g) {
        const { data: items } = await s.from('tracker_items').select('*').eq('group_id', g.id).order('sort_order')
        const m = g.meta as any
        dsa = { phase: 'roadmap', day: st.roadmap_current_day, topic: m.topic, focus: m.focus, resources: m.resources ?? [], items: (items ?? []) as Item[] }
      }
    } else {
      const { data: tracker } = await s.from('trackers').select('id').eq('key', 'cses').maybeSingle()
      if (tracker) {
        const [{ data: groups }, { data: items }] = await Promise.all([
          s.from('tracker_groups').select('id,name,sort_order').eq('tracker_id', tracker.id).order('sort_order'),
          s.from('tracker_items').select('*').eq('tracker_id', tracker.id).not('status', 'in', '(done,mastered)'),
        ])
        const groupList = (groups ?? []) as { id: string; name: string; sort_order: number }[]
        const groupOrder = new Map(groupList.map((group) => [group.id, group.sort_order]))
        const groupNames = new Map(groupList.map((group) => [group.id, group.name]))
        const queue = ((items ?? []) as Item[])
          .sort((a, b) => (groupOrder.get(a.group_id) ?? 999) - (groupOrder.get(b.group_id) ?? 999) || a.sort_order - b.sort_order)
          .slice(0, st.cses_per_day)
          .map((item) => ({ ...item, label: groupNames.get(item.group_id) ?? item.label }))
        dsa = { phase: 'cses', day: 0, topic: 'CSES daily queue', focus: queue.length ? 'Next unsolved problems in your priority order.' : 'No unsolved problems remain in the synced list.', resources: [], items: queue }
      } else {
        dsa = { phase: 'cses', day: 0, topic: 'CSES problem set not synced', focus: 'Sync the list from Settings to start your queue.', resources: [], items: [] }
      }
    }
  }
  const revise = await getReviseQueue(s)

  return (
    <TodayClient
      date={today} tz={tz} timeFormat={st.time_format} dow={dow} initialNowMin={minutesNowIn(tz)}
      blocks={blocks} completions={(compsR.data ?? []) as any} otherMinutes={otherMinutes}
      habits={habits} habitLogs={(logsR.data ?? []) as HabitLog[]} night={nightR.data as any}
      pastMetDates={((metR.data ?? []) as { date: string }[]).map((r) => r.date)}
      minStudyMinutes={Number(st.min_study_hours) * 60} studyTargetMinutes={Number(st.study_hours_target) * 60}
      jobsUrl={st.jobs_app_url} dsa={dsa} revise={revise}
    />
  )
}
