import type { Game, PickType } from '../types'

// Describes one row the user needs to fill out on the Picks screen.
//
// - "poolChoice" slots (AM, PM, WildCard) offer a handful of candidate
//   games and the user picks ONE of them, per PROJECT_SPEC.md Section 4.1
//   items 1, 2, and 5.
// - "fixedGame" slots are already pinned to one specific game — either
//   because there's naturally only one such game that week (SNF, MNF), the
//   admin's bonus game IS the pick (Bonus), or the game was determined by
//   scanning the whole slate rather than by user choice (HighSpread, per
//   item 6 — "calculated on the fly", not chosen by the user).
export type Slot =
  | { kind: 'poolChoice'; pickType: PickType; label: string; candidates: Game[] }
  | { kind: 'fixedGame'; pickType: PickType; label: string; game: Game }

// Scans every game in the week (regardless of slot) for the one with the
// largest spread by absolute value. This is deliberately NOT stored
// anywhere — PROJECT_SPEC.md Section 4.1 item 6 explicitly calls for
// computing it fresh every time, since a stored flag would go stale if a
// line gets corrected after entry.
function findHighSpreadGame(games: Game[]): Game | null {
  let best: Game | null = null
  for (const game of games) {
    if (!game.spread) continue
    if (!best || !best.spread || game.spread.line > best.spread.line) {
      best = game
    }
  }
  return best
}

export function computeSlotsForRegularWeek(games: Game[]): Slot[] {
  const slots: Slot[] = []

  const amGames = games.filter((g) => g.slot === 'AM')
  if (amGames.length > 0) {
    slots.push({ kind: 'poolChoice', pickType: 'AM', label: '1pm Game', candidates: amGames })
  }

  const pmGames = games.filter((g) => g.slot === 'PM')
  if (pmGames.length > 0) {
    slots.push({ kind: 'poolChoice', pickType: 'PM', label: '4pm Game', candidates: pmGames })
  }

  const snfGame = games.find((g) => g.slot === 'SNF')
  if (snfGame) {
    slots.push({ kind: 'fixedGame', pickType: 'SNF', label: 'Sunday Night Football', game: snfGame })
  }

  const mnfGame = games.find((g) => g.slot === 'MNF')
  if (mnfGame) {
    slots.push({ kind: 'fixedGame', pickType: 'MNF', label: 'Monday Night Football', game: mnfGame })
  }

  const wildCardGames = games.filter((g) => g.slot === 'WildCardPool')
  if (wildCardGames.length > 0) {
    slots.push({
      kind: 'poolChoice',
      pickType: 'WildCard',
      label: 'Wild Card (pick any leftover game)',
      candidates: wildCardGames,
    })
  }

  const highSpreadGame = findHighSpreadGame(games)
  if (highSpreadGame) {
    slots.push({
      kind: 'fixedGame',
      pickType: 'HighSpread',
      label: 'Highest Spread of the Week',
      game: highSpreadGame,
    })
  }

  // Per Stephen (2026-09-07): every bonus game an admin adds is its own
  // required pick, same as SNF/MNF — not an optional pool like WildCard.
  const bonusGames = games.filter((g) => g.slot === 'Bonus')
  for (const game of bonusGames) {
    slots.push({
      kind: 'fixedGame',
      pickType: 'Bonus',
      label: `Bonus: ${game.awayTeam} @ ${game.homeTeam}`,
      game,
    })
  }

  return slots
}
