import type { Pick, PickResult, SeasonWinTotal, User, Week } from '../types'

// PROJECT_SPEC.md Section 4.3: "even-money payouts" (risk $X, win $X, no
// vig/juice). A win nets +stake, a loss nets -stake, and a push/pending bet
// has no money impact at all yet. This one function encodes that rule so
// every place that turns a result into a dollar amount (spread leg, total
// leg, season win totals) agrees with each other.
function payout(result: PickResult, stake: number): number {
  if (result === 'win') return stake
  if (result === 'loss') return -stake
  return 0 // 'push' returns the stake with no profit/loss; 'pending' hasn't happened yet
}

// A pick can carry TWO independent bets on one document — the spread leg
// (always present) and the mirrored total leg (only when totalSide was
// chosen) — so its net is the sum of both legs' payouts, not just one.
export function pickNet(pick: Pick): number {
  const spreadNet = payout(pick.result, pick.spreadStake)
  const totalNet = pick.totalSide == null ? 0 : payout(pick.totalResult ?? 'pending', pick.totalStake ?? 0)
  return spreadNet + totalNet
}

// Season Win Totals (PROJECT_SPEC.md Section 4.4) are always a single flat
// $20 bet with one result, no mirrored second leg — much simpler than a
// weekly pick.
export function seasonWinTotalNet(bet: SeasonWinTotal): number {
  return payout(bet.result, bet.stake)
}

export interface PickRecord {
  wins: number
  losses: number
  pushes: number
}

// The "record against the spread" (PROJECT_SPEC.md Section 4.9) counts only
// the SPREAD leg's result (pick.result), not the mirrored total leg — the
// total is money-only, it doesn't have its own "bragging rights" record.
// Per Stephen (2026-09-07): default-loss picks (missed picks) are excluded
// entirely from this record, even though they DO still cost $10 in the net
// $ totals below — the record is meant to reflect picks a user actually
// made, not games they missed.
function tallyRecord(picks: Pick[]): PickRecord {
  const record: PickRecord = { wins: 0, losses: 0, pushes: 0 }
  for (const pick of picks) {
    if (pick.isDefaultLoss) continue
    if (pick.result === 'win') record.wins += 1
    else if (pick.result === 'loss') record.losses += 1
    else if (pick.result === 'push') record.pushes += 1
    // 'pending' picks (game hasn't been settled yet) don't count either way.
  }
  return record
}

export interface StandingsRow {
  userId: string
  userName: string
  seasonNet: number
  record: PickRecord
  weeklyNet: Record<string, number> // weekId -> that week's net $ from picks only
}

// Computes the whole standings page's data in one pass, from the raw
// Firestore collections, per PROJECT_SPEC.md Section 4.9's instruction to
// derive standings on the fly rather than storing a separately-maintained
// running total (which could drift out of sync with the underlying picks).
//
// Season Win Totals (Section 4.4) are deliberately folded into `seasonNet`
// but NOT attributed to any single week's `weeklyNet` entry — they're a
// once-a-season preseason bet, settled at season's end, with no natural
// "which week does this belong to" answer. Per Stephen (2026-09-07): include
// them in today's math even though there's no settlement UI for them yet
// (that's task #10) — every bet currently sits at `result: 'pending'`, which
// `payout` already treats as $0, so this is a no-op until #10 adds a way to
// mark them won/lost/pushed, at which point they'll start counting
// automatically with no further code changes needed here. Super Bowl Props
// (Section 4.5) are left out entirely, not just uncounted: nothing writes
// to that collection yet either (task #10 hasn't built the user-facing
// picking UI), so there's no data to sum — this will need a third net-$
// source added here once that collection exists.
export function computeStandings(
  users: User[],
  weeks: Week[],
  allPicks: Pick[],
  seasonWinTotals: SeasonWinTotal[],
): StandingsRow[] {
  return users.map((user) => {
    const myPicks = allPicks.filter((p) => p.userId === user.id)
    const myWinTotals = seasonWinTotals.filter((b) => b.userId === user.id)

    // Computed from `myPicks` directly (not by summing the per-week loop
    // below) so a pick referencing a weekId that's somehow missing from the
    // `weeks` collection still counts toward the season total instead of
    // silently vanishing — the weeks loop below is ONLY for attributing
    // money to a specific week's column, which is a display concern
    // separate from "how much money did this person actually win or lose."
    const pickSeasonNet = myPicks.reduce((sum, pick) => sum + pickNet(pick), 0)

    const weeklyNet: Record<string, number> = {}
    for (const week of weeks) {
      const weekPicks = myPicks.filter((p) => p.weekId === week.id)
      weeklyNet[week.id] = weekPicks.reduce((sum, pick) => sum + pickNet(pick), 0)
    }

    const winTotalsNet = myWinTotals.reduce((sum, bet) => sum + seasonWinTotalNet(bet), 0)

    return {
      userId: user.id,
      userName: user.name,
      seasonNet: pickSeasonNet + winTotalsNet,
      record: tallyRecord(myPicks),
      weeklyNet,
    }
  })
}
