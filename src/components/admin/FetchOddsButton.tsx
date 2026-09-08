import { useState } from 'react'
import { updateGame } from '../../lib/games'
import { fetchNflOdds, findMatchingOdds, toGameSpread } from '../../lib/odds'
import type { Game, Pick as PickDoc } from '../../types'

interface FetchOddsButtonProps {
  games: Game[]
  // Every pick already submitted anywhere in this week — used only to
  // check "does ANY pick reference this gameId," for line-locking
  // (PROJECT_SPEC.md Section 4.7). Passed down rather than fetched here so
  // AdminPage's existing usePicksForWeek call (if any is added later) can
  // be shared instead of opening a second identical listener.
  picksInWeek: PickDoc[]
}

// PROJECT_SPEC.md Section 4.7: a single button that fetches odds for every
// upcoming NFL game in one API call (see src/lib/odds.ts), then fills in
// spread/total on whichever of THIS week's already-added games it can
// match by team name — it never creates new games itself (see Stephen's
// 2026-09-08 "only fill existing games" decision). Games that already
// have at least one pick submitted against them are left untouched
// (line-locking), and manual editing via EditGameForm always remains
// available regardless of where a game's current spread/total came from.
export function FetchOddsButton({ games, picksInWeek }: FetchOddsButtonProps) {
  const [fetching, setFetching] = useState(false)
  const [summary, setSummary] = useState<string | null>(null)

  // Vite only exposes env vars prefixed VITE_ to client code, and only
  // ones actually referenced via import.meta.env (it statically replaces
  // these at build time — this isn't a normal runtime object lookup).
  const hasKey = Boolean(import.meta.env.VITE_ODDS_API_KEY)

  async function handleFetch() {
    setFetching(true)
    setSummary(null)
    try {
      const result = await fetchNflOdds()
      if (result.status === 'no-key') {
        setSummary('No Odds API key configured for this build — use manual entry below instead.')
        return
      }
      if (result.status === 'error') {
        setSummary(`Fetch failed: ${result.message}. Manual entry below still works.`)
        return
      }

      let updated = 0
      let lineLocked = 0
      let noMatch = 0
      let noLinePosted = 0

      for (const game of games) {
        const match = findMatchingOdds(result.events, game.homeTeam, game.awayTeam)
        if (!match) {
          // Distinct from "matched but no line yet" below — this means the
          // API returned no event with these team names at all, which
          // usually means a typo in Away/Home team on this game (matching
          // is a loose substring check, not exact) rather than a line
          // that just hasn't posted. Reported separately so a typo doesn't
          // get misread as "just wait and try again."
          noMatch++
          continue
        }
        if (picksInWeek.some((p) => p.gameId === game.id)) {
          lineLocked++
          continue
        }

        const spread = toGameSpread(match, game)
        // Only write fields the API actually had a number for this pass —
        // if a bookmaker has posted a spread but not a total yet (happens
        // early in the week), don't overwrite an existing manual total
        // with a blank one just because this fetch didn't see it.
        if (!spread && match.total == null) {
          noLinePosted++
          continue
        }
        const updates: Partial<Pick<Game, 'spread' | 'total' | 'lineSource'>> = { lineSource: 'api' }
        if (spread) updates.spread = spread
        if (match.total != null) updates.total = match.total
        await updateGame(game.id, updates)
        updated++
      }

      setSummary(
        `Updated ${updated} game(s). ${lineLocked} skipped (picks already submitted). ` +
          `${noMatch} had no matching game found (check team name spelling). ` +
          `${noLinePosted} matched but no line posted yet.`,
      )
    } finally {
      setFetching(false)
    }
  }

  return (
    <div>
      <button onClick={handleFetch} disabled={!hasKey || fetching || games.length === 0}>
        {fetching ? 'Fetching odds…' : 'Fetch Odds'}
      </button>{' '}
      {!hasKey && <span>(no Odds API key configured — use manual entry)</span>}
      {summary && <p>{summary}</p>}
    </div>
  )
}
