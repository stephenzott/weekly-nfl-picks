import { Timestamp } from 'firebase/firestore'
import { useState } from 'react'
import { addGame, updateGame } from '../../lib/games'
import {
  fetchNflOdds,
  findMatchingOdds,
  nicknameFromFullName,
  toGameSpread,
  type OddsForGame,
} from '../../lib/odds'
import type { Game, Pick as PickDoc } from '../../types'

interface ImportGamesProps {
  weekId: string
  existingGames: Game[]
  // Every pick already submitted anywhere in this week — used to skip
  // refreshing odds on a game once a real pick references it (line-locking,
  // PROJECT_SPEC.md Section 4.7), same idea FetchOddsButton used to apply on
  // its own before this component absorbed it.
  picksInWeek: PickDoc[]
}

// Replaces the old two-button setup (Fetch Odds + Import Wild Card Games)
// with one combined step, since manual game entry is gone for regular
// weeks: this is now the ONLY way games get onto the board. One click does
// both halves of the job the two old buttons split between them —
// refreshing spread/total on games already added, and finding brand new
// games to add — and everything new lands in the shared WildCardPool.
// SharedSlotsPicker.tsx is where an admin actually assigns AM/PM/SNF/MNF/
// HighSpread/Bonus roles to specific pool games afterward.
export function ImportGames({ weekId, existingGames, picksInWeek }: ImportGamesProps) {
  // Pads a Date down to an <input type="date"> string ("YYYY-MM-DD") in the
  // viewer's own local time.
  function toDateInputValue(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  }

  // Default to "today through a week out" — wide enough to comfortably
  // cover a normal Thursday-to-Monday NFL week without the admin having to
  // do anything, but short enough that it won't accidentally pull in NEXT
  // week's games too. There's no way to compute this automatically anymore
  // (the old code anchored off games already added, which no longer exist
  // yet for a brand-new week) — weird weeks (a Wednesday game before
  // Thanksgiving, a Friday game after Thanksgiving or on Christmas) are
  // exactly why this stays admin-editable rather than hardcoded to
  // Thursday–Monday.
  const today = new Date()
  const defaultEnd = new Date(today)
  defaultEnd.setDate(defaultEnd.getDate() + 6)

  const [startDate, setStartDate] = useState(toDateInputValue(today))
  const [endDate, setEndDate] = useState(toDateInputValue(defaultEnd))
  const [fetching, setFetching] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)
  // The raw odds-API response from the last "Load Games" click, kept around
  // so "Import" can match it against existingGames again without a second
  // API call (each call costs Odds API credits — see lib/odds.ts).
  const [loadedEvents, setLoadedEvents] = useState<OddsForGame[] | null>(null)
  // Events in the date window that don't match an existing game — the
  // checklist of "new game" candidates shown to the admin for review.
  const [newGameCandidates, setNewGameCandidates] = useState<OddsForGame[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Vite only exposes env vars prefixed VITE_ to client code, and only ones
  // actually referenced via import.meta.env (statically replaced at build
  // time, not a normal runtime object lookup).
  const hasKey = Boolean(import.meta.env.VITE_ODDS_API_KEY)

  function eventKey(event: OddsForGame): string {
    return `${event.homeTeamRaw}@${event.awayTeamRaw}`
  }

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  async function handleLoad() {
    setFetching(true)
    setError(null)
    setSummary(null)
    setNewGameCandidates(null)
    setSelected(new Set())
    try {
      const result = await fetchNflOdds()
      if (result.status === 'no-key') {
        setError('No Odds API key configured for this build.')
        return
      }
      if (result.status === 'error') {
        setError(`Fetch failed: ${result.message}`)
        return
      }
      setLoadedEvents(result.events)

      // Anything that already matches a game on the board (any slot) isn't
      // a "new game" candidate — same loose team-name substring matching
      // findMatchingOdds already uses for the odds-refresh half below.
      const alreadyAddedKeys = new Set(
        existingGames
          .map((g) => findMatchingOdds(result.events, g.homeTeam, g.awayTeam))
          .filter((e): e is OddsForGame => e != null)
          .map(eventKey),
      )
      // Inclusive of the whole end day (23:59:59), not just midnight.
      const startMs = new Date(`${startDate}T00:00:00`).getTime()
      const endMs = new Date(`${endDate}T23:59:59`).getTime()
      const inWindow = result.events.filter((e) => {
        const t = new Date(e.commenceTime).getTime()
        return t >= startMs && t <= endMs
      })
      const candidates = inWindow.filter((e) => !alreadyAddedKeys.has(eventKey(e)))
      setNewGameCandidates(candidates)
      // Default every found game to selected — usually the admin wants all
      // of them; unchecking one off is less friction than checking many on.
      setSelected(new Set(candidates.map(eventKey)))
    } finally {
      setFetching(false)
    }
  }

  async function handleImport() {
    if (!loadedEvents) return
    setImporting(true)
    try {
      let updated = 0
      let lineLocked = 0
      let noLinePosted = 0
      for (const game of existingGames) {
        const match = findMatchingOdds(loadedEvents, game.homeTeam, game.awayTeam)
        if (!match) continue
        if (picksInWeek.some((p) => p.gameId === game.id)) {
          lineLocked++
          continue
        }
        const spread = toGameSpread(match, game)
        // Only write fields the API actually had a number for this pass —
        // if a bookmaker has posted a spread but not a total yet, don't
        // overwrite an existing manual total with a blank one just because
        // this fetch didn't see it.
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

      let added = 0
      for (const event of newGameCandidates ?? []) {
        if (!selected.has(eventKey(event))) continue
        const homeTeam = nicknameFromFullName(event.homeTeamRaw)
        const awayTeam = nicknameFromFullName(event.awayTeamRaw)
        // Every new game starts in the shared pool — SharedSlotsPicker is
        // where an admin actually promotes one into AM/PM/SNF/MNF/
        // HighSpread/Bonus; whatever's never promoted stays here as the
        // Wild Card pool users pick from directly.
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
        added++
      }

      setSummary(
        `Added ${added} new game(s) to the pool. Refreshed odds on ${updated} existing game(s). ` +
          `${lineLocked} existing game(s) skipped (picks already submitted). ` +
          `${noLinePosted} matched but no line posted yet.`,
      )
      setLoadedEvents(null)
      setNewGameCandidates(null)
      setSelected(new Set())
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={{ margin: '12px 0' }}>
      <h3>Import Games</h3>
      <p>
        Refreshes spread/total on games already added, and finds new games within the date range
        below to add to the pool. Everything new lands in WildCardPool — use the dropdowns below
        to assign AM/PM/SNF/MNF/HighSpread/Bonus roles.
      </p>
      <label>
        From{' '}
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </label>{' '}
      <label>
        To <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </label>{' '}
      <button onClick={handleLoad} disabled={!hasKey || fetching}>
        {fetching ? 'Loading…' : 'Load Games'}
      </button>
      {!hasKey && <span> (no Odds API key configured for this build)</span>}
      {error && <p className="error-text">{error}</p>}
      {summary && <p>{summary}</p>}

      {newGameCandidates && (
        <div>
          <p>
            {newGameCandidates.length === 0
              ? 'No new games found in this date range — everything nearby is already added.'
              : `New games found in this range (${selected.size} selected to add):`}
          </p>
          {newGameCandidates.length > 0 && (
            <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
              {newGameCandidates.map((event) => {
                const key = eventKey(event)
                const checked = selected.has(key)
                return (
                  <li key={key}>
                    <label>
                      <input type="checkbox" checked={checked} onChange={() => toggle(key)} />{' '}
                      {nicknameFromFullName(event.awayTeamRaw)} @{' '}
                      {nicknameFromFullName(event.homeTeamRaw)}
                      {' — '}
                      {new Date(event.commenceTime).toLocaleString()}
                      {event.line != null
                        ? ` (${
                            event.favoredSide === 'home'
                              ? nicknameFromFullName(event.homeTeamRaw)
                              : nicknameFromFullName(event.awayTeamRaw)
                          } -${event.line})`
                        : ' (no line posted yet)'}
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
          <button onClick={handleImport} disabled={importing}>
            {importing ? 'Importing…' : `Import (${selected.size} new + refresh existing odds)`}
          </button>
        </div>
      )}
    </div>
  )
}
