import { toMin } from './time'

export type FlexItem = { title: string; subject: string; minutes: number }
export type Block = {
  id: string
  key: string | null
  title: string
  subject: string
  start_time: string // HH:MM
  end_time: string
  days: number[]
  kind: string
  flex_by_day: Record<string, FlexItem[]> | null
  is_study: boolean
  sort_order: number
  color: string | null
}

export const blocksForWeekday = (blocks: Block[], dow: number): Block[] =>
  blocks.filter((b) => b.days.includes(dow)).sort((a, b) => toMin(a.start_time) - toMin(b.start_time))

export const plannedMinutes = (b: Pick<Block, 'start_time' | 'end_time'>) => toMin(b.end_time) - toMin(b.start_time)

export function flexItems(b: Block, dow: number): FlexItem[] {
  return b.flex_by_day?.[String(dow)] ?? []
}

export function nowAndNext(blocks: Block[], nowMin: number) {
  const current = blocks.find((b) => toMin(b.start_time) <= nowMin && nowMin < toMin(b.end_time)) ?? null
  const next = blocks.find((b) => toMin(b.start_time) > nowMin) ?? null
  return { current, next }
}
