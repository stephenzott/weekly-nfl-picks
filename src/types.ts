// TypeScript types mirroring the Firestore data model described in
// PROJECT_SPEC.md Section 5. Keeping these in one file means every part of
// the app agrees on the exact shape of a "week" or "game" — if you rename a
// field here, TypeScript will flag every place that used the old name,
// instead of that mismatch only showing up as a bug at runtime.
import type { Timestamp } from 'firebase/firestore'

export interface User {
  id: string
  name: string
}

export type WeekType = 'regular' | 'playoff'

export interface Week {
  id: string
  label: string // e.g. "Week 1", "Wild Card", "Super Bowl"
  type: WeekType
  budget: number // almost always 120
  // Added 2026-09-08: which WildCardPool game the admin has manually
  // designated as this week's "Highest Spread" pick. Previously computed
  // automatically (largest |spread| among WildCardPool games) — changed
  // per Stephen so the admin has final say, informed by the auto-fetched
  // spread/total numbers rather than blindly trusting them. null/undefined
  // until the admin picks one; see computeSlotsForRegularWeek in
  // src/lib/slots.ts.
  highSpreadGameId?: string | null
}

export type GameSlot =
  | 'AM'
  | 'PM'
  | 'SNF'
  | 'MNF'
  | 'WildCardPool'
  | 'Bonus'
  | 'Playoff'

export interface Spread {
  favoredTeam: string
  line: number // stored as a positive number of points, e.g. 8.5
}

export interface FinalScore {
  home: number
  away: number
}

export type GameStatus = 'scheduled' | 'final'
export type LineSource = 'api' | 'manual'

export interface Game {
  id: string
  weekId: string
  slot: GameSlot
  homeTeam: string
  awayTeam: string
  // Firestore stores this as a Timestamp; we convert to a JS Date at the
  // edges (read/write) so the rest of the app just uses plain Dates.
  kickoffTime: Timestamp
  spread: Spread | null
  total: number | null
  finalScore: FinalScore | null
  status: GameStatus
  lineSource: LineSource
}

export type PickType =
  | 'AM'
  | 'PM'
  | 'SNF'
  | 'MNF'
  | 'WildCard'
  | 'HighSpread'
  | 'Bonus'
  | 'Playoff'

export type PickResult = 'win' | 'loss' | 'push' | 'pending'
export type TotalSide = 'over' | 'under'

export interface Pick {
  id: string
  userId: string
  gameId: string
  weekId: string
  // May differ from the game's own `slot` — e.g. the same WildCardPool game
  // could be one user's "WildCard" pick and simultaneously another user's
  // auto-computed "HighSpread" pick (PROJECT_SPEC.md Section 5).
  pickType: PickType
  spreadSide: string // e.g. "Eagles -8.5"
  spreadStake: number // >= 10
  totalSide: TotalSide | null
  totalStake: number | null // always equals spreadStake when totalSide is set
  result: PickResult // the SPREAD bet's result
  // The total bet's result, settled independently from `result` above —
  // a pick's spread and total can win/lose/push differently (e.g. the
  // spread covers while the total pushes). null whenever totalSide is
  // null (no total bet placed). Added during build (2026-09-07): the
  // spec's original one-`result`-per-pick shape had no way to record two
  // independent outcomes on the same document.
  totalResult: PickResult | null
  // True when this pick was auto-generated because the user never saved
  // one before kickoff — src/lib/missedPicks.ts coin-flips a real side
  // (and, if this is the last slot the user has left this week, a stake
  // that closes the week out to exactly its budget) rather than the
  // original "$10 automatic loss" rule, per Stephen (2026-09-11). It still
  // settles normally (win/loss/push) like any other pick — this flag is
  // for display only (e.g. RevealedPicks.tsx labeling it "auto-picked"),
  // not for special-casing settlement or the standings record anymore.
  isAutoPick: boolean
}

export type WinTotalSide = 'over' | 'under'

export interface SeasonWinTotal {
  id: string
  userId: string
  team: string
  line: number
  side: WinTotalSide
  // Changed during build (decided with Stephen, 2026-09-08): the spec
  // originally called for a flat $20 per bet (4 bets, no allocation
  // choice). Stephen changed this to a $100 total freely split across the
  // 4 required bets, same "user allocates, $10 minimum per bet" model as
  // the weekly $120 picks budget — see SEASON_WIN_TOTAL_BUDGET in
  // src/lib/constants.ts.
  stake: number
  actualWins: number | null
  result: PickResult
}

// PROJECT_SPEC.md Section 5 originally put propType/description/line
// directly on `SuperBowlProp` alongside userId/pick/stake — but that would
// mean 5 users betting on the SAME prop (e.g. the same coin toss) each
// need their own copy of the prop's description/line, with no single
// source of truth for "what is this prop, and what's its line." Split
// during build (decided with Stephen, 2026-09-07) to mirror the
// games/picks pattern: admins create ONE PropDefinition per prop, and each
// user's individual pick against it is a separate SuperBowlProp
// referencing it by id.
export interface PropDefinition {
  id: string
  weekId: string // the Super Bowl week
  propType: string // free text/flexible, e.g. "coinToss", "passingYards"
  description: string // e.g. "Sam Darnold Passing Yards"
  line: number | null // null for something like coin toss
  // Task #10 (2026-09-08): when `line` is null, users need a fixed set of
  // options to pick from rather than typing free text (avoids "Heads" vs
  // "heads" vs "H" turning settlement into a guessing game) — e.g.
  // ["Heads", "Tails"]. Always null when `line` is set, since a lined prop
  // is implicitly an Over/Under choice.
  choices: string[] | null
  // The real-world outcome, entered once by an admin after the fact, used
  // to auto-settle EVERY user's SuperBowlProp pick against this
  // definition in one shot (same "settle once, applies to everyone"
  // pattern as game scores) — see settlePropPick in src/lib/settlement.ts.
  // Exactly one of these two is ever set, matching whichever of
  // line/choices this definition uses; both start null and stay that way
  // until the real result is known.
  actualValue: number | null // the real final stat, when `line` is set
  correctChoice: string | null // the real correct answer, when `choices` is set
}

export interface SuperBowlProp {
  id: string
  userId: string
  propDefinitionId: string
  pick: string // the side/answer this user chose — one of the definition's `choices`, or "Over"/"Under" when it's a lined prop
  stake: number
  result: PickResult
}
