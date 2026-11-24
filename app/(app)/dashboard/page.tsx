import { createClient } from '@/lib/supabase/server'
import { addDays, todayIn } from '@/lib/time'
import { getReviseQueue, getSettings, tzOf } from '@/lib/data'
import { DashboardClient, type DashboardData } from '@/components/dashboard/dashboard-client'

export default async function DashboardPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const today = todayIn(tzOf(settings))
  const start = addDays(today, -182)
  const weekStart = addDays(today, -((new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7))
  const [
    hoursResult, subjectResult, weekSubjectResult, completionResult, statusResult, nightResult, blocksResult,
    solvesResult, contestsResult, roadmapResult, revise,
  ] = await Promise.all([
    s.rpc('dashboard_hours_by_day', { start_date: start, end_date: today }),
    s.rpc('dashboard_hours_by_subject', { start_date: start, end_date: today }),
    s.rpc('dashboard_hours_by_subject', { start_date: weekStart, end_date: today }),
    s.rpc('dashboard_tracker_completion'),
    s.from('daily_status').select('date,minimum_met,study_minutes').gte('date', start).lte('date', today).order('date'),
    s.from('night_checks').select('date,regret_score').gte('date', start).lte('date', today),
    s.from('schedule_blocks').select('subject,start_time,end_time,days,is_study'),
    s.from('daily_solve_counts').select('date,tracker_key,count').gte('date', weekStart).lte('date', today),
    s.from('contests').select('id,start_time,attending').gte('start_time', weekStart).lte('start_time', today),
    s.from('trackers').select('id').eq('key', 'dsa_roadmap').maybeSingle(),
    getReviseQueue(s),
  ])
  for (const result of [hoursResult, subjectResult, weekSubjectResult, completionResult, statusResult, nightResult, blocksResult, solvesResult, contestsResult]) {
    if (result.error) throw new Error(result.error.message)
  }

  const roadmapTracker = roadmapResult.data
  let roadmapDays = 0
  let roadmapDone = 0
  let csesDone = 0
  if (roadmapTracker) {
    const [{ data: dayGroups, error: groupsError }, { data: roadmapItems, error: itemsError }] = await Promise.all([
      s.from('tracker_groups').select('id').eq('tracker_id', roadmapTracker.id),
      s.from('tracker_items').select('group_id,status').eq('tracker_id', roadmapTracker.id),
    ])
    if (groupsError || itemsError) throw new Error(groupsError?.message ?? itemsError?.message)
    roadmapDays = (dayGroups ?? []).length
    const completedByDay = new Map<string, boolean>()
    for (const item of roadmapItems ?? []) {
      completedByDay.set(item.group_id, (completedByDay.get(item.group_id) ?? true) && ['done', 'mastered'].includes(item.status))
    }
    roadmapDone = [...completedByDay.values()].filter(Boolean).length
  }
  const { data: csesTracker } = await s.from('trackers').select('id').eq('key', 'cses').maybeSingle()
  if (csesTracker) {
    const { data: csesItems, error } = await s.from('tracker_items').select('status').eq('tracker_id', csesTracker.id)
    if (error) throw new Error(error.message)
    csesDone = (csesItems ?? []).filter((item) => ['done', 'mastered'].includes(item.status)).length
  }
  const dsaTracker = roadmapTracker
  let familySkills: DashboardData['familySkills'] = []
  if (dsaTracker) {
    const [{ data: groups }, { data: items }] = await Promise.all([
      s.from('tracker_groups').select('id,meta').eq('tracker_id', dsaTracker.id),
      s.from('tracker_items').select('group_id,status').eq('tracker_id', dsaTracker.id),
    ])
    const families = new Map<string, { total: number; done: number }>()
    const familyByGroup = new Map((groups ?? []).map((group) => [group.id, String((group.meta as { family?: string }).family ?? 'Other')]))
    for (const item of items ?? []) {
      const family = familyByGroup.get(item.group_id) ?? 'Other'
      const count = families.get(family) ?? { total: 0, done: 0 }
      count.total++
      if (['done', 'mastered'].includes(item.status)) count.done++
      families.set(family, count)
    }
    familySkills = [...families].map(([name, count]) => ({ name, value: count.total ? Math.round(count.done / count.total * 100) : 0 }))
  }

  const days = (statusResult.data ?? []).filter((row) => row.minimum_met).map((row) => row.date)
  const completion = ((completionResult.data ?? []) as {
    tracker_key: string; tracker_name: string; total: number | string; completed: number | string
  }[]).map((row) => ({
    key: row.tracker_key, name: row.tracker_name, total: Number(row.total), done: Number(row.completed),
  }))
  const subjectHours = ((subjectResult.data ?? []) as { subject: string; minutes: number | string }[])
    .map((row) => ({ subject: row.subject, hours: Number(row.minutes) / 60 }))
  const planned = new Map<string, number>()
  for (const block of blocksResult.data ?? []) {
    if (!block.is_study) continue
    const duration = Number(block.end_time.slice(0, 2)) * 60 + Number(block.end_time.slice(3, 5))
      - Number(block.start_time.slice(0, 2)) * 60 - Number(block.start_time.slice(3, 5))
    const weeklyCount = (block.days as number[]).length
    planned.set(block.subject, (planned.get(block.subject) ?? 0) + Math.max(0, duration) * weeklyCount)
  }
  const actualBySubject = new Map<string, number>()
  for (const row of (weekSubjectResult.data ?? []) as { subject: string; minutes: number | string }[]) {
    actualBySubject.set(row.subject, Number(row.minutes) / 60)
  }
  const weekSubjects = [...new Set([...planned.keys(), ...actualBySubject.keys()])].map((subject) => ({
    subject,
    plannedHours: Math.round((planned.get(subject) ?? 0) / 60 * 10) / 10,
    actualHours: Math.round((actualBySubject.get(subject) ?? 0) * 10) / 10,
  }))
  const data: DashboardData = {
    today,
    hours: ((hoursResult.data ?? []) as { day: string; hours: number | string }[])
      .map((row) => ({ date: row.day, hours: Number(row.hours) })),
    subjects: subjectHours,
    completion,
    minimumDates: days,
    nightChecks: (nightResult.data ?? []).map((row) => ({ date: row.date, score: row.regret_score })),
    familySkills,
    weekSubjects,
    weekSolves: (solvesResult.data ?? []).reduce((total, row) => total + Number(row.count), 0),
    weekendContests: (contestsResult.data ?? []).filter((row) => row.attending).length,
    currentDsa: settings?.dsa_phase === 'cses' ? `${csesDone} CSES solved` : `Roadmap day ${settings?.roadmap_current_day ?? 1}/${roadmapDays || 60} · ${roadmapDone} days done`,
    revise: revise.map((item) => ({ id: item.id, title: item.title })),
  }
  return <DashboardClient data={data} />
}
