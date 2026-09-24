import { useEffect, useState } from 'react'
import { listenGamesForWeek } from '../lib/games'
import type { Game } from '../types'

// Same weekId-tagged-state pattern as usePicksForWeek, and for the same
// reason: WeekPicks.tsx's missed-pick backfill reads this hook's `games`
// too, and a stale "week A's games under week B's id" render would let it
// compute slots (and write picks) against the wrong week's games.
export function useGamesForWeek(weekId: string | null): { games: Game[]; loading: boolean } {
  const [state, setState] = useState<{ weekId: string | null; games: Game[] }>({
    weekId: null,
    games: [],
  })

  useEffect(() => {
    // If no week is selected yet, there's nothing to subscribe to — reset
    // to empty and skip setting up a listener.
    if (!weekId) {
      setState({ weekId: null, games: [] })
      return
    }
    const unsubscribe = listenGamesForWeek(weekId, (games) => {
      setState({ weekId, games })
    })
    return unsubscribe
    // Re-run this effect (unsubscribe old listener, subscribe to the new
    // week) whenever the selected weekId changes.
  }, [weekId])

  const loading = state.weekId !== weekId
  return { games: loading ? [] : state.games, loading }
}
