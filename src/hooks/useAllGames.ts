import { useEffect, useState } from 'react'
import { listenAllGames } from '../lib/games'
import type { Game } from '../types'

// Unlike useGamesForWeek (scoped to one week), this subscribes to every
// game ever added, across all weeks — needed so the standings page can
// self-heal settlement for ANY week's final games, not just whichever week
// happens to be selected on the Picks tab.
//
// Returns `[games, loaded]` for the same reason as useAllPicks: an empty
// array before Firestore's first snapshot arrives shouldn't be mistaken
// for "there are genuinely no games yet."
export function useAllGames(): [Game[], boolean] {
  const [games, setGames] = useState<Game[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsubscribe = listenAllGames((games) => {
      setGames(games)
      setLoaded(true)
    })
    return unsubscribe
  }, [])

  return [games, loaded]
}
