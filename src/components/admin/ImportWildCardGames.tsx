import { Timestamp } from 'firebase/firestore'
import { useState } from 'react'
import { addGame } from '../../lib/games'
import {
  fetchNflOdds,
  nicknameFromFullName,
  toGameSpread,
  type OddsForGame,
} from '../../lib/odds'
import type { Game } from '../../types'

interface ImportWildCardGamesProps {
  weekId: string
  existingGames: Game[]
}

const MAX_REGULAR_SEASON_GAMES = 6

// Per Stephen (2026-09-08): typing out every non-marquee game by hand
// (team names, kickoff time) was pure friction once Fetch Odds already
// has that data available — this pulls the week's remaining NFL games
// from the Odds API and lets the admin check off which ones to add as
// WildCardPool games in one shot, team names/kickoff/spread/total all
// pre-filled. AM/PM/SNF/MNF/Bonus still get added one at a time via
// AddGameForm — those need a deliberate admin choice of which ONE game
// fills each marquee slot, so bulk-adding them wouldn't save real effort
// the way it does for WildCard candidates.
export function ImportWildCardGames({ weekId, existingGames }: ImportWildCardGamesProps) {
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [candidates, setCandidates] = useState<OddsForGame[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const hasKey = Boolean(import.meta.env.VITE_ODDS_API_KEY)
  const remainingSlots = MAX_REGULAR_SEASON_GAMES - existingGames.length

  // The Odds API returns every upcoming NFL game for the WHOLE season in
  // one call, not just this week's — without narrowing that down, the
  // checklist below would be dozens of games long, most of them weeks
  // away. There's no explicit "which calendar week is this" field on
  // Week (labels like "Wild Card" don't parse to a date), so this
  // anchors off whichever games are ALREADY on the board: NFL weeks run
  // Thursday night through Monday night, so a window from 3 days before
  // the earliest existing kickoff to 2 days after the latest comfortably
  // covers the same week without spilling into the next one. Requires at
  // least one game already added (see the disabled-button message below)
  // — in practice that's always true by the time an admin gets here,
  // since HowToAddGames.tsx has them add AM/PM/SNF/MNF first.
  function weekWindow(): { start: number; end: number } | null {
    if (existingGames.length === 0) return null
    const times = existingGames.map((g) => g.kickoffTime.toMillis())
    const DAY = 24 * 60 * 60 * 1000
    return { start: Math.min(...times) - 3 * DAY, end: Math.max(...times) + 2 * DAY }
  }

  function eventKey(event: OddsForGame): string {
    return `${event.homeTeamRaw}@${event.awayTeamRaw}`
  }

  async function handleLoad() {
    const window = weekWindow()
    if (!window) return
    setFetching(true)
    setError(null)
    setCandidates(null)
    setSelected(new Set())
    try {
      const result = await fetchNflOdds()
      if (result.status === 'no-key') {
        setError('No Odds API key configured for this build — add WildCard games manually below instead.')
        return
      }
      if (result.status === 'error') {
        setError(`Fetch failed: ${result.message}. Add WildCard games manually below instead.`)
        return
      }
      // Exclude any event that matches a game already added to this week
      // (any slot, not just WildCardPool) — same loose team-name matching
      // Fetch Odds itself uses, so a game already on the board never shows
      // up twice as an "importable" option.
      const alreadyAddedKeys = new Set(
        existingGames
          .map((g) =>
            result.events.find(
              (e) =>
                e.homeTeamRaw.toLowerCase().includes(g.homeTeam.toLowerCase()) &&
                e.awayTeamRaw.toLowerCase().includes(g.awayTeam.toLowerCase()),
            ),
          )
          .filter((e): e is OddsForGame => e != null)
          .map(eventKey),
      )
      const inWindow = result.events.filter((e) => {
        const t = new Date(e.commenceTime).getTime()
        return t >= window.start && t <= window.end
      })
      setCandidates(inWindow.filter((e) => !alreadyAddedKeys.has(eventKey(e))))
    } finally {
      setFetching(false)
    }
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else if (next.size < remainingSlots) {
        next.add(key)
      }
      return next
    })
  }

  async function handleImport() {
    if (!candidates) return
    setImporting(true)
    try {
      for (const event of candidates) {
        if (!selected.has(eventKey(event))) continue
        const homeTeam = nicknameFromFullName(event.homeTeamRaw)
        const awayTeam = nicknameFromFullName(event.awayTeamRaw)
        await addGame({
          weekId,
          slot: 'WildCardPool',
          homeTeam,
          awayTeam,
          kickoffTime: Timestamp.fromDate(new Date(event.commenceTime)),
          spread: toGameSpread(event, { homeTeam, awayTeam }),
          total: event.total,
          finalScore: null,
          status: 'scheduled',
          lineSource: 'api',
        })
      }
      setCandidates(null)
      setSelected(new Set())
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ margin: '12px 0' }}>
      <h3>Import Wild Card Games</h3>
      <button
        onClick={handleLoad}
        disabled={!hasKey || fetching || remainingSlots <= 0 || existingGames.length === 0}
      >
        {fetching ? 'Loading…' : 'Load Available Games'}
      </button>{' '}
      {!hasKey && <span>(no Odds API key configured — add games manually below)</span>}
      {hasKey && existingGames.length === 0 && (
        <span>(add at least one game first — e.g. this week's AM game — so we know which week to look for)</span>
      )}
      {hasKey && existingGames.length > 0 && remainingSlots <= 0 && (
        <span>(this week is already at the {MAX_REGULAR_SEASON_GAMES}-game cap)</span>
      )}
      {error && <p className="error-text">{error}</p>}

      {candidates && candidates.length === 0 && (
        <p>No other games found near this week's dates — everything nearby is already added.</p>
      )}

      {candidates && candidates.length > 0 && (
        <div>
          <p>
            Pick up to {remainingSlots} to add as WildCardPool games ({selected.size} selected):
          </p>
          <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
            {candidates.map((event) => {
              const key = eventKey(event)
              const checked = selected.has(key)
              return (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && selected.size >= remainingSlots}
                      onChange={() => toggle(key)}
                    />{' '}
                    {nicknameFromFullName(event.awayTeamRaw)} @ {nicknameFromFullName(event.homeTeamRaw)}
                    {' — '}
                    {new Date(event.commenceTime).toLocaleString()}
                    {event.line != null
                      ? ` (${event.favoredSide === 'home' ? nicknameFromFullName(event.homeTeamRaw) : nicknameFromFullName(event.awayTeamRaw)} -${event.line})`
                      : ' (no line posted yet)'}
                  </label>
                </li>
              )
            })}
          </ul>
          <button onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? 'Adding…' : `Add ${selected.size} Selected Game(s)`}
          </button>
        </div>
      )}
    </div>
  )
}
