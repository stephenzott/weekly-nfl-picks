import { useState } from 'react'

const STORAGE_KEY = 'weekly-nfl-picks:currentUserId'

// There's no login (PROJECT_SPEC.md Section 3) — instead, each device
// "remembers" which of the 5 names was last selected on it, using the
// browser's localStorage. localStorage persists across page reloads and
// browser restarts (unlike React state, which resets every time the page
// loads), but it's local to one browser on one device — that matches the
// spec's "pick your name from a dropdown" model, where identity is just a
// per-device preference, not a real authenticated account.
export function useCurrentUserId(): [string | null, (id: string | null) => void] {
  const [currentUserId, setCurrentUserIdState] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )

  function setCurrentUserId(id: string | null) {
    if (id) {
      localStorage.setItem(STORAGE_KEY, id)
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
    setCurrentUserIdState(id)
  }

  return [currentUserId, setCurrentUserId]
}
