export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim() !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim() !== '')) rows.push(row)
  return rows
}
export const toCsv = (rows: string[][]) =>
  rows.map((r) => r.map((c) => (/[",\n\r]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(',')).join('\n')

/** First row is the header (group,title,difficulty,platform,link,notes); header names are case-insensitive. */
export function csvToItemRows(text: string) {
  const [head, ...body] = parseCsv(text)
  if (!head) return []
  const idx = (n: string) => head.findIndex((h) => h.trim().toLowerCase() === n)
  const [g, t, d, p, l, n] = ['group', 'title', 'difficulty', 'platform', 'link', 'notes'].map(idx)
  if (g < 0 || t < 0) throw new Error('CSV needs at least "group" and "title" columns')
  const at = (r: string[], i: number) => (i >= 0 ? (r[i] ?? '').trim() : '')
  return body.map((r) => ({ group: at(r, g), title: at(r, t), difficulty: at(r, d), platform: at(r, p), link: at(r, l), notes: at(r, n) })).filter((r) => r.group && r.title)
}
