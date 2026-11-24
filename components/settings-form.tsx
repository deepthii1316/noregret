'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from '@/components/toast'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/actions'
import type { Settings } from '@/lib/data'
import { CsesControls } from '@/components/settings/cses-controls'
import { PushSettings } from '@/components/settings/push-settings'

export function SettingsForm({ settings, email }: { settings: Settings; email: string }) {
  const router = useRouter()
  const [v, setV] = useState({
    ...settings,
    jobs_app_url: settings.jobs_app_url ?? '',
    sql_playlist_url: settings.sql_playlist_url ?? '',
    aws_exam_date: settings.aws_exam_date ?? '',
  })
  const [busy, setBusy] = useState(false)
  const num = (k: keyof typeof v) => ({ value: v[k] as number, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: Number(e.target.value) }) })

  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true)
    try {
      await updateSettings({
        timezone: v.timezone, time_format: v.time_format, study_hours_target: v.study_hours_target, min_study_hours: v.min_study_hours, water_target: v.water_target,
        sleep_target: v.sleep_target, dsa_phase: v.dsa_phase, roadmap_current_day: v.roadmap_current_day, days_per_week: v.days_per_week, cses_per_day: v.cses_per_day, jobs_app_url: v.jobs_app_url,
        aws_cert: v.aws_cert, aws_exam_date: v.aws_exam_date || null, sql_playlist_url: v.sql_playlist_url || null,
        push_enabled: v.push_enabled, embroidery_reminder_enabled: v.embroidery_reminder_enabled,
        embroidery_reminder_time: v.embroidery_reminder_time,
      })
      toast('Settings saved'); router.refresh()
    } catch (err) { toast((err as Error).message) }
    setBusy(false)
  }
  return (
    <form onSubmit={save} className="space-y-5">
      <header><h1 className="h1">Settings</h1><p className="sub">Signed in as {email}</p></header>
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <label className="text-sm">Timezone<input className="input mt-1" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} /></label>
        <label className="text-sm">Time format<select className="input mt-1" value={v.time_format} onChange={(e) => setV({ ...v, time_format: e.target.value as '12h' | '24h' })}><option value="12h">12-hour</option><option value="24h">24-hour</option></select></label>
        <label className="text-sm">Daily study target (hours)<input className="input mt-1" type="number" step="0.5" {...num('study_hours_target')} /></label>
        <label className="text-sm">Bad-day minimum study (hours)<input className="input mt-1" type="number" step="0.5" {...num('min_study_hours')} /></label>
        <label className="text-sm">Water target (ml)<input className="input mt-1" type="number" step="250" {...num('water_target')} /></label>
        <label className="text-sm">Sleep target (hours)<input className="input mt-1" type="number" step="0.5" {...num('sleep_target')} /></label>
        <div className="text-sm">Theme<div className="mt-1"><ThemeToggle /></div></div>
      </section>
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">DSA</h2>
        <label className="text-sm">Phase<select className="input mt-1" value={v.dsa_phase} onChange={(e) => setV({ ...v, dsa_phase: e.target.value as 'roadmap' | 'cses' })}><option value="roadmap">Roadmap (60 days)</option><option value="cses">CSES</option></select></label>
        <label className="text-sm">Roadmap current day<input className="input mt-1" type="number" min={1} max={60} {...num('roadmap_current_day')} /></label>
        <label className="text-sm">Roadmap days per week<input className="input mt-1" type="number" min={1} max={7} {...num('days_per_week')} /></label>
        <label className="text-sm">CSES problems per day<input className="input mt-1" type="number" min={1} max={6} {...num('cses_per_day')} /></label>
        <label className="text-sm sm:col-span-2">Jobs app URL (optional, turns the job-hunt block into a link)<input className="input mt-1" type="url" placeholder="https://" value={v.jobs_app_url} onChange={(e) => setV({ ...v, jobs_app_url: e.target.value })} /></label>
      </section>
      <CsesControls initialPriority={settings.cses_priority} />
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">AWS preparation</h2>
        <label className="text-sm">Target certification<input className="input mt-1" value={v.aws_cert} onChange={(e) => setV({ ...v, aws_cert: e.target.value })} /></label>
        <label className="text-sm">Exam date<input className="input mt-1" type="date" value={v.aws_exam_date} onChange={(e) => setV({ ...v, aws_exam_date: e.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Ankit Bansal SQL playlist URL<input className="input mt-1" type="url" placeholder="https://" value={v.sql_playlist_url} onChange={(e) => setV({ ...v, sql_playlist_url: e.target.value })} /></label>
      </section>
      <section className="card grid gap-3 p-4 sm:grid-cols-2">
        <h2 className="font-semibold sm:col-span-2">Reminders</h2>
        <div className="sm:col-span-2"><PushSettings enabled={v.push_enabled} onEnabledChange={(push_enabled) => setV((current) => ({ ...current, push_enabled }))} /></div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={v.embroidery_reminder_enabled} onChange={(e) => setV({ ...v, embroidery_reminder_enabled: e.target.checked })} />Enable the daily embroidery post reminder</label>
        <label className="text-sm">Embroidery reminder time<input className="input mt-1" type="time" value={v.embroidery_reminder_time.slice(0, 5)} onChange={(e) => setV({ ...v, embroidery_reminder_time: e.target.value })} /></label>
      </section>
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>Save settings</button>
        <button type="button" className="btn" onClick={async () => { await createClient().auth.signOut(); router.push('/login'); router.refresh() }}>Sign out</button>
      </div>
    </form>
  )
}
