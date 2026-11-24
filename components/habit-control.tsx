'use client'
import { useState } from 'react'
import { Check, Minus, Plus } from 'lucide-react'
import { habitDone, sleepHours, type Habit } from '@/lib/habits'

type Props = { habit: Habit; value: number; note?: string | null; onChange: (value: number, note?: string) => void }

export function HabitControl({ habit: h, value, note, onChange }: Props) {
  const done = habitDone(h, value)
  const [bed, wake] = (note ?? '23:00-07:00').split('-')
  const [bedT, setBed] = useState(bed || '23:00')
  const [wakeT, setWake] = useState(wake || '07:00')

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        {h.type === 'checkbox' && (
          <button role="checkbox" aria-checked={done} aria-label={h.name} onClick={() => onChange(done ? 0 : 1)}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors ${done ? 'border-primary bg-primary text-primary-fg' : 'bg-card'}`}>
            {done && <Check size={14} />}
          </button>
        )}
        <span className={`truncate text-sm ${done ? 'text-muted line-through' : ''}`}>{h.name}</span>
      </div>
      {h.type === 'counter' && (
        <div className="flex shrink-0 items-center gap-2">
          <button className="btn !px-2" aria-label="Less" onClick={() => onChange(Math.max(0, value - 250))}><Minus size={14} /></button>
          <span className={`w-24 text-center text-sm tabular-nums ${done ? 'text-primary' : ''}`}>{value} / {h.target} {h.unit}</span>
          <button className="btn !px-2" aria-label="More" onClick={() => onChange(value + 250)}><Plus size={14} /></button>
        </div>
      )}
      {h.type === 'duration' && (
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input className="input !w-20 text-right" type="number" min={0} inputMode="numeric" value={value || ''} placeholder="0"
            onChange={(e) => onChange(Number(e.target.value) || 0)} />
          <span className="text-muted">/ {h.target} {h.unit}</span>
        </label>
      )}
      {h.type === 'time' && (
        <div className="flex shrink-0 items-center gap-1.5 text-sm">
          <input className="input !w-[5.5rem]" type="time" aria-label="Bedtime" value={bedT} onChange={(e) => setBed(e.target.value)} onBlur={() => onChange(sleepHours(bedT, wakeT), `${bedT}-${wakeT}`)} />
          <span className="text-muted">to</span>
          <input className="input !w-[5.5rem]" type="time" aria-label="Wake time" value={wakeT} onChange={(e) => setWake(e.target.value)} onBlur={() => onChange(sleepHours(bedT, wakeT), `${bedT}-${wakeT}`)} />
          <span className={`w-10 text-right tabular-nums ${done ? 'text-primary' : 'text-muted'}`}>{value ? `${value}h` : '–'}</span>
        </div>
      )}
    </div>
  )
}
