import { useEffect, useState } from 'react'
import { listenAllPropDefinitions } from '../lib/propDefinitions'
import type { PropDefinition } from '../types'

// Unlike a per-week prop definitions listener, this subscribes to every
// prop definition across every week — needed so the standings page can
// self-heal prop settlement for ANY week, not just whichever week happens
// to be selected on the Picks tab (same pattern as useAllGames/useAllPicks).
//
// Returns `[defs, loaded]` for the same "don't flash a confident-looking
// wrong total before the first snapshot arrives" reason as useAllPicks.
export function useAllPropDefinitions(): [PropDefinition[], boolean] {
  const [defs, setDefs] = useState<PropDefinition[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsubscribe = listenAllPropDefinitions((defs) => {
      setDefs(defs)
      setLoaded(true)
    })
    return unsubscribe
  }, [])

  return [defs, loaded]
}
