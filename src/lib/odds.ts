import type { Game, Spread } from '../types'

// PROJECT_SPEC.md Section 4.7/22: The Odds API, used to auto-fill spreads
// and totals. Unlike ESPN's scoreboard endpoint (src/lib/espn.ts), this one
// needs a paid-looking-but-actually-free API key, embedded directly in the
// public frontend bundle — accepted tradeoff, see PROJECT_SPEC.md Section 3
// and the no-auth/no-backend constraints it documents. `regions=us` +
// `markets=spreads,totals` costs 2 credits per call (free tier: 500/month),
// and this returns odds for EVERY upcoming NFL game in one call, not one
// game at a time — so "Fetch Odds" is a single button per week, not
// per-game like ESPN's score fetch.
const ODDS_API_URL = 'https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds/'

// Same loose, case-insensitive substring matching as espn.ts's
// teamNameMatches — kept as its own copy rather than a shared util since
// each API's naming quirks could diverge later, and this is only a few
// lines. The Odds API returns full official names ("Kansas City Chiefs");
// we store just the nickname ("Chiefs").
function teamNameMatches(ourName: string, apiName: string): boolean {
  return apiName.toLowerCase().includes(ourName.toLowerCase())
}

interface OddsApiOutcome {
  name: string
  price: number
  point?: number
}

interface OddsApiMarket {
  key: 'spreads' | 'totals'
  outcomes: OddsApiOutcome[]
}

interface OddsApiBookmaker {
  key: string
  markets: OddsApiMarket[]
}

interface OddsApiEvent {
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: OddsApiBookmaker[]
}

// What we actually need out of one API event, reduced down to a single
// chosen bookmaker's numbers. `favoredSide`/`line` are kept in terms of
// home/away (not a team name) deliberately: the API's own team-name
// strings ("Kansas City Chiefs") don't match what we store on our Game
// documents ("Chiefs"), and settlement compares Spread.favoredTeam by
// exact string equality against our OWN homeTeam/awayTeam fields — see
// toGameSpread below, which is where that conversion actually happens,
// once we have the real Game record to convert against.
export interface OddsForGame {
  homeTeamRaw: string
  awayTeamRaw: string
  // ISO 8601 string straight from the API — kept as-is (not yet a
  // Firestore Timestamp) since this module doesn't otherwise touch
  // Firestore types; ImportWildCardGames.tsx converts it at the point
  // where it actually builds a Game to save.
  commenceTime: string
  favoredSide: 'home' | 'away' | null
  line: number | null
  total: number | null
}

export type FetchOddsResult =
  | { status: 'ok'; events: OddsForGame[] }
  | { status: 'no-key' }
  | { status: 'error'; message: string }

// Per Stephen (2026-09-08): prefer DraftKings' line since it's the most
// widely recognized US book, so the number will look familiar to the
// group; fall back to whichever bookmaker the API lists first if
// DraftKings didn't post a line for this game.
function pickBookmaker(bookmakers: OddsApiBookmaker[]): OddsApiBookmaker | null {
  if (bookmakers.length === 0) return null
  return bookmakers.find((b) => b.key === 'draftkings') ?? bookmakers[0]
}

// Reads one bookmaker's "spreads" market and figures out which SIDE
// (home/away) is favored, plus the line magnitude. The API gives each
// team's own signed point (negative = favored); whichever outcome's point
// is lower is the favorite. `favoredOutcome.name` is compared against the
// event's own home_team string (both sourced from the same API event, so
// this is safe as an exact-string check — unlike matching against OUR
// team names, which needs the loose substring match in findMatchingOdds).
// On a true pick'em (both sides at 0), there's no real favorite; we
// arbitrarily call it "home" at a 0 line, which is harmless since a
// 0-line spread pays the same regardless of which side you're "favored"
// on.
function parseSpread(
  market: OddsApiMarket | undefined,
  homeTeamRaw: string,
): { favoredSide: 'home' | 'away'; line: number } | null {
  if (!market) return null
  const [a, b] = market.outcomes
  if (a?.point == null || b?.point == null) return null
  const aPoint = a.point
  const bPoint = b.point
  const favoredOutcome = aPoint <= bPoint ? a : b
  const favoredPoint = aPoint <= bPoint ? aPoint : bPoint
  return {
    favoredSide: favoredOutcome.name === homeTeamRaw ? 'home' : 'away',
    line: Math.abs(favoredPoint),
  }
}

// "totals" market has two outcomes (Over/Under) sharing the same point —
// either one gives us the line.
function parseTotal(market: OddsApiMarket | undefined): number | null {
  return market?.outcomes[0]?.point ?? null
}

export async function fetchNflOdds(): Promise<FetchOddsResult> {
  const apiKey = import.meta.env.VITE_ODDS_API_KEY as string | undefined
  if (!apiKey) return { status: 'no-key' }

  const url = `${ODDS_API_URL}?apiKey=${apiKey}&regions=us&markets=spreads,totals&oddsFormat=american&dateFormat=iso`
  let events: OddsApiEvent[]
  try {
    const response = await fetch(url)
    if (!response.ok) {
      return { status: 'error', message: `The Odds API returned HTTP ${response.status}` }
    }
    events = (await response.json()) as OddsApiEvent[]
  } catch (err) {
    return {
      status: 'error',
      message: err instanceof Error ? err.message : 'Network request failed',
    }
  }

  return {
    status: 'ok',
    events: events.map((event) => {
      const bookmaker = pickBookmaker(event.bookmakers)
      const spreadsMarket = bookmaker?.markets.find((m) => m.key === 'spreads')
      const totalsMarket = bookmaker?.markets.find((m) => m.key === 'totals')
      const spread = parseSpread(spreadsMarket, event.home_team)
      return {
        homeTeamRaw: event.home_team,
        awayTeamRaw: event.away_team,
        commenceTime: event.commence_time,
        favoredSide: spread?.favoredSide ?? null,
        line: spread?.line ?? null,
        total: parseTotal(totalsMarket),
      }
    }),
  }
}

// Finds the odds-API event matching a given game's stored team names, if
// any — same loose substring matching as ESPN's fetchEspnScore. Both our
// team names have to match (not just one) so e.g. "Jets" doesn't
// accidentally match a Giants @ Jets AND a Jets @ [someone else] event
// (not that both would appear in one week, but matching both sides is
// cheap insurance regardless).
export function findMatchingOdds(
  events: OddsForGame[],
  homeTeam: string,
  awayTeam: string,
): OddsForGame | null {
  return (
    events.find(
      (e) => teamNameMatches(homeTeam, e.homeTeamRaw) && teamNameMatches(awayTeam, e.awayTeamRaw),
    ) ?? null
  )
}

// The Odds API returns full official names ("Kansas City Chiefs"); we
// store just the nickname ("Chiefs") everywhere else in this app. Every
// current NFL team name's nickname is its last whitespace-separated word
// (including multi-word cases like "Buccaneers", "49ers", "Commanders"),
// so a simple last-token split covers all 32 teams without needing a
// lookup table. Used by ImportWildCardGames.tsx when creating a brand new
// Game from an API event, where there's no existing Game.homeTeam/
// awayTeam to match against yet.
export function nicknameFromFullName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return parts[parts.length - 1]
}

// Converts a matched OddsForGame into the Spread shape our own Game
// documents store, using OUR game's own homeTeam/awayTeam strings (never
// the API's raw names) — this is what keeps favoredTeam exactly equal to
// one of the two strings settlement already compares against.
export function toGameSpread(odds: OddsForGame, game: Pick<Game, 'homeTeam' | 'awayTeam'>): Spread | null {
  if (odds.favoredSide == null || odds.line == null) return null
  return {
    favoredTeam: odds.favoredSide === 'home' ? game.homeTeam : game.awayTeam,
    line: odds.line,
  }
}
