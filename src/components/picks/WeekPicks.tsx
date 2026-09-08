import { useEffect } from 'react'
import { useGamesForWeek } from '../../hooks/useGamesForWeek'
import { useNow } from '../../hooks/useNow'
import { usePicksForWeek } from '../../hooks/usePicksForWeek'
import { usePropDefinitionsForWeek } from '../../hooks/usePropDefinitionsForWeek'
import { useSuperBowlProps } from '../../hooks/useSuperBowlProps'
import { useUsers } from '../../hooks/useUsers'
import { MIN_STAKE } from '../../lib/constants'
import { hasKickedOff } from '../../lib/gameTiming'
import { backfillMissedPicksForWeek } from '../../lib/missedPicks'
import { settleWeekPicks, settleWeekProps } from '../../lib/settleWeek'
import { computeSlotsForPlayoffWeek, computeSlotsForRegularWeek, findExistingPick, type Slot } from '../../lib/slots'
import type { Pick, PropDefinition, SuperBowlProp, Week } from '../../types'
import { BudgetSummary } from './BudgetSummary'
import { PickSlot } from './PickSlot'
import { PropPick } from './PropPick'
import { RevealedPicks } from './RevealedPicks'
import { RevealedProps } from './RevealedProps'

interface WeekPicksProps {
  week: Week
  userId: string
}

// One shared shape for "a required thing this user can stake money on this
// week" — a game-pick slot or a prop — so the $120 budget/reserve math
// (see the block below the settlement effects) can be computed ONCE across
// both, instead of two independent calculations that could each think they
// own the whole budget. PROJECT_SPEC.md Section 4.5 is explicit that props
// draw from the SAME pool as that week's game pick(s), not a separate one.
type BudgetEntry =
  | { kind: 'pick'; key: string; slot: Slot; existingPick: Pick | undefined }
  | { kind: 'prop'; key: string; def: PropDefinition; existingProp: SuperBowlProp | undefined }

function committedStake(entry: BudgetEntry): number {
  return entry.kind === 'pick' ? (entry.existingPick?.spreadStake ?? 0) : (entry.existingProp?.stake ?? 0)
}

function isFilled(entry: BudgetEntry): boolean {
  return entry.kind === 'pick' ? Boolean(entry.existingPick) : Boolean(entry.existingProp)
}

export function WeekPicks({ week, userId }: WeekPicksProps) {
  const games = useGamesForWeek(week.id)
  const allPicks = usePicksForWeek(week.id)
  const propDefs = usePropDefinitionsForWeek(week.id)
  const [allPropsEverywhere] = useSuperBowlProps()
  const users = useUsers()
  const myPicks = allPicks.filter((p) => p.userId === userId)
  const now = useNow()

  // useSuperBowlProps subscribes to the WHOLE collection (see its own
  // comment for why) — narrow down to just this week's props before doing
  // anything else with them.
  const weekPropDefIds = new Set(propDefs.map((d) => d.id))
  const weekProps = allPropsEverywhere.filter((p) => weekPropDefIds.has(p.propDefinitionId))
  const myProps = weekProps.filter((p) => p.userId === userId)

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

  // Same self-healing pattern for Super Bowl Props (task #10).
  useEffect(() => {
    if (propDefs.length === 0) return
    settleWeekProps(propDefs, weekProps)
    // weekProps is derived fresh every render from allPropsEverywhere, so
    // depend on the underlying subscription value instead — an inline
    // array would never be reference-equal across renders and would loop.
  }, [propDefs, allPropsEverywhere])

  if (games.length === 0) {
    return <p>No games have been added for this week yet — check the Admin tab.</p>
  }

  // PROJECT_SPEC.md Section 4.2: playoff weeks have no fixed slot
  // structure — every game IS its own required pick, unlike the regular
  // season's AM/PM/SNF/MNF/WildCard/HighSpread/Bonus roles.
  const slots =
    week.type === 'playoff' ? computeSlotsForPlayoffWeek(games) : computeSlotsForRegularWeek(games)

  // Props don't have their own kickoff time — PROJECT_SPEC.md Section 4.5
  // ties them to "that week's spread pick," and in real usage a props week
  // (Super Bowl) only ever has the one game. Locking/revealing on the
  // EARLIEST kickoff among this week's games covers that case exactly, and
  // degrades reasonably even in the unlikely event a props-bearing week
  // ever had more than one game.
  const earliestGame = games.reduce((earliest, g) =>
    g.kickoffTime.toMillis() < earliest.kickoffTime.toMillis() ? g : earliest,
  )
  const propsLocked = hasKickedOff(earliestGame, now)

  const slotEntries: BudgetEntry[] = slots.map((slot, i) => ({
    kind: 'pick',
    key: `pick-${slot.pickType}-${slot.kind === 'fixedGame' ? slot.game.id : i}`,
    slot,
    existingPick: findExistingPick(myPicks, slot),
  }))
  const propEntries: BudgetEntry[] = propDefs.map((def) => ({
    kind: 'prop',
    key: `prop-${def.id}`,
    def,
    existingProp: myProps.find((p) => p.propDefinitionId === def.id),
  }))
  // Combined once up front (rather than computed separately per section)
  // because each entry's reserve needs to know how many of the OTHER
  // entries — picks AND props together — are still unfilled.
  const entries: BudgetEntry[] = [...slotEntries, ...propEntries]
  const totalCommitted = entries.reduce((sum, e) => sum + committedStake(e), 0)

  // Regular season weeks always have exactly 6 fixed slots (well under
  // this), but a playoff week's slot count comes from however many games
  // an admin adds, and props add further required entries on top —
  // PROJECT_SPEC.md's own biggest example is Wild Card weekend's 6 games,
  // but nothing stops an admin from adding more by mistake, or a props
  // week from ending up with more props than the leftover budget after
  // the game pick(s) supports. If there are ever more required entries
  // than the $120 budget can cover at the $10 minimum each, the reserve
  // logic below ends up reserving the ENTIRE budget for "other entries,"
  // leaving every single pick/prop — even at the $10 minimum — rejected as
  // over budget. That's mathematically correct, but without this banner a
  // user just sees a confusing per-entry error message with no
  // explanation of why the whole week is stuck. Per Stephen (2026-09-08):
  // surface it plainly instead.
  const maxSupportableEntries = Math.floor(week.budget / MIN_STAKE)
  const isOverBudget = entries.length > maxSupportableEntries

  return (
    <div>
      {isOverBudget && (
        <p style={{ color: 'red', fontWeight: 'bold' }}>
          This week has {entries.length} required picks/props, but the ${week.budget} budget only
          supports up to {maxSupportableEntries} at the ${MIN_STAKE} minimum stake each. No pick
          can be saved until an admin removes some games/props from this week or increases its
          budget.
        </p>
      )}
      <BudgetSummary budget={week.budget} myPicks={myPicks} myProps={myProps} />
      {slotEntries.map((entry) => {
        if (entry.kind !== 'pick') return null // narrows the union for TypeScript below
        const { slot, existingPick } = entry
        const otherCommittedTotal = totalCommitted - committedStake(entry)
        const otherUnfilled = entries.filter((e) => e !== entry && !isFilled(e)).length
        const reserveForOtherEntries = otherUnfilled * MIN_STAKE
        // Per Stephen (2026-09-08): the $120 weekly budget should be forced
        // to land on exactly $120 across the required PICKS, same "last
        // one auto-absorbs the remainder" trick as Season Win Totals'
        // forced 4th bet (see SeasonWinTotalsSection.tsx).
        //
        // Props (rare — Super Bowl week only) are deliberately left OUT of
        // this for now: forcing "whichever pick or prop is truly last"
        // would guarantee $120 in every week, but forcing picks-only
        // without checking props creates a real bug — if a prop is still
        // unfilled when the last pick is reached, reserveForOtherEntries
        // (below) is holding back $10 per unfilled prop, which SQUEEZES
        // the forced pick down and leaves each prop pinned at exactly its
        // $10 minimum with no real choice — the opposite of "props stay
        // free." Per Stephen (2026-09-08), that's a decision to make when
        // props weeks are actually being built out for playoffs, not now
        // — so this is intentionally the SAFE subset: forcing only
        // engages once every prop this week is already filled (trivially
        // true every week with zero props, i.e. every week so far). Until
        // then, the last pick behaves like an ordinary free-entry pick.
        const otherUnfilledPicks = slotEntries.filter(
          (e) => e !== entry && e.kind === 'pick' && !isFilled(e),
        ).length
        const allPropsFilled = propEntries.every(isFilled)
        const isLastPick = !isFilled(entry) && otherUnfilledPicks === 0 && allPropsFilled
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
            // silently staying blank.
            key={`${entry.key}-${existingPick?.id ?? 'new'}`}
            slot={slot}
            weekId={week.id}
            userId={userId}
            existingPick={existingPick}
            budget={week.budget}
            otherPicksTotal={otherCommittedTotal}
            reserveForOtherSlots={reserveForOtherEntries}
            isLastPick={isLastPick}
            now={now}
          />
        )
      })}

      {propEntries.map((entry) => {
        if (entry.kind !== 'prop') return null
        const { def, existingProp } = entry
        const otherCommittedTotal = totalCommitted - committedStake(entry)
        const otherUnfilled = entries.filter((e) => e !== entry && !isFilled(e)).length
        const reserveForOtherEntries = otherUnfilled * MIN_STAKE
        return (
          <PropPick
            key={`${entry.key}-${existingProp?.id ?? 'new'}`}
            def={def}
            userId={userId}
            existingProp={existingProp}
            budget={week.budget}
            otherCommittedTotal={otherCommittedTotal}
            reserveForOtherEntries={reserveForOtherEntries}
            locked={propsLocked}
          />
        )
      })}

      <hr />
      <RevealedPicks games={games} allPicks={allPicks} now={now} />
      <RevealedProps propDefs={propDefs} allProps={weekProps} locked={propsLocked} />
    </div>
  )
}
