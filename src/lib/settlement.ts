import type { Game, Pick, PickResult, PropDefinition, SeasonWinTotal, SuperBowlProp } from '../types'

// Shared over/under settlement math: push on an exact tie, otherwise win if
// the side picked matches which way the actual value landed. Used by
// settleTotal (game totals) below, and by settleSeasonWinTotal /
// settlePropPick further down — all three are "does this number clear that
// line" checks with identical push/win/loss rules, just applied to
// different kinds of number (combined score, team win count, a stat line).
function settleOverUnder(actualValue: number, line: number, wantsOver: boolean): PickResult {
  if (actualValue === line) return 'push'
  const wentOver = actualValue > line
  return wantsOver === wentOver ? 'win' : 'loss'
}

// PROJECT_SPEC.md Section 4.3: even-money payouts, push on an exact tie.
// This settles the SPREAD half of a pick — see settleTotal below for the
// independent total half.
//
// Identifies which TEAM was picked by checking whether `pick.spreadSide`
// (a string like "Eagles -8.5") starts with the game's current
// `favoredTeam` name — rather than regenerating the full label (team +
// number) via getSpreadOptions and comparing the whole string. The earlier
// version did the latter, which broke the moment an admin corrected the
// line after a pick was saved (EditGameForm supports this, and §4.7's
// "Fetch Odds" refresh is a second path to the same thing): the saved
// spreadSide still says the OLD number, so it stops matching either
// freshly-regenerated label and the pick gets silently and permanently
// stuck at 'pending'. Matching on team name only survives a line change,
// since the settlement math below always uses the game's CURRENT line —
// exactly what you want when a line correction is the reason you're
// re-settling in the first place.
export function settleSpread(game: Game, pick: Pick): PickResult {
  if (!game.finalScore || !game.spread) return 'pending'
  const { favoredTeam, line } = game.spread

  // Guard against favoredTeam matching neither current team name (e.g. a
  // team got renamed after this pick was saved, or the two are just out of
  // sync some other way). Without this, the home/away lookups below would
  // silently treat the away team as favored by default instead of
  // refusing to guess.
  if (favoredTeam !== game.homeTeam && favoredTeam !== game.awayTeam) return 'pending'

  const pickedFavorite = pick.spreadSide.startsWith(favoredTeam)

  const favoredScore = favoredTeam === game.homeTeam ? game.finalScore.home : game.finalScore.away
  const underdogScore = favoredTeam === game.homeTeam ? game.finalScore.away : game.finalScore.home
  const favoredMargin = favoredScore - underdogScore

  if (favoredMargin === line) return 'push'

  const favoriteCovered = favoredMargin > line
  const pickCovered = pickedFavorite ? favoriteCovered : !favoriteCovered
  return pickCovered ? 'win' : 'loss'
}

// Settles the mirrored TOTAL half of a pick, independently of the spread
// half. Returns null when there's nothing to settle (no total bet was
// placed on this pick, matching Pick.totalResult's null-when-no-bet
// convention).
export function settleTotal(game: Game, pick: Pick): PickResult | null {
  if (pick.totalSide == null) return null
  if (!game.finalScore || game.total == null) return 'pending'

  const combinedScore = game.finalScore.home + game.finalScore.away
  return settleOverUnder(combinedScore, game.total, pick.totalSide === 'over')
}

// Season Win Totals (PROJECT_SPEC.md Section 4.4): settles once an admin
// enters the team's real final win count (`actualWins`) — see
// updateSeasonWinTotalActualWins in src/lib/seasonWinTotals.ts, which calls
// this and writes both fields together.
export function settleSeasonWinTotal(bet: SeasonWinTotal): PickResult {
  if (bet.actualWins == null) return 'pending'
  return settleOverUnder(bet.actualWins, bet.line, bet.side === 'over')
}

// Super Bowl Props (PROJECT_SPEC.md Section 4.5). Two shapes, matching
// PropDefinition's `line` vs `choices` split:
//  - Lined props (line set): same over/under-vs-a-number math as totals
//    and season win totals, settled once `actualValue` is entered.
//  - Choice props (choices set, e.g. coin toss): no number to compare —
//    settled once `correctChoice` is entered, by simple string match. No
//    "push" concept here (a discrete answer is either right or wrong).
// Per Stephen (2026-09-08): both auto-settle from ONE admin entry on the
// shared PropDefinition, applying to every user's pick against it — same
// "settle once, not per-user" pattern as game scores — rather than
// requiring each individual SuperBowlProp to be toggled by hand.
export function settlePropPick(def: PropDefinition, prop: SuperBowlProp): PickResult {
  if (def.line != null) {
    if (def.actualValue == null) return 'pending'
    return settleOverUnder(def.actualValue, def.line, prop.pick === 'Over')
  }
  if (def.correctChoice == null) return 'pending'
  return prop.pick === def.correctChoice ? 'win' : 'loss'
}

export interface SettledResult {
  result: PickResult
  totalResult: PickResult | null
}

export function settlePick(game: Game, pick: Pick): SettledResult {
  return {
    result: settleSpread(game, pick),
    totalResult: settleTotal(game, pick),
  }
}
