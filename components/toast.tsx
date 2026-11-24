'use client'
import { useEffect, useState } from 'react'

export const toast = (message: string) => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('noregret:toast', { detail: message }))
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; msg: string }[]>([])
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random()
      setItems((p) => [...p, { id, msg: (e as CustomEvent<string>).detail }])
      setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 4500)
    }
    window.addEventListener('noregret:toast', on)
    return () => window.removeEventListener('noregret:toast', on)
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="pointer-events-auto rounded-lg border bg-card px-4 py-2 text-sm shadow-lg">{t.msg}</div>
      ))}
    </div>
  )
}
