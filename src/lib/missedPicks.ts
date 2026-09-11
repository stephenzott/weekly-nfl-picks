import { MIN_STAKE } from './constants'
import { hasKickedOff } from './gameTiming'
import { savePick } from './picks'
import { getSpreadOptions } from './spreadOptions'
import { computeSlotsForPlayoffWeek, computeSlotsForRegularWeek, findExistingPick, type Slot } from './slots'
import type { Game, Pick, User, Week } from '../types'

// The specific game that determines when a slot counts as "missed."
//  - fixedGame slots only ever have one possible game, so that's it.
//  - poolChoice slots can only truly be missed once EVERY candidate has
//    kicked off (see PickSlot's `availableCandidates`, which still lets a
//    user submit as long as any candidate remains open) — so the deadline
//    is whichever candidate kicks off LAST.
function slotDeadlineGame(slot: Slot): Game {
  if (slot.kind === 'fixedGame') return slot.game
  return slot.candidates.reduce((latest, g) =>
    g.kickoffTime.toMillis() > latest.kickoffTime.toMillis() ? g : latest,
  )
}

// Per Stephen (2026-09-11): a coin flip picks BOTH which game (for a
// poolChoice/WildCard slot — a fixedGame slot only ever has the one) and
// which side of that game's spread, so a missed pick becomes a real bet
// instead of an automatic loss. Returns null if the resolved game has no
// spread set at all (getSpreadOptions returns null) — there's nothing to
// flip a coin about in that rare case, and the caller falls back to the
// old "no pick" behavior for it.
function coinFlipPick(slot: Slot): { gameId: string; spreadSide: string } | null {
  const game =
    slot.kind === 'fixedGame'
      ? slot.game
      : slot.candidates[Math.floor(Math.random() * slot.candidates.length)]
  const options = getSpreadOptions(game)
  if (!options) return null
  const chosen = options[Math.floor(Math.random() * options.length)]
  return { gameId: game.id, spreadSide: chosen.value }
}

// PROJECT_SPEC.md Section 4.3, changed by Stephen (2026-09-11): a missed
// pick used to be a flat $10 automatic loss. Now it's a coin-flipped real
// pick — a random side, for real money, that settles normally
// (win/loss/push) exactly like a pick the user made themselves — with one
// extra rule: if every OTHER required slot this week is already decided
// (a real pick, or one this same pass already auto-picked) by the time
// this one gets backfilled, its stake is whatever's left of the week's
// budget instead of the usual $10 minimum, so a user who misses their
// entire week still lands on exactly $120 total, same "final entry closes
// the gap" rule PickSlot.tsx uses for a user's own last real pick.
//
// Still "acceptable for it to run client-side whenever any user next
// opens the app" per the spec, scoped to one week at a time (see the
// comment in WeekPicks.tsx on why) and across every user (not just
// whoever is browsing) — there's no auth boundary stopping one visit from
// recording this on someone else's behalf, and otherwise a friend who
// never reopens the app after missing a pick would never get it recorded.
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
  // computeSlotsForPlayoffWeek. Everything below treats all slots the
  // same regardless of which kind of week this is.
  const slots =
    week.type === 'playoff'
      ? computeSlotsForPlayoffWeek(games)
      : computeSlotsForRegularWeek(games, week.highSpreadGameId)

  // Process slots in kickoff-deadline order (earliest first) so that, by
  // the time this loop reaches whichever slot is genuinely the LAST to
  // kick off this week, every other slot has already been decided one way
  // or another — which is exactly what "is this the last remaining slot"
  // below needs to be true at the right moment.
  const slotsByDeadline = [...slots].sort(
    (a, b) => slotDeadlineGame(a).kickoffTime.toMillis() - slotDeadlineGame(b).kickoffTime.toMillis(),
  )

  for (const user of users) {
    // Mutable running list, seeded from what's already in Firestore and
    // appended to as this loop auto-picks more slots for this same user —
    // so the "is every other slot filled" check below sees picks created
    // earlier in THIS pass too, not just what was already saved before
    // this function started running.
    const myPicks = allPicks.filter((p) => p.userId === user.id)

    for (const slot of slotsByDeadline) {
      if (findExistingPick(myPicks, slot)) continue

      const deadlineGame = slotDeadlineGame(slot)
      if (!hasKickedOff(deadlineGame, now)) continue

      const flip = coinFlipPick(slot)

      let newPick: Omit<Pick, 'id'>
      if (flip) {
        const otherSlots = slots.filter((s) => s !== slot)
        const isLastSlot = otherSlots.every((s) => findExistingPick(myPicks, s))
        const otherCommitted = otherSlots.reduce(
          (sum, s) => sum + (findExistingPick(myPicks, s)?.spreadStake ?? 0),
          0,
        )
        const stake = isLastSlot ? week.budget - otherCommitted : MIN_STAKE

        newPick = {
          userId: user.id,
          gameId: flip.gameId,
          weekId: week.id,
          pickType: slot.pickType,
          spreadSide: flip.spreadSide,
          spreadStake: stake,
          totalSide: null,
          totalStake: null,
          // 'pending' rather than computing a result here — settleWeekPicks
          // (src/lib/settleWeek.ts) settles every real pick against a
          // final game the normal self-healing way, and this auto-pick is
          // now a real pick like any other.
          result: 'pending',
          totalResult: null,
          isAutoPick: true,
        }
      } else {
        // Fallback for the rare case this game never got a spread set at
        // all — there's no coin to flip, so this still records as the old
        // "no pick" $10 loss rather than trying to force a budget-closing
        // stake onto a bet with no real side attached.
        newPick = {
          userId: user.id,
          gameId: deadlineGame.id,
          weekId: week.id,
          pickType: slot.pickType,
          spreadSide: '',
          spreadStake: MIN_STAKE,
          totalSide: null,
          totalStake: null,
          result: 'loss',
          totalResult: null,
          isAutoPick: true,
        }
      }

      await savePick(newPick)
      // Reflect this new pick locally so later slots in this same pass
      // (the isLastSlot/otherCommitted math above) see it.
      myPicks.push({ id: '', ...newPick })
    }
  }
}
