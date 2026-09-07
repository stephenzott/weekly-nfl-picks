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
  result: PickResult
  isDefaultLoss: boolean
}

export type WinTotalSide = 'over' | 'under'

export interface SeasonWinTotal {
  id: string
  userId: string
  team: string
  line: number
  side: WinTotalSide
  stake: number // always 20
  actualWins: number | null
  result: PickResult
}

export interface SuperBowlProp {
  id: string
  userId: string
  propType: string // free text, e.g. "coinToss", "passingYards"
  description: string // e.g. "Sam Darnold Passing Yards"
  line: number | null // null for something like coin toss
  pick: string
  stake: number
  result: PickResult
}
