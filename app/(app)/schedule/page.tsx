import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf } from '@/lib/data'
import { hhmm, todayIn, weekdayOf } from '@/lib/time'
import type { Block } from '@/lib/schedule'
import { ScheduleEditor } from '@/components/schedule-editor'

export default async function SchedulePage() {
  const s = await createClient()
  const st = await getSettings(s)
  const { data } = await s.from('schedule_blocks').select('*').order('start_time')
  const blocks = ((data ?? []) as Block[]).map((b) => ({ ...b, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) }))
  return <ScheduleEditor initial={blocks} format={st?.time_format ?? '12h'} todayDow={weekdayOf(todayIn(tzOf(st)))} />
}
