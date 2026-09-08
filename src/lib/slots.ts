import type { Game, Pick, PickType } from '../types'

// Describes one row the user needs to fill out on the Picks screen.
//
// - "poolChoice" (WildCard only, as of 2026-09-08) offers a handful of
//   candidate games and the user picks ONE of them — the one slot where
//   different users can end up betting on different physical games.
// - "fixedGame" slots are already pinned to one specific game, the SAME
//   one for every user: AM/PM/SNF/MNF are each a single game the admin
//   explicitly designates (no more per-user choice of which 1pm/4pm game
//   to bet, per Stephen 2026-09-08), the admin's bonus game IS the pick
//   (Bonus), and HighSpread is whichever WildCard-eligible game the admin
//   has manually flagged via Week.highSpreadGameId (also changed
//   2026-09-08 — previously auto-computed by scanning for the largest
//   spread; now the admin picks it, informed by the auto-fetched spread
//   data but with final say, since an auto-picked line could be stale or
//   wrong).
export type Slot =
  | { kind: 'poolChoice'; pickType: PickType; label: string; candidates: Game[] }
  | { kind: 'fixedGame'; pickType: PickType; label: string; game: Game }

// Sorts WildCard-eligible games by spread magnitude, largest first —
// purely a display convenience for the admin's HighSpread picker UI (see
// HighSpreadPicker.tsx) so the current numeric leader is easy to spot.
// Games with no spread yet sort last. This does NOT decide the pick
// anymore — that's now a manual admin choice (Week.highSpreadGameId).
export function sortBySpreadDesc(candidates: Game[]): Game[] {
  return [...candidates].sort((a, b) => (b.spread?.line ?? -1) - (a.spread?.line ?? -1))
}

export function computeSlotsForRegularWeek(games: Game[], highSpreadGameId: string | null | undefined): Slot[] {
  const slots: Slot[] = []

  const amGame = games.find((g) => g.slot === 'AM')
  if (amGame) {
    slots.push({ kind: 'fixedGame', pickType: 'AM', label: '1pm Game', game: amGame })
  }

  const pmGame = games.find((g) => g.slot === 'PM')
  if (pmGame) {
    slots.push({ kind: 'fixedGame', pickType: 'PM', label: '4pm Game', game: pmGame })
  }

  const snfGame = games.find((g) => g.slot === 'SNF')
  if (snfGame) {
    slots.push({ kind: 'fixedGame', pickType: 'SNF', label: 'Sunday Night Football', game: snfGame })
  }

  const mnfGame = games.find((g) => g.slot === 'MNF')
  if (mnfGame) {
    slots.push({ kind: 'fixedGame', pickType: 'MNF', label: 'Monday Night Football', game: mnfGame })
  }

  // Per Stephen (2026-09-08): HighSpread is carved OUT of the WildCard
  // pool — whichever WildCardPool game the admin has flagged via
  // Week.highSpreadGameId becomes the HighSpread pick, and everything
  // else left in the pool is the actual WildCard candidate list. This
  // guarantees the two picks can never land on the same physical game.
  // Bonus games are deliberately NOT part of this split: they're already
  // their own separate required pick per game (below).
  const wildCardPoolGames = games.filter((g) => g.slot === 'WildCardPool')
  const highSpreadGame = wildCardPoolGames.find((g) => g.id === highSpreadGameId) ?? null
  const wildCardGames = wildCardPoolGames.filter((g) => g.id !== highSpreadGame?.id)

  if (wildCardGames.length > 0) {
    slots.push({
      kind: 'poolChoice',
      pickType: 'WildCard',
      label: 'Wild Card (pick any leftover game)',
      candidates: wildCardGames,
    })
  }

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
//  - HighSpread's underlying game can change out from under it: the admin
//    can re-point Week.highSpreadGameId at a different WildCardPool game
//    at any time (PROJECT_SPEC.md Section 4.1 item 6), so a pick (real or
//    backfilled) against the OLD high-spread game must NOT be treated as
//    "already answered" for the NEW one — otherwise a user could get
//    permanently stuck showing a stale default-loss pick for a slot whose
//    real deadline hasn't arrived yet. Requiring gameId to match means the
//    old pick just becomes invisible to the new slot (harmless leftover
//    data) rather than blocking it. HighSpreadPicker.tsx locks the admin's
//    selector once any real pick exists against the CURRENT selection, to
//    keep this "invisible leftover" case rare rather than routine.
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
