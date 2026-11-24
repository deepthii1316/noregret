import { createClient } from '@/lib/supabase/server'
import { getSettings, tzOf } from '@/lib/data'
import { todayIn } from '@/lib/time'
import { EmbroideryClient } from '@/components/embroidery/embroidery-client'

export default async function EmbroideryPage() {
  const s = await createClient()
  const settings = await getSettings(s)
  const [{ data: orders, error: ordersError }, { data: posts, error: postsError }] = await Promise.all([
    s.from('embroidery_orders').select('*').order('order_date', { ascending: false }),
    s.from('embroidery_post_logs').select('*').order('post_date', { ascending: false }),
  ])
  if (ordersError || postsError) throw new Error(ordersError?.message ?? postsError?.message)
  return <EmbroideryClient today={todayIn(tzOf(settings))} reminderEnabled={settings?.embroidery_reminder_enabled ?? false} reminderTime={settings?.embroidery_reminder_time ?? '19:00'} orders={orders ?? []} posts={posts ?? []} />
}
