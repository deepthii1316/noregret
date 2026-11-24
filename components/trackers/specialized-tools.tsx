'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ExternalLink, Plus, Trash2 } from 'lucide-react'
import { toast } from '@/components/toast'
import {
  deleteFeatureRow, deleteLearningResource, deletePracticeTest, deleteProject,
  saveContribution, saveGoodFirstIssue, saveLearningResource, savePracticeTest,
  saveProject, setGoodFirstIssueStatus, setLearningResourceDone,
} from '@/lib/feature-actions'

type PracticeTest = { id: string; date: string; source: string; score: number | null; weak_topics: string | null; notes: string | null }
type Resource = { id: string; title: string; kind: string; url: string | null; notes: string | null; completed: boolean }
type Project = { id: string; name: string; repo_url: string | null; status: 'idea' | 'building' | 'shipped'; stack: string | null; notes: string | null }
type Contribution = { id: string; repository: string; issue_url: string | null; status: string; notes: string | null }
type Issue = { id: string; repository: string; issue_url: string; notes: string | null; status: 'watching' | 'claimed' | 'dismissed' }
type Props = {
  trackerKey: string
  today: string
  tests: PracticeTest[]
  resources: Resource[]
  projects: Project[]
  contributions: Contribution[]
  issues: Issue[]
  awsCert: string
  examDate: string | null
  sqlPlaylistUrl: string | null
  dailySolved: number
}

export function SpecializedTools(p: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [test, setTest] = useState({ date: p.today, source: '', score: '', weakTopics: '' })
  const [resource, setResource] = useState<{ title: string; kind: 'course' | 'paper' | 'notebook' | 'playlist' | 'other'; url: string; notes: string }>({ title: '', kind: 'course', url: '', notes: '' })
  const [project, setProject] = useState({ name: '', repoUrl: '', stack: '' })
  const [contribution, setContribution] = useState({ repository: '', issueUrl: '' })
  const [issue, setIssue] = useState({ repository: '', issueUrl: '' })

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true)
    try { await action(); toast(success); router.refresh() }
    catch (error) { toast((error as Error).message) }
    finally { setBusy(false) }
  }

  if (p.trackerKey === 'aws') {
    const daysLeft = p.examDate ? Math.ceil((new Date(`${p.examDate}T00:00:00Z`).getTime() - new Date(`${p.today}T00:00:00Z`).getTime()) / 86400000) : null
    const scores = [...p.tests].filter((entry) => entry.score !== null).sort((a, b) => a.date.localeCompare(b.date))
    const maxScore = Math.max(100, ...scores.map((entry) => Number(entry.score)))
    return (
      <section className="card space-y-4 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="font-semibold">AWS certification</h2><p className="sub">{p.awsCert}</p></div>
          {daysLeft !== null && <span className="chip bg-primary/10 text-primary">{daysLeft < 0 ? 'Exam date passed' : `${daysLeft} days to exam`}</span>}
        </div>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
          event.preventDefault()
          if (!test.source.trim()) return toast('Enter the practice test source')
          void run(() => savePracticeTest({ trackerKey: 'aws', date: test.date, source: test.source, score: test.score === '' ? null : Number(test.score), weakTopics: test.weakTopics }), 'Practice test saved')
          setTest({ date: p.today, source: '', score: '', weakTopics: '' })
        }}>
          <input className="input" type="date" value={test.date} onChange={(e) => setTest({ ...test, date: e.target.value })} aria-label="Test date" />
          <input className="input" placeholder="Source (e.g. Udemy)" value={test.source} onChange={(e) => setTest({ ...test, source: e.target.value })} />
          <input className="input" type="number" min="0" max="100" step="0.1" placeholder="Score %" value={test.score} onChange={(e) => setTest({ ...test, score: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}><Plus size={14} />Log test</button>
          <input className="input sm:col-span-4" placeholder="Weak topics" value={test.weakTopics} onChange={(e) => setTest({ ...test, weakTopics: e.target.value })} />
        </form>
        <div className="card bg-soft/50 p-3">
          <h3 className="text-sm font-medium">Practice score trend</h3>
          {scores.length ? <svg viewBox={`0 0 ${Math.max(1, scores.length - 1) * 80 + 20} 120`} className="mt-2 h-28 w-full" role="img" aria-label="AWS practice test score trend">
            {[25, 50, 75, 100].map((line) => <line key={line} x1="0" x2={Math.max(1, scores.length - 1) * 80 + 20} y1={110 - line} y2={110 - line} stroke="var(--border)" />)}
            <polyline fill="none" stroke="#6366f1" strokeWidth="3" points={scores.map((entry, index) => `${index * 80 + 10},${110 - Number(entry.score) / maxScore * 100}`).join(' ')} />
            {scores.map((entry, index) => <circle key={entry.id} cx={index * 80 + 10} cy={110 - Number(entry.score) / maxScore * 100} r="4" fill="#6366f1"><title>{entry.date}: {entry.score}%</title></circle>)}
          </svg> : <p className="sub mt-2">Log a practice test to start the trend.</p>}
        </div>
        <ul className="divide-y">
          {p.tests.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span>{entry.date} · {entry.source}</span><span className="sub">{entry.score === null ? 'Score not entered' : `${entry.score}%`}</span><span className="sub flex-1">{entry.weak_topics}</span><button className="btn !px-2" aria-label="Delete test" onClick={() => void run(() => deletePracticeTest(entry.id), 'Test deleted')}><Trash2 size={14} /></button></li>)}
        </ul>
        <ResourceLinks />
      </section>
    )
  }

  if (p.trackerKey === 'ml' || p.trackerKey === 'sql') {
    return (
      <section className="card space-y-3 p-4">
        <div><h2 className="font-semibold">{p.trackerKey === 'ml' ? 'Courses, papers & notebooks' : 'SQL resources'}</h2><p className="sub">Keep learning resources with your topic progress.</p></div>
        {p.trackerKey === 'sql' && <p className="sub">Solved today: {p.dailySolved} / 3 problems</p>}
        {p.trackerKey === 'sql' && <div className="flex flex-wrap gap-2"><a className="btn" href="https://datalemur.com/questions" target="_blank" rel="noreferrer"><ExternalLink size={14} />DataLemur problems</a>{p.sqlPlaylistUrl && <a className="btn" href={p.sqlPlaylistUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Ankit Bansal's SQL playlist</a>}</div>}
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
          event.preventDefault()
          if (!resource.title.trim()) return toast('Enter a resource title')
          void run(() => saveLearningResource({ trackerKey: p.trackerKey as 'ml' | 'sql', ...resource }), 'Resource saved')
          setResource({ title: '', kind: 'course', url: '', notes: '' })
        }}>
          <input className="input" placeholder="Title" value={resource.title} onChange={(e) => setResource({ ...resource, title: e.target.value })} />
          <select className="input" value={resource.kind} onChange={(e) => setResource({ ...resource, kind: e.target.value as typeof resource.kind })}><option value="course">Course</option><option value="paper">Paper</option><option value="notebook">Notebook</option><option value="playlist">Playlist</option><option value="other">Other</option></select>
          <input className="input" type="url" placeholder="URL (optional)" value={resource.url} onChange={(e) => setResource({ ...resource, url: e.target.value })} />
          <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add resource</button>
          <input className="input sm:col-span-4" placeholder="Notes (optional)" value={resource.notes} onChange={(e) => setResource({ ...resource, notes: e.target.value })} />
        </form>
        <ul className="divide-y">
          {p.resources.map((entry) => <li key={entry.id} className="flex items-center gap-2 py-2 text-sm">
            <button type="button" className={`grid h-6 w-6 place-items-center rounded border ${entry.completed ? 'bg-primary text-white' : ''}`} aria-label={`${entry.completed ? 'Mark incomplete' : 'Mark complete'}: ${entry.title}`} onClick={() => void run(() => setLearningResourceDone(entry.id, !entry.completed), 'Resource updated')}>{entry.completed && <Check size={14} />}</button>
            <span className={`flex-1 ${entry.completed ? 'line-through text-muted' : ''}`}>{entry.title} <span className="sub">({entry.kind})</span></span>
            {entry.url && <a className="btn !px-2" href={entry.url} target="_blank" rel="noreferrer" aria-label={`Open ${entry.title}`}><ExternalLink size={14} /></a>}
            <button className="btn !px-2" aria-label={`Delete ${entry.title}`} onClick={() => void run(() => deleteLearningResource(entry.id), 'Resource deleted')}><Trash2 size={14} /></button>
          </li>)}
          {!p.resources.length && <li className="sub py-2">No resources logged yet.</li>}
        </ul>
      </section>
    )
  }

  if (p.trackerKey === 'projects') {
    return (
      <section className="space-y-4">
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Projects</h2>
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(event) => {
            event.preventDefault()
            if (!project.name.trim()) return toast('Enter a project name')
            void run(() => saveProject({ ...project, status: 'idea' }), 'Project added')
            setProject({ name: '', repoUrl: '', stack: '' })
          }}>
            <input className="input" placeholder="Project name" value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
            <input className="input" type="url" placeholder="Repository URL" value={project.repoUrl} onChange={(e) => setProject({ ...project, repoUrl: e.target.value })} />
            <input className="input" placeholder="Stack" value={project.stack} onChange={(e) => setProject({ ...project, stack: e.target.value })} />
            <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add project</button>
          </form>
          <ul className="divide-y">
            {p.projects.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="min-w-32 flex-1 font-medium">{entry.name}</span>
              {entry.repo_url && <a href={entry.repo_url} target="_blank" rel="noreferrer" aria-label={`Open ${entry.name} repository`}><ExternalLink size={14} /></a>}
              <span className="sub">{entry.stack}</span>
              <select className="input !w-auto" aria-label={`Status of ${entry.name}`} value={entry.status} onChange={(e) => void run(() => saveProject({ id: entry.id, name: entry.name, repoUrl: entry.repo_url ?? '', status: e.target.value as Project['status'], stack: entry.stack ?? undefined, notes: entry.notes ?? undefined }), 'Project updated')}><option value="idea">Idea</option><option value="building">Building</option><option value="shipped">Shipped</option></select>
              <button className="btn !px-2" aria-label={`Delete ${entry.name}`} onClick={() => void run(() => deleteProject(entry.id), 'Project deleted')}><Trash2 size={14} /></button>
            </li>)}
            {!p.projects.length && <li className="sub py-2">Add a project to begin tracking it.</li>}
          </ul>
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">PR / contribution log</h2>
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
            event.preventDefault()
            if (!contribution.repository.trim()) return toast('Enter a repository')
            void run(() => saveContribution({ ...contribution, status: 'exploring' }), 'Contribution added')
            setContribution({ repository: '', issueUrl: '' })
          }}>
            <input className="input" placeholder="Repository" value={contribution.repository} onChange={(e) => setContribution({ ...contribution, repository: e.target.value })} />
            <input className="input" type="url" placeholder="Issue or PR URL" value={contribution.issueUrl} onChange={(e) => setContribution({ ...contribution, issueUrl: e.target.value })} />
            <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add contribution</button>
          </form>
          <ul className="divide-y">{p.contributions.map((entry) => <li key={entry.id} className="flex items-center gap-2 py-2 text-sm"><span className="flex-1">{entry.repository}</span><span className="sub">{entry.status.replace('_', ' ')}</span>{entry.issue_url && <a href={entry.issue_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a>}<button className="btn !px-2" aria-label="Delete contribution" onClick={() => void run(() => deleteFeatureRow('contributions', entry.id), 'Contribution deleted')}><Trash2 size={14} /></button></li>)}</ul>
        </div>
        <div className="card space-y-3 p-4">
          <h2 className="font-semibold">Good first issues I'm eyeing</h2>
          <form className="grid gap-2 sm:grid-cols-3" onSubmit={(event) => {
            event.preventDefault()
            if (!issue.repository.trim() || !issue.issueUrl.trim()) return toast('Enter a repository and issue URL')
            void run(() => saveGoodFirstIssue(issue), 'Issue saved')
            setIssue({ repository: '', issueUrl: '' })
          }}>
            <input className="input" placeholder="Repository" value={issue.repository} onChange={(e) => setIssue({ ...issue, repository: e.target.value })} />
            <input className="input" type="url" placeholder="Issue URL" value={issue.issueUrl} onChange={(e) => setIssue({ ...issue, issueUrl: e.target.value })} />
            <button className="btn btn-primary" disabled={busy}><Plus size={14} />Add issue</button>
          </form>
          <ul className="divide-y">{p.issues.map((entry) => <li key={entry.id} className="flex flex-wrap items-center gap-2 py-2 text-sm"><span className="flex-1">{entry.repository}</span><a href={entry.issue_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /></a><select className="input !w-auto" aria-label={`Issue status for ${entry.repository}`} value={entry.status} onChange={(e) => void run(() => setGoodFirstIssueStatus(entry.id, e.target.value as Issue['status']), 'Issue updated')}><option value="watching">Watching</option><option value="claimed">Claimed</option><option value="dismissed">Dismissed</option></select><button className="btn !px-2" aria-label="Delete issue" onClick={() => void run(() => deleteFeatureRow('good_first_issues', entry.id), 'Issue deleted')}><Trash2 size={14} /></button></li>)}</ul>
        </div>
      </section>
    )
  }

  return null
}

function ResourceLinks() {
  const resources = [
    { name: 'AWS Skill Builder', href: 'https://skillbuilder.aws/' },
    { name: 'AWS Documentation', href: 'https://docs.aws.amazon.com/' },
    { name: 'AWS Training', href: 'https://aws.amazon.com/training/' },
  ]
  return <div><h3 className="text-sm font-medium">Resources</h3><div className="mt-2 flex flex-wrap gap-2">{resources.map((resource) => <a className="btn" key={resource.href} href={resource.href} target="_blank" rel="noreferrer"><ExternalLink size={14} />{resource.name}</a>)}</div></div>
}
