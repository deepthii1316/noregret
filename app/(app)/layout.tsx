import { AppShell } from '@/components/app-shell'
import { createClient } from '@/lib/supabase/server'
import { getSettings } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await createClient()
  const settings = await getSettings(s)
  if (!settings) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <h1 className="h1">One-time setup needed</h1>
        <p className="sub mt-2">You are signed in, but your data has not been seeded yet. In the project folder run:</p>
        <pre className="card mt-3 overflow-x-auto p-3 text-sm">npm run seed</pre>
        <p className="sub mt-3">Then refresh this page. (Needs SEED_USER_EMAIL and SUPABASE_SERVICE_ROLE_KEY in .env.local; see the README.)</p>
      </div>
    )
  }
  return <AppShell>{children}</AppShell>
}
