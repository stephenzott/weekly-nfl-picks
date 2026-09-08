import { useEffect, useState } from 'react'
import { listenAllPicks } from '../lib/picks'
import type { Pick } from '../types'

// Unlike usePicksForWeek (scoped to one week), this subscribes to every
// pick ever saved, across all weeks — needed for the standings page, which
// has to sum profit/loss over the whole season.
//
// Returns `[picks, loaded]` rather than a bare array: an empty array is
// ambiguous between "still connecting to Firestore" and "there really are
// zero picks," and the standings page needs to tell those apart — showing
// everyone at a confident "$0" during the brief window before this
// subscription's first snapshot arrives would look like real (wrong) data
// rather than a loading state.
export function useAllPicks(): [Pick[], boolean] {
  const [picks, setPicks] = useState<Pick[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsubscribe = listenAllPicks((picks) => {
      setPicks(picks)
      setLoaded(true)
    })
    return unsubscribe
  }, [])

  return [picks, loaded]
}
