import type { Game } from '../types'

// PROJECT_SPEC.md Section 2: ESPN's public scoreboard endpoint, used to
// help auto-fill final scores. Unlike The Odds API, this needs no API key,
// so there's no blocker on attempting it now — but it's explicitly called
// out as "unofficial/undocumented... could change without notice," so
// every caller of this function MUST keep manual score entry available as
// a fallback, never treat this as the only path to recording a score.
const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

export type EspnScoreResult =
  | { status: 'final'; home: number; away: number }
  | { status: 'not-final' }
  | { status: 'not-found' }
  | { status: 'error'; message: string }

function formatDateParam(date: Date): string {
  // ESPN's `dates` query param wants YYYYMMDD. We use the LOCAL calendar
  // date (not UTC) on the assumption that whoever entered the kickoff time
  // in the Admin tab did so in their own local time, which for this app is
  // effectively always US Eastern anyway (see PROJECT_SPEC.md Section
  // 4.1's "1pm ET" framing) — a mismatch could only realistically happen
  // for a game kicking off right around midnight ET.
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}${month}${day}`
}

// Very loose matching: ESPN's team names ("Philadelphia Eagles") always
// contain the nickname we store ("Eagles"), so a case-insensitive
// substring check is enough without needing a full team-name mapping
// table — and using a mapping table would be one more thing to keep in
// sync if ESPN ever renames/relocates a team.
function teamNameMatches(ourName: string, espnName: string): boolean {
  return espnName.toLowerCase().includes(ourName.toLowerCase())
}

interface EspnCompetitor {
  homeAway: 'home' | 'away'
  team?: { displayName?: string; shortDisplayName?: string; name?: string }
  score?: string
}

interface EspnEvent {
  competitions?: Array<{
    status?: { type?: { completed?: boolean } }
    competitors?: EspnCompetitor[]
  }>
}

export async function fetchEspnScore(game: Game): Promise<EspnScoreResult> {
  const dateParam = formatDateParam(game.kickoffTime.toDate())
  let events: EspnEvent[]
  try {
    const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateParam}`)
    if (!response.ok) {
      return { status: 'error', message: `ESPN returned HTTP ${response.status}` }
    }
    const data = (await response.json()) as { events?: EspnEvent[] }
    events = data.events ?? []
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network request failed',
    }
  }

  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors
    if (!competitors) continue

    const homeC = competitors.find((c) => c.homeAway === 'home')
    const awayC = competitors.find((c) => c.homeAway === 'away')
    if (!homeC?.team || !awayC?.team) continue

    const homeMatches = [homeC.team.displayName, homeC.team.shortDisplayName, homeC.team.name].some(
      (name) => name && teamNameMatches(game.homeTeam, name),
    )
    const awayMatches = [awayC.team.displayName, awayC.team.shortDisplayName, awayC.team.name].some(
      (name) => name && teamNameMatches(game.awayTeam, name),
    )
    if (!homeMatches || !awayMatches) continue

    const completed = event.competitions?.[0]?.status?.type?.completed === true
    if (!completed) return { status: 'not-final' }

    const home = Number(homeC.score)
    const away = Number(awayC.score)
    if (Number.isNaN(home) || Number.isNaN(away)) {
      return { status: 'error', message: 'ESPN returned a non-numeric score' }
    }
    return { status: 'final', home, away }
  }

  return { status: 'not-found' }
}
