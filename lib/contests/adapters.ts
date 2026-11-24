export type UpcomingContest = {
  platform: 'Codeforces' | 'LeetCode' | 'CodeChef'
  externalId: string
  name: string
  url: string
  startTime: string
  durationMinutes: number
}

type AdapterResult = { platform: UpcomingContest['platform']; contests: UpcomingContest[]; error: string | null }

async function getJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

async function codeforces(): Promise<UpcomingContest[]> {
  const data = await getJson('https://codeforces.com/api/contest.list?gym=false')
  if (data.status !== 'OK' || !Array.isArray(data.result)) throw new Error('Unexpected Codeforces response')
  return data.result.filter((contest: any) => contest.phase === 'BEFORE').map((contest: any) => ({
    platform: 'Codeforces',
    externalId: String(contest.id),
    name: String(contest.name),
    url: `https://codeforces.com/contests/${contest.id}`,
    startTime: new Date(Number(contest.startTimeSeconds) * 1000).toISOString(),
    durationMinutes: Math.max(1, Math.round(Number(contest.durationSeconds) / 60)),
  }))
}

async function leetcode(): Promise<UpcomingContest[]> {
  const data = await getJson('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'NoRegret study tracker' },
    body: JSON.stringify({ query: '{ upcomingContests { title titleSlug startTime duration } }' }),
  })
  const list = data?.data?.upcomingContests
  if (!Array.isArray(list)) throw new Error(data?.errors?.[0]?.message ?? 'Unexpected LeetCode response')
  return list.map((contest: any) => ({
    platform: 'LeetCode',
    externalId: String(contest.titleSlug),
    name: String(contest.title),
    url: `https://leetcode.com/contest/${contest.titleSlug}/`,
    startTime: new Date(Number(contest.startTime) * 1000).toISOString(),
    durationMinutes: Math.max(1, Math.round(Number(contest.duration) / 60)),
  }))
}

async function codechef(): Promise<UpcomingContest[]> {
  const data = await getJson('https://www.codechef.com/api/list/contests/all')
  const list = data?.future_contests
  if (!Array.isArray(list)) throw new Error('Unexpected CodeChef response')
  return list.map((contest: any) => {
    const start = new Date(contest.contest_start_date_iso ?? contest.contest_start_date)
    const end = new Date(contest.contest_end_date_iso ?? contest.contest_end_date)
    return {
      platform: 'CodeChef' as const,
      externalId: String(contest.contest_code),
      name: String(contest.contest_name),
      url: `https://www.codechef.com/${contest.contest_code}`,
      startTime: start.toISOString(),
      durationMinutes: Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000)),
    }
  }).filter((contest: UpcomingContest) => Number.isFinite(Date.parse(contest.startTime)) && contest.durationMinutes > 0)
}

export async function fetchUpcomingContests(): Promise<AdapterResult[]> {
  const adapters: [AdapterResult['platform'], () => Promise<UpcomingContest[]>][] = [
    ['Codeforces', codeforces], ['LeetCode', leetcode], ['CodeChef', codechef],
  ]
  return Promise.all(adapters.map(async ([platform, load]) => {
    try { return { platform, contests: await load(), error: null } }
    catch (error) { return { platform, contests: [], error: error instanceof Error ? error.message : 'Unknown source error' } }
  }))
}
