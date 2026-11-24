'use client'

import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, RefreshCw, Upload } from 'lucide-react'
import { toast } from '@/components/toast'
import { CSES_PRIORITY } from '@/lib/cses'
import { importCsesCsv, saveCsesPriority, syncCsesList } from '@/lib/feature-actions'
import { Button } from '@/components/ui/button'

export function CsesControls({ initialPriority }: { initialPriority: string[] }) {
  const [priority, setPriority] = useState(initialPriority.length ? initialPriority : CSES_PRIORITY)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  async function sync() {
    setBusy(true)
    try {
      const result = await syncCsesList()
      toast(`Synced ${result.problems} problems across ${result.sections} sections`)
    } catch (error) {
      toast(`CSES sync failed: ${(error as Error).message}`)
    } finally { setBusy(false) }
  }

  async function importCsv(selected: File) {
    setBusy(true)
    try {
      const result = await importCsesCsv(await selected.text())
      toast(`Imported ${result.problems} problems across ${result.sections} sections`)
    } catch (error) {
      toast(`CSV import failed: ${(error as Error).message}`)
    } finally {
      setBusy(false)
      if (file.current) file.current.value = ''
    }
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= priority.length) return
    setPriority((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  async function saveOrder() {
    setBusy(true)
    try {
      await saveCsesPriority(priority)
      toast('CSES priority order saved')
    } catch (error) {
      toast(`Could not save order: ${(error as Error).message}`)
    } finally { setBusy(false) }
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="font-semibold">CSES problem set</h2>
        <p className="sub">Sync the public list once, or import a CSV with tracker, group, title, and url columns.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={sync}><RefreshCw size={14} />Re-sync CSES list</Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => file.current?.click()}><Upload size={14} />Import CSV</Button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={(event) => event.target.files?.[0] && importCsv(event.target.files[0])} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">Priority sections (top first)</p>
        {priority.map((name, index) => (
          <div key={name} className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
            <span className="flex-1 text-sm">{index + 1}. {name}</span>
            <Button type="button" variant="outline" size="icon" className="!h-7 !w-7" aria-label={`Move ${name} up`} disabled={index === 0 || busy} onClick={() => move(index, -1)}><ArrowUp size={14} /></Button>
            <Button type="button" variant="outline" size="icon" className="!h-7 !w-7" aria-label={`Move ${name} down`} disabled={index === priority.length - 1 || busy} onClick={() => move(index, 1)}><ArrowDown size={14} /></Button>
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" disabled={busy} onClick={saveOrder}>Save priority order</Button>
    </section>
  )
}
