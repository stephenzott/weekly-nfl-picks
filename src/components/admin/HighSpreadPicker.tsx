import { useState } from 'react'
import { setHighSpreadGame } from '../../lib/weeks'
import { sortBySpreadDesc } from '../../lib/slots'
import type { Game, Pick as PickDoc, Week } from '../../types'

interface HighSpreadPickerProps {
  week: Week
  games: Game[]
  // Used to lock this picker once a user has actually saved a HighSpread
  // pick against the current selection — see the isLocked comment below.
  picksInWeek: PickDoc[]
}

// Per Stephen (2026-09-08): HighSpread is no longer auto-computed. The
// admin picks which WildCardPool game counts as this week's "Highest
// Spread" pick — informed by the spread/total numbers Fetch Odds already
// pulled in, but with final say (a stale or wrong auto-picked line was the
// concern). Whatever's left in WildCardPool after this pick becomes the
// actual WildCard candidate pool (see computeSlotsForRegularWeek).
export function HighSpreadPicker({ week, games, picksInWeek }: HighSpreadPickerProps) {
  const [saving, setSaving] = useState(false)
  const candidates = sortBySpreadDesc(games.filter((g) => g.slot === 'WildCardPool'))
  const currentId = week.highSpreadGameId ?? ''

  // findExistingPick (src/lib/slots.ts) matches a saved HighSpread pick by
  // BOTH pickType and gameId, so re-pointing highSpreadGameId at a
  // different game makes any already-saved HighSpread pick invisible to
  // its slot — the user's old stake becomes orphaned (still counted in
  // BudgetSummary's raw sum over every pick, but no longer part of the
  // live slot/reserve math), which can silently let a forced last-pick
  // push someone over the real $120 they've actually committed. Same
  // line-locking idea FetchOddsButton already uses for spread edits:
  // once anyone has a real pick against THIS week's current HighSpread
  // game, don't allow changing the selection out from under them.
  const isLocked =
    currentId !== '' && picksInWeek.some((p) => p.pickType === 'HighSpread' && p.gameId === currentId)

  async function handleChange(gameId: string) {
    setSaving(true)
    try {
      await setHighSpreadGame(week.id, gameId || null)
    } finally {
      setSaving(false)
    }
  }

  if (candidates.length === 0) {
    return (
      <p>
        No WildCardPool games yet this week — add some below before picking a Highest Spread
        game.
      </p>
    )
  }

  return (
    <div>
      <h3>Highest Spread Pick</h3>
      <label>
        Game{' '}
        <select
          value={currentId}
          onChange={(e) => handleChange(e.target.value)}
          disabled={saving || isLocked}
        >
          <option value="">— none selected —</option>
          {candidates.map((game) => (
            <option key={game.id} value={game.id}>
              {game.awayTeam} @ {game.homeTeam}
              {game.spread ? ` (${game.spread.favoredTeam} -${game.spread.line})` : ' (no spread yet)'}
            </option>
          ))}
        </select>
      </label>{' '}
      {isLocked && <span>(locked — someone has already picked this game; can't change it now)</span>}
      {/* The rest of WildCardPool becomes the WildCard pool automatically
          once this is saved — no separate action needed. */}
    </div>
  )
}
