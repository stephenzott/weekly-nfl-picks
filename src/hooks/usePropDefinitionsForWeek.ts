import { useEffect, useState } from 'react'
import { listenPropDefinitionsForWeek } from '../lib/propDefinitions'
import type { PropDefinition } from '../types'

export function usePropDefinitionsForWeek(weekId: string | null): PropDefinition[] {
  const [defs, setDefs] = useState<PropDefinition[]>([])

  useEffect(() => {
    if (!weekId) {
      setDefs([])
      return
    }
    const unsubscribe = listenPropDefinitionsForWeek(weekId, setDefs)
    return unsubscribe
  }, [weekId])

  return defs
}
