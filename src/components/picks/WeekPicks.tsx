import { useGamesForWeek } from '../../hooks/useGamesForWeek'
import { useNow } from '../../hooks/useNow'
import { usePicksForWeek } from '../../hooks/usePicksForWeek'
import { computeSlotsForRegularWeek, type Slot } from '../../lib/slots'
import type { Pick, Week } from '../../types'
import { BudgetSummary } from './BudgetSummary'
import { PickSlot } from './PickSlot'
import { RevealedPicks } from './RevealedPicks'

interface WeekPicksProps {
  week: Week
  userId: string
}

// Finds this user's already-saved pick for a given slot, so PickSlot can
// pre-fill the form. Every slot type except Bonus is a "singleton" — a user
// gets exactly one pick for it per week, matched by pickType alone (see the
// matching comment in src/lib/picks.ts). Bonus is the one repeatable slot
// (multiple bonus games all share pickType "Bonus"), so it also has to
// match the specific gameId.
function findExistingPick(myPicks: Pick[], slot: Slot): Pick | undefined {
  if (slot.kind === 'fixedGame' && slot.pickType === 'Bonus') {
    return myPicks.find((p) => p.pickType === 'Bonus' && p.gameId === slot.game.id)
  }
  return myPicks.find((p) => p.pickType === slot.pickType)
}

export function WeekPicks({ week, userId }: WeekPicksProps) {
  const games = useGamesForWeek(week.id)
  const allPicks = usePicksForWeek(week.id)
  const myPicks = allPicks.filter((p) => p.userId === userId)
  const now = useNow()

  if (week.type === 'playoff') {
    return <p>Playoff-week picks aren't built yet.</p>
  }

  const slots = computeSlotsForRegularWeek(games)

  if (games.length === 0) {
    return <p>No games have been added for this week yet — check the Admin tab.</p>
  }

  return (
    <div>
      <BudgetSummary budget={week.budget} myPicks={myPicks} />
      {slots.map((slot, i) => {
        const existingPick = findExistingPick(myPicks, slot)
        // Everything this user has already staked on OTHER slots this
        // week — i.e. the $120 budget minus whatever this specific slot
        // already accounts for. PickSlot uses this to figure out how much
        // headroom is left for its own stake, without double-counting the
        // stake it's about to replace.
        const otherPicksTotal = myPicks
          .filter((p) => p.id !== existingPick?.id)
          .reduce((sum, p) => sum + p.spreadStake, 0)
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
            now={now}
          />
        )
      })}

      <hr />
      <RevealedPicks games={games} allPicks={allPicks} now={now} />
    </div>
  )
}
