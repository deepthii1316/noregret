import { createClient } from '@/lib/supabase/server'
import { ExploreClient } from '@/components/explore/explore-client'

export default async function ExplorePage() {
  const s = await createClient()
  const [{ data: topics, error: topicsError }, { data: sessions, error: sessionsError }] = await Promise.all([
    s.from('explore_topics').select('*').order('sort_order').order('created_at'),
    s.from('explore_sessions').select('*').order('date', { ascending: false }),
  ])
  if (topicsError || sessionsError) throw new Error(topicsError?.message ?? sessionsError?.message)
  return <ExploreClient topics={topics ?? []} sessions={sessions ?? []} />
}
