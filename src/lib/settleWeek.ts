import { updatePickResult } from './picks'
import { settlePick, settlePropPick } from './settlement'
import { updateSuperBowlPropResult } from './superBowlProps'
import type { Game, Pick, PropDefinition, SuperBowlProp } from '../types'

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
    // Per Stephen (2026-09-11): auto-picks (isAutoPick: true — coin-flipped
    // missed picks, src/lib/missedPicks.ts) are real bets now and settle
    // exactly like any other pick, so there's no longer a skip for them
    // here. The one remaining fallback case (no spread was ever set, so
    // missedPicks.ts couldn't flip a coin) still has spreadSide: '' and
    // result already hardcoded to 'loss' — settleSpread would just return
    // 'pending' for it below (no game.spread to match against isn't
    // actually the guard; an empty spreadSide simply never matches either
    // team), which would incorrectly overwrite that hardcoded loss, so
    // that one case is skipped explicitly instead.
    if (pick.isAutoPick && pick.spreadSide === '') continue

    const game = gamesById.get(pick.gameId)
    if (!game) continue

    const settled = settlePick(game, pick)
    if (settled.result === pick.result && settled.totalResult === pick.totalResult) continue

    await updatePickResult(pick.id, settled.result, settled.totalResult)
  }
}

// Same self-healing pattern as settleWeekPicks above, but for Super Bowl
// Props: settles every SuperBowlProp whose definition has a real outcome
// entered (`actualValue` for lined props, `correctChoice` for choice
// props — see settlePropPick). `propDefs` doesn't need to be pre-filtered
// to "final" anything the way games are — a definition either has its
// outcome entered or it doesn't, there's no separate "status" field to
// check first.
export async function settleWeekProps(
  propDefs: PropDefinition[],
  allProps: SuperBowlProp[],
): Promise<void> {
  if (propDefs.length === 0) return

  const defsById = new Map(propDefs.map((d) => [d.id, d]))

  for (const prop of allProps) {
    const def = defsById.get(prop.propDefinitionId)
    if (!def) continue

    const settled = settlePropPick(def, prop)
    if (settled === prop.result) continue

    await updateSuperBowlPropResult(prop.id, settled)
  }
}
