import { useEffect, useState } from 'react'
import { listenPicksForWeek } from '../lib/picks'
import type { Pick } from '../types'

export function usePicksForWeek(weekId: string | null): Pick[] {
  const [picks, setPicks] = useState<Pick[]>([])

  useEffect(() => {
    if (!weekId) {
      setPicks([])
      return
    }
    const unsubscribe = listenPicksForWeek(weekId, setPicks)
    return unsubscribe
  }, [weekId])

  return picks
}
