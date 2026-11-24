'use client'
import { useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@/components/toast'
import { deleteItem, markRevised, saveItemNotes, setItemStatus, setNeedsRevision } from '@/lib/actions'
import type { Item } from '@/lib/data'

export type ItemActions = ReturnType<typeof useItemActions>

/** Optimistic item mutations with rollback + toast on failure. */
export function useItemActions(setItems: (f: (prev: Item[]) => Item[]) => void, today: string, onDay?: (day: number) => void) {
  const patch = useCallback((id: string, p: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...p } : i))), [setItems])
  const fail = (what: string, e: unknown) => toast(`${what} failed: ${e instanceof Error ? e.message : 'unknown error'}`)
  const statusMutation = useMutation({
    mutationFn: ({ item, status }: { item: Item; status: Item['status'] }) => setItemStatus({ itemId: item.id, status, today }),
    onMutate: ({ item, status }) => {
      const before = { status: item.status, completed_at: item.completed_at }
      patch(item.id, { status, completed_at: ['done', 'mastered'].includes(status) ? new Date().toISOString() : null })
      return { itemId: item.id, before }
    },
    onSuccess: (result) => {
      patch(result.item.id, result.item as Item)
      if (result.currentDay) onDay?.(result.currentDay)
    },
    onError: (error, _variables, context) => {
      if (context) patch(context.itemId, context.before)
      fail('Saving status', error)
    },
  })

  return {
    patch,
    setStatus(item: Item, status: Item['status']) {
      statusMutation.mutate({ item, status })
    },
    async toggleRevision(item: Item) {
      patch(item.id, { needs_revision: !item.needs_revision })
      try { await setNeedsRevision({ itemId: item.id, value: !item.needs_revision }) } catch (e) { patch(item.id, { needs_revision: item.needs_revision }); fail('Saving', e) }
    },
    async revised(item: Item) {
      try { patch(item.id, (await markRevised(item.id)) as Item); toast('Marked revised') } catch (e) { fail('Saving', e) }
    },
    async saveNotes(item: Item, notes: string) {
      try { await saveItemNotes({ itemId: item.id, notes }); patch(item.id, { notes }); return true } catch (e) { fail('Saving notes', e); return false }
    },
    async remove(item: Item) {
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      try { await deleteItem(item.id) } catch (e) { setItems((prev) => [...prev, item]); fail('Deleting', e) }
    },
  }
}
