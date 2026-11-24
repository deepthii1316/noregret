import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf } from '@/lib/data'
import { addDays, todayIn } from '@/lib/time'
import type { Habit, HabitLog } from '@/lib/habits'
import { HabitsClient } from '@/components/habits-client'

export default async function HabitsPage() {
  const s = await createClient()
  const today = todayIn(tzOf(await getSettings(s)))
  const [h, l] = await Promise.all([
    s.from('habits').select('*').eq('category', 'health').eq('active', true).order('sort_order'),
    s.from('habit_logs').select('habit_id,date,value,note').gte('date', addDays(today, -400)),
  ])
  return <HabitsClient title="Health & Habits" habits={(h.data ?? []) as Habit[]} logs={(l.data ?? []) as HabitLog[]} today={today} />
}
