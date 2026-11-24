export type CsesProblem = { id: string; title: string; url: string }
export type CsesSection = { name: string; problems: CsesProblem[] }

export const CSES_PRIORITY = [
  'Dynamic Programming',
  'Graph Algorithms',
  'Tree Algorithms',
  'Range Queries',
  'Advanced Graph Problems',
  'Sorting and Searching',
  'Mathematics',
  'String Algorithms',
  'Advanced Techniques',
  'Sliding Window Problems',
  'Introductory Problems',
]

function textFromHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}

export function parseCsesProblemSet(html: string): CsesSection[] {
  const headings = [...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)]
  const sections: CsesSection[] = []
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i]
    const name = textFromHtml(heading[1])
    if (!name) continue
    const start = (heading.index ?? 0) + heading[0].length
    const end = headings[i + 1]?.index ?? html.length
    const body = html.slice(start, end)
    const problems: CsesProblem[] = []
    for (const match of body.matchAll(/<a\b[^>]*href=["']([^"']*\/problemset\/task\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const id = match[2]
      const title = textFromHtml(match[3])
      if (!id || !title || problems.some((p) => p.id === id)) continue
      problems.push({ id, title, url: `https://cses.fi/problemset/task/${id}` })
    }
    if (problems.length) sections.push({ name, problems })
  }
  if (!sections.length) throw new Error('No CSES sections were found. The source page may have changed; use the CSV import instead.')
  return sections
}

export function orderCsesSections(sections: CsesSection[], priority: string[] = CSES_PRIORITY) {
  const ranks = new Map(priority.map((name, index) => [name.toLowerCase(), index]))
  return sections
    .map((section, index) => ({ section, index }))
    .sort((a, b) => {
      const ar = ranks.get(a.section.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      const br = ranks.get(b.section.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER
      return ar - br || a.index - b.index
    })
    .map(({ section }) => section)
}
