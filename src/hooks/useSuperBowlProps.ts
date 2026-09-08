import { useEffect, useState } from 'react'
import { listenSuperBowlProps } from '../lib/superBowlProps'
import type { SuperBowlProp } from '../types'

// Whole-collection subscription (see the comment in
// src/lib/superBowlProps.ts on why) — callers filter down to the props
// relevant to whichever week/definitions they care about.
//
// Returns `[props, loaded]` (see useAllPicks for why): the standings page
// needs to tell "still connecting" apart from "genuinely zero props" so it
// doesn't render a confident-looking $0 before this subscription's first
// snapshot arrives.
export function useSuperBowlProps(): [SuperBowlProp[], boolean] {
  const [props, setProps] = useState<SuperBowlProp[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const unsubscribe = listenSuperBowlProps((props) => {
      setProps(props)
      setLoaded(true)
    })
    return unsubscribe
  }, [])

  return [props, loaded]
}
