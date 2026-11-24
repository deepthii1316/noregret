import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/data'
import { SettingsForm } from '@/components/settings-form'

export default async function SettingsPage() {
  const s = await createClient()
  const { data: { user } } = await s.auth.getUser()
  return <SettingsForm settings={(await getSettings(s))!} email={user?.email ?? ''} />
}
