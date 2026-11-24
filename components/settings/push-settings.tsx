'use client'

import { useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { toast } from '@/components/toast'
import { disablePushReminders, savePushSubscription } from '@/lib/feature-actions'
import { Button } from '@/components/ui/button'

function applicationKey(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from(raw, (char) => char.charCodeAt(0))
}

export function PushSettings({ enabled, onEnabledChange }: { enabled: boolean; onEnabledChange: (enabled: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  async function enable() {
    if (!publicKey) return toast('Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to enable push reminders.')
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return toast('This browser does not support web push.')
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') throw new Error('Notification permission was not granted')
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) })
      const json = subscription.toJSON()
      if (!json.keys?.p256dh || !json.keys.auth) throw new Error('Browser did not provide push subscription keys')
      await savePushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } })
      onEnabledChange(true)
      toast('Push reminders enabled')
    } catch (error) { toast(`Could not enable push: ${(error as Error).message}`) }
    finally { setBusy(false) }
  }
  async function disable() {
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.getRegistration('/')
      const subscription = await registration?.pushManager.getSubscription()
      await disablePushReminders()
      if (subscription) await subscription.unsubscribe()
      onEnabledChange(false)
      toast('Push reminders disabled')
    } catch (error) { toast(`Could not disable push: ${(error as Error).message}`) }
    finally { setBusy(false) }
  }
  return <div className="flex flex-wrap items-center gap-2"><Button type="button" variant={enabled ? 'outline' : 'default'} disabled={busy} onClick={enabled ? disable : enable}>{enabled ? <BellOff size={14} /> : <Bell size={14} />}{enabled ? 'Disable push reminders' : 'Enable push reminders'}</Button><span className="sub text-xs">{enabled ? 'Schedule and night-check reminders are enabled.' : 'Requires browser permission and VAPID keys in the deployment environment.'}</span></div>
}
