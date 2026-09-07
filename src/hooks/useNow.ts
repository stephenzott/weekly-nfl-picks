import { useEffect, useState } from 'react'

// Reveal/lock decisions (PROJECT_SPEC.md Section 4.6) depend on comparing
// "now" against each game's kickoff time. If we just read `new Date()`
// once when a component renders, the page would only ever notice a game
// has kicked off if something else happens to trigger a re-render (e.g.
// the user clicking something). Polling the clock and storing it in state
// means React re-renders on its own as kickoff times pass, so a page left
// open through kickoff will reveal picks / lock the pick form without
// needing a manual refresh.
//
// 30 seconds is frequent enough that a game "unlocking" feels prompt, but
// infrequent enough not to matter for battery/performance on a phone.
const POLL_INTERVAL_MS = 30_000

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return now
}
