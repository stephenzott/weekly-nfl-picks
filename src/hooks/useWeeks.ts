import { useEffect, useState } from 'react'
import { listenWeeks } from '../lib/weeks'
import type { Week } from '../types'

// A "custom hook" is standard React practice for packaging up a piece of
// stateful logic (here: "subscribe to Firestore, store the results in
// state, clean up on unmount") so components can reuse it with one line
// instead of repeating the useState/useEffect boilerplate everywhere.
export function useWeeks(): Week[] {
  const [weeks, setWeeks] = useState<Week[]>([])

  useEffect(() => {
    // listenWeeks (src/lib/weeks.ts) returns an "unsubscribe" function.
    // Returning it from this effect tells React to call it automatically
    // when this component unmounts, so we don't leak a live Firestore
    // listener after the component is gone.
    const unsubscribe = listenWeeks(setWeeks)
    return unsubscribe
  }, [])

  return weeks
}
