import { createClient } from '@/lib/supabase/server'
import { addDays, todayIn, weekdayOf } from '@/lib/time'
import { getSettings, tzOf } from '@/lib/data'
import { WeeklyReviewClient } from '@/components/review/weekly-review-client'

export default async function WeeklyReviewPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const today = todayIn(tzOf(settings))
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const weekEnd = addDays(weekStart, 6)
  const [
    timeResult, minimumResult, solveResult, contestResult, habitResult, blocksResult,
    habitsResult, nightResult, reviewResult, reviewsResult, roadmapTracker,
  ] = await Promise.all([
    s.from('time_entries').select('subject,minutes,date').gte('date', weekStart).lte('date', weekEnd),
    s.from('daily_status').select('date,minimum_met').gte('date', weekStart).lte('date', weekEnd),
    s.from('daily_solve_counts').select('count').eq('tracker_key', 'dsa_roadmap').gte('date', weekStart).lte('date', weekEnd),
    s.from('contest_results').select('id').gte('created_at', `${weekStart}T00:00:00Z`).lte('created_at', `${weekEnd}T23:59:59Z`),
    s.from('habit_logs').select('habit_id,date,value').gte('date', weekStart).lte('date', weekEnd),
    s.from('schedule_blocks').select('subject,start_time,end_time,days,is_study'),
    s.from('habits').select('id,schedule').eq('active', true),
    s.from('night_checks').select('regret_score').gte('date', weekStart).lte('date', weekEnd).not('regret_score', 'is', null),
    s.from('weekly_reviews').select('*').eq('week_start', weekStart).maybeSingle(),
    s.from('weekly_reviews').select('*').order('week_start', { ascending: false }),
    s.from('trackers').select('id').eq('key', 'dsa_roadmap').maybeSingle(),
  ])
  for (const result of [timeResult, minimumResult, solveResult, contestResult, habitResult, blocksResult, habitsResult, nightResult, reviewResult, reviewsResult]) {
    if (result.error) throw new Error(result.error.message)
  }
  let roadmapDaysCompleted = 0
  if (roadmapTracker.data) {
    const [{ data: groups, error: groupError }, { data: items, error: itemError }] = await Promise.all([
      s.from('tracker_groups').select('id').eq('tracker_id', roadmapTracker.data.id),
      s.from('tracker_items').select('group_id,status').eq('tracker_id', roadmapTracker.data.id),
    ])
    if (groupError || itemError) throw new Error(groupError?.message ?? itemError?.message)
    const doneByGroup = new Map<string, boolean>()
    for (const item of items ?? []) doneByGroup.set(item.group_id, (doneByGroup.get(item.group_id) ?? true) && ['done', 'mastered'].includes(item.status))
    roadmapDaysCompleted = (groups ?? []).filter((group) => doneByGroup.get(group.id)).length
  }
  const hoursBySubject = new Map<string, number>()
  for (const entry of timeResult.data ?? []) hoursBySubject.set(entry.subject, (hoursBySubject.get(entry.subject) ?? 0) + Number(entry.minutes))
  const plannedBySubject = new Map<string, number>()
  for (const block of blocksResult.data ?? []) {
    if (!block.is_study) continue
    const startMinutes = Number(block.start_time.slice(0, 2)) * 60 + Number(block.start_time.slice(3, 5))
    const endMinutes = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5))
    const scheduledDays = (block.days as number[]).filter((dow) => Array.from({ length: 7 }, (_, index) => weekdayOf(addDays(weekStart, index))).includes(dow)).length
    plannedBySubject.set(block.subject, (plannedBySubject.get(block.subject) ?? 0) + Math.max(0, endMinutes - startMinutes) * scheduledDays)
  }
  const activeDays = Math.min(7, Math.max(1, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${weekStart}T00:00:00Z`)) / 86400000) + 1))
  const eligibleDates = Array.from({ length: activeDays }, (_, index) => addDays(weekStart, index))
  const scheduleByHabit = new Map((habitsResult.data ?? []).map((habit) => [habit.id, habit.schedule as number[]]))
  const expectedHabits = (habitsResult.data ?? []).reduce((total, habit) => total + eligibleDates.filter((date) => (habit.schedule as number[]).includes(weekdayOf(date))).length, 0)
  const completedHabits = (habitResult.data ?? []).filter((entry) => Number(entry.value) > 0 && scheduleByHabit.get(entry.habit_id)?.includes(weekdayOf(entry.date))).length
  const scores = (nightResult.data ?? []).map((entry) => Number(entry.regret_score))
  const metrics = {
    hoursBySubject: [...new Set([...hoursBySubject.keys(), ...plannedBySubject.keys()])].map((subject) => ({
      subject,
      hours: Math.round((hoursBySubject.get(subject) ?? 0) / 60 * 10) / 10,
      plannedHours: Math.round((plannedBySubject.get(subject) ?? 0) / 60 * 10) / 10,
    })),
    minimumDays: (minimumResult.data ?? []).filter((entry) => entry.minimum_met).length,
    dsaProblems: (solveResult.data ?? []).reduce((sum, entry) => sum + Number(entry.count), 0),
    roadmapDaysCompleted,
    contestsAttended: (contestResult.data ?? []).length,
    habitCompletion: expectedHabits ? Math.round(completedHabits / expectedHabits * 100) : 0,
    averageRegret: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 10) / 10 : null,
  }
  return <WeeklyReviewClient weekStart={weekStart} metrics={metrics} current={reviewResult.data} history={reviewsResult.data ?? []} />
}
