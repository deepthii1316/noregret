'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/components/toast'
import { deleteExploreTopic, saveExploreSession, saveExploreTopic } from '@/lib/feature-actions'
import { todayIn, DEFAULT_TZ } from '@/lib/time'

type Topic = { id: string; title: string; status: 'idea' | 'exploring' | 'explored'; notes: string | null; resources: { name: string; url: string }[]; key_learnings: string | null }
type Session = { id: string; topic_id: string; date: string; minutes: number; notes: string | null }

export function ExploreClient({ topics, sessions }: { topics: Topic[]; sessions: Session[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [drafts, setDrafts] = useState<Record<string, { title: string; status: Topic['status']; notes: string; resources: string; learnings: string }>>({})
  const [sessionDraft, setSessionDraft] = useState<Record<string, { date: string; minutes: string; notes: string }>>({})

  const draftFor = (topic: Topic) => drafts[topic.id] ?? {
    title: topic.title, status: topic.status, notes: topic.notes ?? '',
    resources: topic.resources.map((resource) => `${resource.name}|${resource.url}`).join('\n'), learnings: topic.key_learnings ?? '',
  }
  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true)
    try { await action(); toast(message); router.refresh() }
    catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="space-y-5">
      <header><h1 className="h1">Explore Topics</h1><p className="sub">Capture notes, useful resources, key learnings, and focused sessions.</p></header>
      <form className="flex gap-2" onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        void run(() => saveExploreTopic({ title, status: 'idea' }), 'Topic added')
        setTitle('')
      }}>
        <input className="input" placeholder="Add a topic" value={title} onChange={(e) => setTitle(e.target.value)} />
        <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add topic</button>
      </form>
      <div className="space-y-3">
        {topics.map((topic) => {
          const draft = draftFor(topic)
          const topicSessions = sessions.filter((session) => session.topic_id === topic.id)
          const session = sessionDraft[topic.id] ?? { date: todayIn(DEFAULT_TZ), minutes: '60', notes: '' }
          return (
            <section key={topic.id} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <input className="input min-w-48 flex-1 font-medium" aria-label="Topic title" value={draft.title} onChange={(e) => setDrafts({ ...drafts, [topic.id]: { ...draft, title: e.target.value } })} />
                <select className="input !w-auto" aria-label={`Status of ${topic.title}`} value={draft.status} onChange={(e) => setDrafts({ ...drafts, [topic.id]: { ...draft, status: e.target.value as Topic['status'] } })}><option value="idea">Idea</option><option value="exploring">Exploring</option><option value="explored">Explored</option></select>
                <button className="btn" disabled={busy} onClick={() => void run(() => saveExploreTopic({ id: topic.id, ...draft }), 'Topic saved')}>Save</button>
                <button className="btn !px-2" aria-label={`Delete ${topic.title}`} disabled={busy} onClick={() => confirm(`Delete ${topic.title} and its sessions?`) && void run(() => deleteExploreTopic(topic.id), 'Topic deleted')}><Trash2 size={14} /></button>
              </div>
              <textarea className="input min-h-20" placeholder="Notes" value={draft.notes} onChange={(e) => setDrafts({ ...drafts, [topic.id]: { ...draft, notes: e.target.value } })} />
              <label className="block text-sm">Resources <span className="sub text-xs">(one per line: name|https://url)</span><textarea className="input mt-1 min-h-16" value={draft.resources} onChange={(e) => setDrafts({ ...drafts, [topic.id]: { ...draft, resources: e.target.value } })} /></label>
              <label className="block text-sm">Key learnings<textarea className="input mt-1 min-h-24" value={draft.learnings} onChange={(e) => setDrafts({ ...drafts, [topic.id]: { ...draft, learnings: e.target.value } })} /></label>
              {topic.resources.length > 0 && <div className="flex flex-wrap gap-2">{topic.resources.map((resource) => <a className="btn" href={resource.url} key={`${resource.name}-${resource.url}`} target="_blank" rel="noreferrer"><ExternalLink size={14} />{resource.name}</a>)}</div>}
              <div className="border-t pt-3">
                <h3 className="text-sm font-medium">Sessions · {topicSessions.reduce((total, entry) => total + entry.minutes, 0)} minutes</h3>
                <form className="mt-2 grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
                  event.preventDefault()
                  void run(() => saveExploreSession({ topicId: topic.id, date: session.date, minutes: Number(session.minutes), notes: session.notes }), 'Session saved')
                  setSessionDraft({ ...sessionDraft, [topic.id]: { date: todayIn(DEFAULT_TZ), minutes: '60', notes: '' } })
                }}>
                  <input className="input" type="date" value={session.date} onChange={(e) => setSessionDraft({ ...sessionDraft, [topic.id]: { ...session, date: e.target.value } })} />
                  <input className="input" type="number" min="1" value={session.minutes} aria-label="Session minutes" onChange={(e) => setSessionDraft({ ...sessionDraft, [topic.id]: { ...session, minutes: e.target.value } })} />
                  <input className="input" placeholder="Session notes" value={session.notes} onChange={(e) => setSessionDraft({ ...sessionDraft, [topic.id]: { ...session, notes: e.target.value } })} />
                  <button className="btn btn-primary" disabled={busy}><Plus size={14} />Log session</button>
                </form>
                {topicSessions.map((entry) => <p className="sub mt-1 text-xs" key={entry.id}>{entry.date} · {entry.minutes} min{entry.notes ? ` · ${entry.notes}` : ''}</p>)}
              </div>
            </section>
          )
        })}
        {!topics.length && <div className="card p-6 text-center sub">No topics yet. Run the seed script to add the starter topics.</div>}
      </div>
    </div>
  )
}
