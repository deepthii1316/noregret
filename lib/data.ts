import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_TZ } from './time'

export type Settings = {
  id: string
  timezone: string
  time_format: '12h' | '24h'
  study_hours_target: number
  min_study_hours: number
  water_target: number
  sleep_target: number
  dsa_phase: 'roadmap' | 'cses'
  roadmap_current_day: number
  roadmap_started_on: string | null
  days_per_week: number
  cses_priority: string[]
  cses_per_day: number
  jobs_app_url: string | null
  aws_cert: string
  aws_exam_date: string | null
  sql_playlist_url: string | null
  push_enabled: boolean
  embroidery_reminder_enabled: boolean
  embroidery_reminder_time: string
}
export type Item = {
  id: string; group_id: string; tracker_id: string; slug: string; title: string
  status: 'todo' | 'doing' | 'done' | 'mastered'
  difficulty: 'easy' | 'medium' | 'hard' | null
  label: string | null; platform: string | null; link: string | null; notes: string | null
  needs_revision: boolean; completed_at: string | null; last_revised_at: string | null
  next_revision_at: string | null; revision_count: number; times_solved: number; sort_order: number
}
export type Group = { id: string; tracker_id: string; slug: string; name: string; pattern_note: string | null; meta: Record<string, any>; sort_order: number }

export async function getSettings(s: SupabaseClient): Promise<Settings | null> {
  const { data } = await s.from('settings').select('*').maybeSingle()
  return (data as Settings | null) ?? null
}
export const tzOf = (st: Settings | null) => st?.timezone ?? DEFAULT_TZ

export const DONE = ['done', 'mastered']
export const isDone = (i: { status: string }) => DONE.includes(i.status)

/** Items due for revision: flagged, or done 14+ days ago / spaced interval elapsed. Max 5. */
export async function getReviseQueue(s: SupabaseClient, limit = 5): Promise<Item[]> {
  const iso = new Date().toISOString()
  const { data } = await s
    .from('tracker_items').select('*')
    .or(`needs_revision.eq.true,next_revision_at.lte.${iso}`)
    .order('needs_revision', { ascending: false }).order('next_revision_at', { ascending: true }).limit(limit)
  return (data ?? []) as Item[]
}
