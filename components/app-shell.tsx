'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { CalendarClock, CheckCheck, Home, HeartPulse, Route, Settings, PanelLeft, Calculator, Database, Globe, Cpu, MessagesSquare, MoreHorizontal, X, BarChart3, Cloud, Brain, FolderKanban, Trophy, Compass, FileText, ClipboardCheck, Shirt, Code } from 'lucide-react'
import { ThemeToggle } from './theme-toggle'

const GROUPS = [
  { label: 'Dashboard', items: [{ href: '/today', label: 'Today', icon: CheckCheck }, { href: '/dashboard', label: 'Overview', icon: BarChart3 }] },
  { label: 'Plan', items: [{ href: '/schedule', label: 'Schedule', icon: CalendarClock }] },
  { label: 'Habits', items: [{ href: '/habits', label: 'Health & Habits', icon: HeartPulse }, { href: '/home', label: 'Home (mom tasks)', icon: Home }] },
  { label: 'DSA', items: [{ href: '/dsa/roadmap', label: 'Roadmap (60 days)', icon: Route }, { href: '/dsa/cses', label: 'CSES', icon: Code }] },
  {
    label: 'Prep Sheets', items: [
      { href: '/trackers/aptitude', label: 'Aptitude', icon: Calculator }, { href: '/trackers/sql', label: 'SQL', icon: Database },
      { href: '/trackers/aws', label: 'AWS', icon: Cloud }, { href: '/trackers/ml', label: 'Machine Learning', icon: Brain },
      { href: '/trackers/webdev', label: 'Web Dev', icon: Globe }, { href: '/trackers/cs', label: 'CS Fundamentals', icon: Cpu },
      { href: '/trackers/projects', label: 'Projects & Open Source', icon: FolderKanban }, { href: '/trackers/interview', label: 'Interview Prep', icon: MessagesSquare },
    ],
  },
  { label: 'Contests', items: [{ href: '/contests', label: 'Contest Radar & Log', icon: Trophy }] },
  { label: 'Explore', items: [{ href: '/explore', label: 'Explore Topics', icon: Compass }, { href: '/blog', label: 'Blog Pipeline', icon: FileText }, { href: '/weekly-review', label: 'Weekly Review', icon: ClipboardCheck }] },
  { label: 'Phase 2', items: [{ href: '/embroidery', label: "Mom's Embroidery", icon: Shirt }] },
  { label: 'Account', items: [{ href: '/settings', label: 'Settings', icon: Settings }] },
]
const TABS = [
  { href: '/today', label: 'Today', icon: CheckCheck }, { href: '/schedule', label: 'Schedule', icon: CalendarClock },
  { href: '/habits', label: 'Habits', icon: HeartPulse }, { href: '/dsa/roadmap', label: 'DSA', icon: Route },
]

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-primary-fg"><CheckCheck size={16} /></span>
      NoRegret
    </span>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [more, setMore] = useState(false)
  const active = (href: string) => path === href || path.startsWith(href + '/')

  return (
    <div className="min-h-dvh md:flex">
      <aside className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-card transition-[width] duration-200 md:flex ${collapsed ? 'w-16' : 'w-64'}`}>
        <div className="flex h-14 items-center justify-between px-4">
          {!collapsed && <Logo />}
          <button className="btn !px-2" onClick={() => setCollapsed((c) => !c)} aria-label="Toggle sidebar"><PanelLeft size={16} /></button>
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-2 pb-4">
          {GROUPS.map((g) => (
            <div key={g.label}>
              {!collapsed && <p className="px-2 pb-1 text-xs font-medium text-muted">{g.label}</p>}
              {g.items.map(({ href, label, icon: Icon }) => (
                <Link key={href} href={href} title={label}
                  className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors ${active(href) ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-soft'} ${collapsed ? 'justify-center' : ''}`}>
                  <Icon size={16} />{!collapsed && label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="flex items-center justify-between border-t p-3">{!collapsed && <span className="sub">Theme</span>}<ThemeToggle /></div>
      </aside>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Primary">
        {TABS.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`flex flex-col items-center gap-0.5 py-2 text-[11px] ${active(href) ? 'text-primary' : 'text-muted'}`}><Icon size={20} />{label}</Link>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted"><MoreHorizontal size={20} />More</button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 bg-black/40 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 max-h-[80dvh] overflow-y-auto rounded-t-2xl border-t bg-card p-4 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between"><Logo /><div className="flex gap-2"><ThemeToggle /><button className="btn !px-2" onClick={() => setMore(false)} aria-label="Close"><X size={16} /></button></div></div>
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-3">
                <p className="pb-1 text-xs font-medium text-muted">{g.label}</p>
                <div className="grid grid-cols-2 gap-2">
                  {g.items.map(({ href, label, icon: Icon }) => (
                    <Link key={href} href={href} onClick={() => setMore(false)} className="btn justify-start"><Icon size={16} />{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
