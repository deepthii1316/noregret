import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import * as webpush from 'web-push'
import { weekdayOf } from '@/lib/time'

export const dynamic = 'force-dynamic'

type SettingsRow = {
  user_id: string
  timezone: string
  push_enabled: boolean
  embroidery_reminder_enabled: boolean
  embroidery_reminder_time: string
}

function localParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

function isDue(now: string, scheduled: string) {
  const [nowHour, nowMinute] = now.split(':').map(Number)
  const [scheduledHour, scheduledMinute] = scheduled.slice(0, 5).split(':').map(Number)
  const difference = nowHour * 60 + nowMinute - (scheduledHour * 60 + scheduledMinute)
  return difference >= 0 && difference < 5
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const vapidSubject = process.env.VAPID_SUBJECT
  if (!url || !serviceKey || !publicKey || !privateKey || !vapidSubject) {
    return NextResponse.json({ error: 'Push reminders are not configured' }, { status: 503 })
  }

  webpush.setVapidDetails(vapidSubject, publicKey, privateKey)
  const db = createSupabaseClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: settings, error: settingsError } = await db.from('settings')
    .select('user_id,timezone,push_enabled,embroidery_reminder_enabled,embroidery_reminder_time')
    .eq('push_enabled', true)
  if (settingsError) return NextResponse.json({ error: settingsError.message }, { status: 500 })

  const now = new Date()
  let sent = 0
  const failures: { userId: string; error: string }[] = []
  for (const setting of (settings ?? []) as SettingsRow[]) {
    const local = localParts(now, setting.timezone)
    const dow = weekdayOf(local.date)
    const { data: subscriptions, error: subscriptionError } = await db.from('push_subscriptions')
      .select('id,endpoint,p256dh,auth').eq('user_id', setting.user_id)
    if (subscriptionError) {
      failures.push({ userId: setting.user_id, error: subscriptionError.message })
      continue
    }
    if (!subscriptions?.length) continue

    const reminders: { key: string; title: string; body: string; url: string }[] = []
    if (isDue(local.time, '21:30')) reminders.push({ key: 'night-check', title: 'Night check', body: 'Take a minute to reflect on today.', url: '/today' })

    const { data: blocks, error: blockError } = await db.from('schedule_blocks')
      .select('id,title,start_time,days').eq('user_id', setting.user_id).contains('days', [dow])
    if (blockError) failures.push({ userId: setting.user_id, error: blockError.message })
    else for (const block of blocks ?? []) {
      if (isDue(local.time, block.start_time)) reminders.push({
        key: `block:${block.id}`, title: 'Upcoming study block',
        body: `${block.title} is starting now.`, url: '/today',
      })
    }

    if (setting.embroidery_reminder_enabled && isDue(local.time, setting.embroidery_reminder_time)) {
      const { data: posts, error: postError } = await db.from('embroidery_post_logs')
        .select('id').eq('user_id', setting.user_id).eq('post_date', local.date).limit(1)
      if (postError) failures.push({ userId: setting.user_id, error: postError.message })
      else if (!posts?.length) reminders.push({
        key: 'embroidery-post', title: "Mom's embroidery",
        body: "Post today's embroidery work on WhatsApp or Instagram.", url: '/embroidery',
      })
    }

    for (const reminder of reminders) {
      const { error: claimError } = await db.from('push_delivery_log').insert({
        user_id: setting.user_id, local_date: local.date, reminder_key: reminder.key,
      })
      if (claimError?.code === '23505') continue
      if (claimError) {
        failures.push({ userId: setting.user_id, error: claimError.message })
        continue
      }
      let delivered = 0
      for (const subscription of subscriptions ?? []) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, JSON.stringify(reminder))
          sent++
          delivered++
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode
          if (statusCode === 404 || statusCode === 410) {
            const { error: deleteError } = await db.from('push_subscriptions').delete().eq('id', subscription.id)
            if (deleteError) failures.push({ userId: setting.user_id, error: deleteError.message })
          } else {
            failures.push({ userId: setting.user_id, error: error instanceof Error ? error.message : 'Push delivery failed' })
          }
        }
      }
      if (!delivered) {
        const { error: releaseError } = await db.from('push_delivery_log').delete()
          .eq('user_id', setting.user_id).eq('local_date', local.date).eq('reminder_key', reminder.key)
        if (releaseError) failures.push({ userId: setting.user_id, error: releaseError.message })
      }
    }
  }
  return NextResponse.json({ sent, failures })
}
