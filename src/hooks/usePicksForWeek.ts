import { useEffect, useState } from 'react'
import { listenPicksForWeek } from '../lib/picks'
import type { Pick } from '../types'

// `loading` exists to distinguish two very different situations that both
// start out looking like "picks is an empty array":
//   1. The Firestore listener genuinely hasn't delivered a snapshot FOR
//      THE CURRENTLY REQUESTED weekId yet.
//   2. The listener HAS reported back for this exact weekId, and there
//      really are zero picks saved so far this week.
// This distinction matters a lot to callers like WeekPicks.tsx's missed-
// pick backfill: `games`, `users`, and `picks` each load from their own
// independent Firestore subscription, and nothing guarantees the order
// they resolve in. If backfill ran the instant `games`/`users` were ready
// without checking this flag, an unlucky ordering (games+users arriving
// before picks) would make every user's every pick look "missing" for one
// render — and since backfill immediately writes a coin-flip pick to the
// SAME deterministic document ID a real pick already occupies, that one
// render is enough to silently overwrite real picks with random ones. This
// is exactly what happened in production once already.
//
// Note this also has to cover changing weeks, not just the initial mount:
// when `weekId` changes from week A to week B, this hook's state is still
// holding week A's picks for one render (this effect hasn't re-subscribed
// yet). Keying the stored state on the weekId it belongs to — rather than
// just tracking a bare "have I ever loaded anything" boolean — means that
// render also reports `loading: true` instead of quietly handing a caller
// week A's picks labeled as week B's, which would have the same
// overwrite-a-real-pick failure mode on a week switch.
export function usePicksForWeek(weekId: string | null): { picks: Pick[]; loading: boolean } {
  const [state, setState] = useState<{ weekId: string | null; picks: Pick[] }>({
    weekId: null,
    picks: [],
  })

  useEffect(() => {
    if (!weekId) {
      setState({ weekId: null, picks: [] })
      return
    }
    const unsubscribe = listenPicksForWeek(weekId, (picks) => {
      setState({ weekId, picks })
    })
    return unsubscribe
  }, [weekId])

  const loading = state.weekId !== weekId
  return { picks: loading ? [] : state.picks, loading }
}
