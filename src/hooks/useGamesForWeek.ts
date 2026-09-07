import { useEffect, useState } from 'react'
import { listenGamesForWeek } from '../lib/games'
import type { Game } from '../types'

export function useGamesForWeek(weekId: string | null): Game[] {
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    // If no week is selected yet, there's nothing to subscribe to — reset
    // to empty and skip setting up a listener.
    if (!weekId) {
      setGames([])
      return
    }
    const unsubscribe = listenGamesForWeek(weekId, setGames)
    return unsubscribe
    // Re-run this effect (unsubscribe old listener, subscribe to the new
    // week) whenever the selected weekId changes.
  }, [weekId])

  return games
}
