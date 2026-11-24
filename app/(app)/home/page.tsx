import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf } from '@/lib/data'
import { addDays, todayIn } from '@/lib/time'
import type { Habit, HabitLog } from '@/lib/habits'
import { HabitsClient } from '@/components/habits-client'

export default async function HomePage() {
  const s = await createClient()
  const today = todayIn(tzOf(await getSettings(s)))
  const [h, l] = await Promise.all([
    s.from('habits').select('*').eq('category', 'home').eq('active', true).order('sort_order'),
    s.from('habit_logs').select('habit_id,date,value,note').gte('date', addDays(today, -400)),
  ])
  return <HabitsClient title="Home (mom tasks)" habits={(h.data ?? []) as Habit[]} logs={(l.data ?? []) as HabitLog[]} today={today} />
}
