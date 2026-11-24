'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from '@/components/toast'
import { deleteBlogPost, saveBlogPost } from '@/lib/feature-actions'
import { weekdayOf } from '@/lib/time'

type Post = { id: string; title: string; status: 'idea' | 'drafting' | 'ready' | 'published'; draft: string | null; target_date: string | null; published_url: string | null }
const COLUMNS: Post['status'][] = ['idea', 'drafting', 'ready', 'published']

export function BlogPipeline({ today, posts }: { today: string; posts: Post[] }) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, { title: string; draft: string; targetDate: string; publishedUrl: string }>>({})
  const edit = (post: Post) => drafts[post.id] ?? {
    title: post.title, draft: post.draft ?? '', targetDate: post.target_date ?? '', publishedUrl: post.published_url ?? '',
  }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try { await action(); toast(message); router.refresh() }
    catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }
  function save(post: Post, status = post.status) {
    const value = edit(post)
    return run(() => saveBlogPost({ id: post.id, ...value, targetDate: value.targetDate || undefined, status }), 'Blog post saved')
  }

  return (
    <div className="space-y-5">
      <header><h1 className="h1">Blog Pipeline</h1><p className="sub">Plan, draft, polish, and publish your learning notes.</p></header>
      {weekdayOf(today) === 0 && <div className="card border-primary/40 bg-primary/5 p-4 text-sm">Sunday nudge: write about this week's journey.</div>}
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        void run(() => saveBlogPost({ title, status: 'idea' }), 'Idea added')
        setTitle('')
      }}>
        <input className="input" placeholder="New blog idea" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add idea</button>
      </form>
      <div className="grid gap-3 lg:grid-cols-4">
        {COLUMNS.map((status) => {
          const entries = posts.filter((post) => post.status === status)
          return <section className="card min-w-0 p-3" key={status}>
            <h2 className="mb-3 flex items-center justify-between font-semibold capitalize">{status}<span className="chip bg-soft text-muted">{entries.length}</span></h2>
            <div className="space-y-3">
              {entries.map((post) => {
                const value = edit(post)
                return <article className="rounded-lg border p-3" key={post.id}>
                  <input className="input font-medium" aria-label="Blog title" value={value.title} onChange={(e) => setDrafts({ ...drafts, [post.id]: { ...value, title: e.target.value } })} />
                  <select className="input mt-2" aria-label={`Move ${post.title}`} value={status} onChange={(e) => void save(post, e.target.value as Post['status'])}>{COLUMNS.map((column) => <option key={column} value={column}>{column}</option>)}</select>
                  <textarea className="input mt-2 min-h-32" placeholder="Markdown draft" value={value.draft} onChange={(e) => setDrafts({ ...drafts, [post.id]: { ...value, draft: e.target.value } })} />
                  <input className="input mt-2" type="date" aria-label="Target publish date" value={value.targetDate} onChange={(e) => setDrafts({ ...drafts, [post.id]: { ...value, targetDate: e.target.value } })} />
                  {status === 'published' && <input className="input mt-2" type="url" placeholder="Published URL" value={value.publishedUrl} onChange={(e) => setDrafts({ ...drafts, [post.id]: { ...value, publishedUrl: e.target.value } })} />}
                  <div className="mt-2 flex gap-2"><button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void save(post)}>Save</button><button type="button" className="btn !px-2" aria-label={`Delete ${post.title}`} disabled={busy} onClick={() => confirm(`Delete "${post.title}"?`) && void run(() => deleteBlogPost(post.id), 'Blog post deleted')}><Trash2 size={14} /></button></div>
                </article>
              })}
              {!entries.length && <p className="sub py-4 text-center text-xs">No posts here yet.</p>}
            </div>
          </section>
        })}
      </div>
    </div>
  )
}
