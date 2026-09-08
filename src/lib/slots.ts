import type { Game, Pick, PickType } from '../types'

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

// PROJECT_SPEC.md Section 4.2: playoff weeks have "no fixed slot structure
// ... users pick every single game on that week's playoff slate." Unlike
// the regular season (which sorts games into named roles — AM/PM/SNF/etc.),
// every game in a playoff week gets its own required pick, one slot per
// game, all sharing the pickType "Playoff" (the same repeatable pattern
// already used for Bonus games — see REPEATABLE_PICK_TYPES in
// src/lib/picks.ts and the matching branch in findExistingPick below).
//
// Deliberately uses EVERY game passed in, regardless of that game's own
// `slot` field — per Stephen (2026-09-07), a playoff week's games ARE the
// playoff slate by definition (the week itself, not each game's slot
// label, is what makes it a playoff week), and requiring an exact
// `slot: 'Playoff'` tag on every game would risk a mis-tagged game (e.g.
// left on the AM/PM/etc. default while being added) silently not requiring
// a pick from anyone.
export function computeSlotsForPlayoffWeek(games: Game[]): Slot[] {
  return games.map((game) => ({
    kind: 'fixedGame',
    pickType: 'Playoff',
    label: `${game.awayTeam} @ ${game.homeTeam}`,
    game,
  }))
}

// Finds one user's already-saved pick for a given slot (a real pick OR a
// backfilled default-loss one — see src/lib/missedPicks.ts). Most slot
// types are "singletons" — a user gets exactly one pick for it per week,
// matched by pickType alone (see the matching comment in src/lib/picks.ts
// on why the deterministic doc ID scheme guarantees this). Two slot types
// also need a gameId match:
//  - Bonus is repeatable: multiple bonus games all share pickType "Bonus",
//    so pickType alone can't tell them apart.
//  - HighSpread's underlying game can change out from under it: it's
//    recomputed fresh every render (PROJECT_SPEC.md Section 4.1 item 6),
//    so if an admin corrects a line and a different game becomes the
//    week's highest spread, a pick (real or backfilled) against the OLD
//    high-spread game must NOT be treated as "already answered" for the
//    NEW one — otherwise a user could get permanently stuck showing a
//    stale default-loss pick for a slot whose real deadline hasn't
//    arrived yet. Requiring gameId to match means the old pick just
//    becomes invisible to the new slot (harmless leftover data) rather
//    than blocking it.
// Playoff joins Bonus/HighSpread in this list for the same repeatable-slot
// reason as Bonus: pickType "Playoff" is shared across every game in the
// week (see computeSlotsForPlayoffWeek above), so pickType alone can't
// tell two different playoff games' picks apart.
export function findExistingPick(myPicks: Pick[], slot: Slot): Pick | undefined {
  if (
    slot.kind === 'fixedGame' &&
    (slot.pickType === 'Bonus' || slot.pickType === 'HighSpread' || slot.pickType === 'Playoff')
  ) {
    return myPicks.find((p) => p.pickType === slot.pickType && p.gameId === slot.game.id)
  }
  return myPicks.find((p) => p.pickType === slot.pickType)
}
