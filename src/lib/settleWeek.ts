import { updatePickResult } from './picks'
import { settlePick } from './settlement'
import type { Game, Pick } from '../types'

// Auto-settles every pick that references a FINAL game, whenever anyone
// views a week (same trigger pattern as backfillMissedPicksForWeek).
// Deliberately re-settles and OVERWRITES every time, even picks that
// already look settled: if an admin corrects a final score after the
// fact, the next time anyone opens this week, the stale result gets
// silently replaced with the freshly-computed one — no separate "did the
// score change" tracking needed, since settlePick is a pure function of
// the game + pick and running it twice with the same inputs just writes
// the same values back.
export async function settleWeekPicks(games: Game[], allPicks: Pick[]): Promise<void> {
  const finalGames = games.filter((g) => g.status === 'final' && g.finalScore != null)
  if (finalGames.length === 0) return

  const gamesById = new Map(finalGames.map((g) => [g.id, g]))

  for (const pick of allPicks) {
    // Default-loss picks are already permanently 'loss'/null by
    // definition (PROJECT_SPEC.md Section 4.3) — there's no game outcome
    // to derive them from, and settlePick would just return 'pending'
    // for a pick with an empty spreadSide anyway.
    if (pick.isDefaultLoss) continue

    const game = gamesById.get(pick.gameId)
    if (!game) continue

    const settled = settlePick(game, pick)
    if (settled.result === pick.result && settled.totalResult === pick.totalResult) continue

    await updatePickResult(pick.id, settled.result, settled.totalResult)
  }
}
