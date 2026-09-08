import { useEffect, useState } from 'react'
import { listenSeasonWinTotals } from '../lib/seasonWinTotals'
import type { SeasonWinTotal } from '../types'

export function useSeasonWinTotals(): SeasonWinTotal[] {
  const [bets, setBets] = useState<SeasonWinTotal[]>([])

  useEffect(() => {
    const unsubscribe = listenSeasonWinTotals(setBets)
    return unsubscribe
  }, [])

  return bets
}
