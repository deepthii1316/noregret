import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf, type Group, type Item } from '@/lib/data'
import { todayIn } from '@/lib/time'
import { TrackerSheet } from '@/components/tracker/tracker-sheet'
import { SpecializedTools } from '@/components/trackers/specialized-tools'

export default async function TrackerPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const s = await createClient()
  const st = await getSettings(s)
  const { data: tracker } = await s.from('trackers').select('id,key,name').eq('key', key).maybeSingle()
  if (!tracker || key === 'dsa_roadmap') notFound()
  const [{ data: groups }, { data: items }] = await Promise.all([
    s.from('tracker_groups').select('*').eq('tracker_id', tracker.id).order('sort_order'),
    s.from('tracker_items').select('*').eq('tracker_id', tracker.id).order('sort_order'),
  ])
  const today = todayIn(tzOf(st))
  let specialized = null
  if (key === 'aws') {
    const { data, error } = await s.from('practice_tests').select('*').eq('tracker_key', 'aws').order('date', { ascending: false })
    if (error) throw new Error(error.message)
    specialized = <SpecializedTools trackerKey={key} today={today} tests={data ?? []} resources={[]} projects={[]} contributions={[]} issues={[]} awsCert={st?.aws_cert ?? 'AWS certification'} examDate={st?.aws_exam_date ?? null} sqlPlaylistUrl={null} dailySolved={0} />
  } else if (key === 'ml' || key === 'sql') {
    const { data, error } = await s.from('learning_resources').select('*').eq('tracker_key', key).order('sort_order').order('created_at')
    if (error) throw new Error(error.message)
    let dailySolved = 0
    if (key === 'sql') {
      const { data: count, error: countError } = await s.from('daily_solve_counts').select('count').eq('tracker_key', 'sql').eq('date', today).maybeSingle()
      if (countError) throw new Error(countError.message)
      dailySolved = Number(count?.count ?? 0)
    }
    specialized = <SpecializedTools trackerKey={key} today={today} tests={[]} resources={data ?? []} projects={[]} contributions={[]} issues={[]} awsCert="" examDate={null} sqlPlaylistUrl={key === 'sql' ? st?.sql_playlist_url ?? null : null} dailySolved={dailySolved} />
  } else if (key === 'projects') {
    const [{ data: projects, error: projectsError }, { data: contributions, error: contributionsError }, { data: issues, error: issuesError }] = await Promise.all([
      s.from('projects').select('*').order('sort_order').order('created_at'),
      s.from('contributions').select('*').order('created_at', { ascending: false }),
      s.from('good_first_issues').select('*').order('created_at', { ascending: false }),
    ])
    if (projectsError || contributionsError || issuesError) throw new Error(projectsError?.message ?? contributionsError?.message ?? issuesError?.message)
    specialized = <SpecializedTools trackerKey={key} today={today} tests={[]} resources={[]} projects={projects ?? []} contributions={contributions ?? []} issues={issues ?? []} awsCert="" examDate={null} sqlPlaylistUrl={null} dailySolved={0} />
  }
  return <div className="space-y-5"><TrackerSheet tracker={tracker} initialGroups={(groups ?? []) as Group[]} initialItems={(items ?? []) as Item[]} today={today} />{specialized}</div>
}
