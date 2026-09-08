import { MIN_STAKE } from './constants'
import { hasKickedOff } from './gameTiming'
import { savePick } from './picks'
import { computeSlotsForPlayoffWeek, computeSlotsForRegularWeek, findExistingPick, type Slot } from './slots'
import type { Game, Pick, User, Week } from '../types'

// The specific game that determines when a slot counts as "missed."
//  - fixedGame slots only ever have one possible game, so that's it.
//  - poolChoice slots can only truly be missed once EVERY candidate has
//    kicked off (see PickSlot's `availableCandidates`, which still lets a
//    user submit as long as any candidate remains open) — so the deadline
//    is whichever candidate kicks off LAST. That game is also what gets
//    recorded as the default-loss pick's gameId, since the Pick schema
//    requires one and there's no real "no game" option for a pool slot the
//    user never engaged with at all.
function slotDeadlineGame(slot: Slot): Game {
  if (slot.kind === 'fixedGame') return slot.game
  return slot.candidates.reduce((latest, g) =>
    g.kickoffTime.toMillis() > latest.kickoffTime.toMillis() ? g : latest,
  )
}

// PROJECT_SPEC.md Section 4.3: "Missed pick = automatic $10 loss ...
// clearly flagged as a default/missed pick ... acceptable for it to run
// client-side whenever any user next opens the app." Scoped to one week at
// a time (see the comment in WeekPicks.tsx on why) and across every user
// (not just whoever is browsing), since there's no auth boundary stopping
// one visit from recording a default loss on someone else's behalf, and
// otherwise a friend who never reopens the app after missing a pick would
// never get it recorded — which would silently understate their season
// losses in the standings later.
export async function backfillMissedPicksForWeek(
  week: Week,
  games: Game[],
  allPicks: Pick[],
  users: User[],
  now: Date,
): Promise<void> {
  if (games.length === 0) return

  // Playoff weeks use a different pick structure (every game is its own
  // required pick, not fixed AM/PM/SNF/etc. roles) — see
  // computeSlotsForPlayoffWeek. slotDeadlineGame and the loop below don't
  // need to care which kind of slot they're looking at either way, since
  // playoff slots are always "fixedGame" (same shape SNF/MNF/Bonus already
  // use).
  const slots =
    week.type === 'playoff'
      ? computeSlotsForPlayoffWeek(games)
      : computeSlotsForRegularWeek(games, week.highSpreadGameId)

  for (const user of users) {
    const myPicks = allPicks.filter((p) => p.userId === user.id)
    for (const slot of slots) {
      if (findExistingPick(myPicks, slot)) continue

      const deadlineGame = slotDeadlineGame(slot)
      if (!hasKickedOff(deadlineGame, now)) continue

      await savePick({
        userId: user.id,
        gameId: deadlineGame.id,
        weekId: week.id,
        pickType: slot.pickType,
        spreadSide: '',
        spreadStake: MIN_STAKE,
        totalSide: null,
        totalStake: null,
        result: 'loss',
        totalResult: null, // no total bet on a missed pick
        isDefaultLoss: true,
      })
    }
  }
}
