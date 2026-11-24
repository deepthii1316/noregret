import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf, type Group, type Item } from '@/lib/data'
import { todayIn } from '@/lib/time'
import { TrackerSheet } from '@/components/tracker/tracker-sheet'

export default async function CsesPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const { data: tracker } = await s.from('trackers').select('id,key,name').eq('key', 'cses').maybeSingle()
  if (!tracker) {
    return (
      <div className="space-y-4">
        <header><h1 className="h1">CSES</h1><p className="sub">Sync the problem set from Settings before starting the daily queue.</p></header>
        <Link className="btn btn-primary" href="/settings">Open CSES settings</Link>
      </div>
    )
  }
  const [{ data: groups }, { data: items }] = await Promise.all([
    s.from('tracker_groups').select('*').eq('tracker_id', tracker.id).order('sort_order'),
    s.from('tracker_items').select('*').eq('tracker_id', tracker.id).order('sort_order'),
  ])
  return (
    <div className="space-y-4">
      <nav className="flex gap-2"><Link className="btn" href="/dsa/roadmap">Roadmap</Link><span className="btn btn-primary" aria-current="page">CSES</span></nav>
      <TrackerSheet tracker={tracker} initialGroups={(groups ?? []) as Group[]} initialItems={(items ?? []) as Item[]} today={todayIn(tzOf(settings))} />
    </div>
  )
}
