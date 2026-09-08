import { useEffect } from 'react'
import { useGamesForWeek } from '../../hooks/useGamesForWeek'
import { useNow } from '../../hooks/useNow'
import { usePicksForWeek } from '../../hooks/usePicksForWeek'
import { useUsers } from '../../hooks/useUsers'
import { MIN_STAKE } from '../../lib/constants'
import { backfillMissedPicksForWeek } from '../../lib/missedPicks'
import { settleWeekPicks } from '../../lib/settleWeek'
import { computeSlotsForPlayoffWeek, computeSlotsForRegularWeek, findExistingPick } from '../../lib/slots'
import type { Week } from '../../types'
import { BudgetSummary } from './BudgetSummary'
import { PickSlot } from './PickSlot'
import { RevealedPicks } from './RevealedPicks'

interface WeekPicksProps {
  week: Week
  userId: string
}

export function WeekPicks({ week, userId }: WeekPicksProps) {
  const games = useGamesForWeek(week.id)
  const allPicks = usePicksForWeek(week.id)
  const users = useUsers()
  const myPicks = allPicks.filter((p) => p.userId === userId)
  const now = useNow()

  // PROJECT_SPEC.md Section 4.3: whenever anyone opens the app, scan for
  // missed picks and backfill $10 default losses. Per Stephen (2026-09-07):
  // this runs for ALL 5 users (not just whoever is currently selected on
  // this device) since nothing stops one person's visit from writing
  // another user's missed-pick record, and otherwise a friend who never
  // reopens the app after missing a pick would never get it recorded. It's
  // scoped to just the week currently being viewed — since the Picks
  // screen defaults to the most recently added week, simply having anyone
  // open the app during/after the current week is enough to catch it.
  // Re-running this whenever `games`/`allPicks`/`users`/`now` change is
  // safe: it's idempotent (skips any slot that already has a pick) and the
  // data volume is tiny, so there's no real cost to checking often.
  useEffect(() => {
    if (games.length === 0 || users.length === 0) return
    backfillMissedPicksForWeek(week, games, allPicks, users, now)
  }, [week, games, allPicks, users, now])

  // Settlement engine (Section 4.3/4.8): whenever anyone views this week
  // and it has a game marked 'final', compute and write in the real
  // win/loss/push for every pick referencing that game. Self-healing like
  // the backfill above — see settleWeekPicks for why re-running this on
  // every change is safe (it overwrites with the same values if nothing
  // about the game or pick has actually changed).
  useEffect(() => {
    if (games.length === 0) return
    settleWeekPicks(games, allPicks)
  }, [games, allPicks])

  if (games.length === 0) {
    return <p>No games have been added for this week yet — check the Admin tab.</p>
  }

  // PROJECT_SPEC.md Section 4.2: playoff weeks have no fixed slot
  // structure — every game IS its own required pick, unlike the regular
  // season's AM/PM/SNF/MNF/WildCard/HighSpread/Bonus roles.
  const slots =
    week.type === 'playoff' ? computeSlotsForPlayoffWeek(games) : computeSlotsForRegularWeek(games)

  // Computed once up front (rather than inline per slot below) because
  // `reserveForOtherSlots` needs to know, for each slot, how many OF THE
  // OTHER slots are still unpicked — which means every slot's existingPick
  // has to already be known before any of them can compute their own
  // reserve.
  const slotEntries = slots.map((slot) => ({ slot, existingPick: findExistingPick(myPicks, slot) }))

  // Regular season weeks always have exactly 6 fixed slots (well under
  // this), but a playoff week's slot count comes from however many games
  // an admin adds — PROJECT_SPEC.md's own biggest example is Wild Card
  // weekend's 6 games, but nothing stops an admin from adding more by
  // mistake. If there are ever more required slots than the $120 budget
  // can cover at the $10 minimum each, PickSlot's reserve logic (see
  // reserveForOtherSlots below) ends up reserving the ENTIRE budget for
  // "other slots," leaving every single pick — even at the $10 minimum —
  // rejected as over budget. That's mathematically correct (there
  // genuinely isn't enough budget for every required slot), but without
  // this banner a user just sees a confusing per-slot error message with
  // no explanation of why the whole week is stuck. Per Stephen
  // (2026-09-08): surface it plainly instead.
  const maxSupportableSlots = Math.floor(week.budget / MIN_STAKE)
  const isOverBudget = slots.length > maxSupportableSlots

  return (
    <div>
      {isOverBudget && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          This week has {slots.length} required picks, but the ${week.budget} budget only
          supports up to {maxSupportableSlots} at the ${MIN_STAKE} minimum stake each. No pick can
          be saved until an admin removes some games from this week or increases its budget.
        </p>
      )}
      <BudgetSummary budget={week.budget} myPicks={myPicks} />
      {slotEntries.map(({ slot, existingPick }, i) => {
        // Everything this user has already staked on OTHER slots this
        // week — i.e. the $120 budget minus whatever this specific slot
        // already accounts for. PickSlot uses this to figure out how much
        // headroom is left for its own stake, without double-counting the
        // stake it's about to replace.
        const otherPicksTotal = myPicks
          .filter((p) => p.id !== existingPick?.id)
          .reduce((sum, p) => sum + p.spreadStake, 0)
        // $10 reserved for every OTHER slot this user hasn't picked yet —
        // see PickSlot's reserveForOtherSlots prop doc for why this exists
        // (Stephen, 2026-09-07: the $10-minimum and $120-cap rules would
        // otherwise be able to strand a user with no legal stake left for
        // a required slot).
        const otherUnpickedSlots = slotEntries.filter(
          (entry) => entry.slot !== slot && !entry.existingPick,
        ).length
        const reserveForOtherSlots = otherUnpickedSlots * MIN_STAKE
        return (
          <PickSlot
            // PickSlot only reads `existingPick` once, when it first mounts
            // (see the comment on its useState initializers) — it doesn't
            // resync if the prop changes later. Games and picks come from
            // two independent Firestore subscriptions that can resolve in
            // either order, so on a fresh page load it's possible for this
            // component to render (and PickSlot to mount) before the picks
            // snapshot has arrived. Including the pick's id in the key
            // (falling back to "new" until it's loaded) forces React to
            // throw away and remount PickSlot the moment a matching pick
            // shows up, so it re-derives its initial state instead of
            // silently staying blank. Bonus slots repeat the same pickType
            // across different games, so pickType alone isn't a unique key
            // either way — combine it with the game/candidate identity too.
            key={`${slot.pickType}-${slot.kind === 'fixedGame' ? slot.game.id : i}-${existingPick?.id ?? 'new'}`}
            slot={slot}
            weekId={week.id}
            userId={userId}
            existingPick={existingPick}
            budget={week.budget}
            otherPicksTotal={otherPicksTotal}
            reserveForOtherSlots={reserveForOtherSlots}
            now={now}
          />
        )
      })}

      <hr />
      <RevealedPicks games={games} allPicks={allPicks} now={now} />
    </div>
  )
}
