import type { Game, Pick, PickResult } from '../types'

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
  if (combinedScore === game.total) return 'push'

  const wentOver = combinedScore > game.total
  const pickHit = pick.totalSide === 'over' ? wentOver : !wentOver
  return pickHit ? 'win' : 'loss'
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
