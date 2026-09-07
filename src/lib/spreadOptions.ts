import type { Game } from '../types'

export interface SpreadOption {
  // Matches the Pick.spreadSide format from PROJECT_SPEC.md Section 5,
  // e.g. "Eagles -8.5" or "Cowboys +8.5".
  value: string
  team: string
}

// Turns a game's spread into the two choices a user can pick between:
// betting on the favorite (negative line) or the underdog (positive line).
// Returns null if the admin hasn't set a spread for this game yet — a user
// can't place a spread pick on a game with no line.
export function getSpreadOptions(game: Game): [SpreadOption, SpreadOption] | null {
  if (!game.spread) return null
  const { favoredTeam, line } = game.spread
  const underdog = favoredTeam === game.homeTeam ? game.awayTeam : game.homeTeam
  return [
    { value: `${favoredTeam} -${line}`, team: favoredTeam },
    { value: `${underdog} +${line}`, team: underdog },
  ]
}
