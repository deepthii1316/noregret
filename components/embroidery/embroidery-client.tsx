'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Plus, Trash2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { toast } from '@/components/toast'
import { deleteEmbroideryOrder, saveEmbroideryOrder, saveEmbroideryPost } from '@/lib/feature-actions'
import { toCsv } from '@/lib/csv'

type Order = {
  id: string; order_date: string; customer: string; design: string; price: number; material_cost: number; other_cost: number
  status: 'pending' | 'in_progress' | 'delivered' | 'paid'; notes: string | null
}
type Post = { id: string; post_date: string; platform: string; url: string | null; note: string | null }

export function EmbroideryClient({ today, reminderEnabled, reminderTime, orders, posts }: { today: string; reminderEnabled: boolean; reminderTime: string; orders: Order[]; posts: Post[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')
  const [order, setOrder] = useState({ orderDate: today, customer: '', design: '', price: '', materialCost: '', otherCost: '', status: 'pending', notes: '' })
  const [post, setPost] = useState({ platform: 'Instagram', url: '', note: '' })
  const currentMonth = today.slice(0, 7)
  const monthlyOrders = orders.filter((entry) => entry.order_date.startsWith(currentMonth))
  const settled = monthlyOrders.filter((entry) => ['delivered', 'paid'].includes(entry.status))
  const revenue = settled.reduce((sum, entry) => sum + Number(entry.price), 0)
  const cost = settled.reduce((sum, entry) => sum + Number(entry.material_cost) + Number(entry.other_cost), 0)
  const profit = revenue - cost
  const bestDesign = useMemo(() => {
    const counts = new Map<string, number>()
    settled.forEach((entry) => counts.set(entry.design, (counts.get(entry.design) ?? 0) + 1))
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—'
  }, [settled])
  const profitTrend = [...settled.reduce((entries, entry) => {
    const date = entry.order_date
    entries.set(date, (entries.get(date) ?? 0) + Number(entry.price) - Number(entry.material_cost) - Number(entry.other_cost))
    return entries
  }, new Map<string, number>())].map(([date, value]) => ({ date: date.slice(5), profit: value }))
  const todayPosted = posts.some((entry) => entry.post_date === today)
  const visibleOrders = orders.filter((entry) => filter === 'all' || entry.status === filter)

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try { await action(); toast(message); router.refresh() }
    catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }
  function exportOrders() {
    const rows = [
      ['date', 'customer', 'design', 'price', 'material_cost', 'other_cost', 'profit', 'status', 'notes'],
      ...orders.map((entry) => [entry.order_date, entry.customer, entry.design, String(entry.price), String(entry.material_cost), String(entry.other_cost), String(Number(entry.price) - Number(entry.material_cost) - Number(entry.other_cost)), entry.status, entry.notes ?? '']),
    ]
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: 'embroidery-orders.csv' })
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5 text-base">
      <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="h1">Mom's Embroidery</h1><p className="sub">Orders, profit, and a simple daily post checklist.</p></div><button className="btn" onClick={exportOrders}><Download size={14} />Export CSV</button></header>
      <section className={`card flex flex-wrap items-center justify-between gap-3 p-5 ${todayPosted ? 'border-emerald-500/40' : 'border-primary/40'}`}>
        <div><h2 className="text-lg font-semibold">Post today's work</h2><p className="sub">{reminderEnabled ? `Reminder set for ${reminderTime.slice(0, 5)}` : 'Set a reminder in Settings if needed.'}</p></div>
        <span className={`chip ${todayPosted ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{todayPosted ? 'Posted today' : 'Not logged today'}</span>
        {!todayPosted && <form className="flex w-full flex-wrap gap-2" onSubmit={(event) => {
          event.preventDefault()
          void run(() => saveEmbroideryPost({ postDate: today, ...post }), 'Post logged')
          setPost({ platform: 'Instagram', url: '', note: '' })
        }}>
          <select className="input !w-auto" value={post.platform} onChange={(e) => setPost({ ...post, platform: e.target.value })}><option>Instagram</option><option>WhatsApp Channel</option><option>Other</option></select>
          <input className="input min-w-48 flex-1" type="url" placeholder="Post URL (optional)" value={post.url} onChange={(e) => setPost({ ...post, url: e.target.value })} />
          <input className="input min-w-48 flex-1" placeholder="Note (optional)" value={post.note} onChange={(e) => setPost({ ...post, note: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}><Plus size={14} />Mark posted</button>
        </form>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary title="Revenue this month" value={`₹${revenue.toLocaleString('en-IN')}`} />
        <Summary title="Costs this month" value={`₹${cost.toLocaleString('en-IN')}`} />
        <Summary title="Profit this month" value={`₹${profit.toLocaleString('en-IN')}`} />
        <Summary title="Orders / best design" value={`${monthlyOrders.length} / ${bestDesign}`} />
      </section>
      <section className="card p-4">
        <h2 className="font-semibold">Monthly profit trend</h2>
        <div className="mt-2 h-40">{profitTrend.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={profitTrend}><CartesianGrid vertical={false} stroke="var(--border)" /><XAxis dataKey="date" /><Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Profit']} /><Bar dataKey="profit" fill="#14b8a6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="sub pt-8 text-center text-sm">Delivered or paid orders will appear here.</p>}</div>
      </section>
      <section className="card p-4">
        <h2 className="text-lg font-semibold">Add an order</h2>
        <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
          event.preventDefault()
          if (!order.customer.trim() || !order.design.trim()) return toast('Enter customer and design')
          void run(() => saveEmbroideryOrder({
            ...order, price: Number(order.price), materialCost: Number(order.materialCost), otherCost: Number(order.otherCost),
            status: order.status as Order['status'],
          }), 'Order saved')
          setOrder({ orderDate: today, customer: '', design: '', price: '', materialCost: '', otherCost: '', status: 'pending', notes: '' })
        }}>
          <input className="input" type="date" value={order.orderDate} onChange={(e) => setOrder({ ...order, orderDate: e.target.value })} />
          <input className="input" placeholder="Customer" value={order.customer} onChange={(e) => setOrder({ ...order, customer: e.target.value })} />
          <input className="input" placeholder="Design / description" value={order.design} onChange={(e) => setOrder({ ...order, design: e.target.value })} />
          <select className="input" value={order.status} onChange={(e) => setOrder({ ...order, status: e.target.value })}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="paid">Paid</option></select>
          <input className="input" type="number" min="0" step="0.01" placeholder="Price ₹" value={order.price} onChange={(e) => setOrder({ ...order, price: e.target.value })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Material cost ₹" value={order.materialCost} onChange={(e) => setOrder({ ...order, materialCost: e.target.value })} />
          <input className="input" type="number" min="0" step="0.01" placeholder="Other cost ₹" value={order.otherCost} onChange={(e) => setOrder({ ...order, otherCost: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}><Plus size={14} />Save order</button>
          <input className="input sm:col-span-4" placeholder="Notes" value={order.notes} onChange={(e) => setOrder({ ...order, notes: e.target.value })} />
        </form>
      </section>
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Orders</h2><select className="input !w-auto" aria-label="Filter orders by status" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="paid">Paid</option></select></div>
        <div className="mt-2 divide-y">
          {visibleOrders.map((entry) => {
            const orderProfit = Number(entry.price) - Number(entry.material_cost) - Number(entry.other_cost)
            return <article key={entry.id} className="flex flex-wrap items-center gap-2 py-3">
              <div className="min-w-40 flex-1"><p className="font-medium">{entry.design}</p><p className="sub text-xs">{entry.order_date} · {entry.customer}</p></div>
              <span className="text-sm">₹{Number(entry.price).toLocaleString('en-IN')}</span>
              <span className={`text-sm ${orderProfit < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Profit ₹{orderProfit.toLocaleString('en-IN')}</span>
              <select className="input !w-auto" aria-label={`Status of ${entry.design}`} value={entry.status} onChange={(e) => void run(() => saveEmbroideryOrder({
                id: entry.id, orderDate: entry.order_date, customer: entry.customer, design: entry.design,
                price: Number(entry.price), materialCost: Number(entry.material_cost), otherCost: Number(entry.other_cost),
                status: e.target.value as Order['status'], notes: entry.notes ?? '',
              }), 'Order updated')}><option value="pending">Pending</option><option value="in_progress">In progress</option><option value="delivered">Delivered</option><option value="paid">Paid</option></select>
              <button className="btn !px-2" aria-label={`Delete ${entry.design}`} onClick={() => confirm(`Delete order for ${entry.customer}?`) && void run(() => deleteEmbroideryOrder(entry.id), 'Order deleted')}><Trash2 size={14} /></button>
            </article>
          })}
          {!visibleOrders.length && <p className="sub py-4 text-center">No orders match this filter.</p>}
        </div>
      </section>
      <section className="card p-4">
        <h2 className="text-lg font-semibold">Post log</h2>
        <ul className="mt-2 divide-y">{posts.slice(0, 30).map((entry) => <li key={entry.id} className="flex flex-wrap gap-2 py-2 text-sm"><span>{entry.post_date} · {entry.platform}</span>{entry.url && <a className="underline" href={entry.url} target="_blank" rel="noreferrer">Open post</a>}<span className="sub">{entry.note}</span></li>)}</ul>
        {!posts.length && <p className="sub mt-2">Your post history will appear here.</p>}
      </section>
    </div>
  )
}

function Summary({ title, value }: { title: string; value: string }) {
  return <div className="card p-4"><p className="sub text-xs">{title}</p><p className="mt-2 font-semibold">{value}</p></div>
}
