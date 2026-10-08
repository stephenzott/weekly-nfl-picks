import { Timestamp } from 'firebase/firestore'
import { useState } from 'react'
import { addGame } from '../../lib/games'

interface AddGameFormProps {
  weekId: string
}

// Playoff weeks have no AM/PM/SNF/MNF/WildCardPool structure — every game on
// the slate requires its own pick (PROJECT_SPEC.md Section 4.2), so this form
// stays a plain one-at-a-time manual entry with the slot hardcoded to
// 'Playoff'. Regular season weeks no longer use this component at all: see
// ImportGames.tsx + SharedSlotsPicker.tsx, which pull games from the Odds API
// and assign them to the 5 shared slots (AM/PM/SNF/MNF/HighSpread) plus Bonus
// instead of typing them in by hand.
export function AddGameForm({ weekId }: AddGameFormProps) {
  const [homeTeam, setHomeTeam] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  // The <input type="datetime-local"> element gives us back a string like
  // "2026-09-14T13:00" with NO timezone info attached — the browser (and
  // later, `new Date(...)`) assumes it means 1:00pm in whatever timezone
  // the person filling out the form is currently in. So: if you (the admin)
  // are in Eastern time, typing "1:00 PM" here correctly means 1pm ET. If
  // you're ever filling this out from a different timezone, convert the
  // kickoff time to your own local wall-clock time first.
  const [kickoffLocal, setKickoffLocal] = useState('')
  const [favoredTeam, setFavoredTeam] = useState('')
  const [line, setLine] = useState('')
  const [total, setTotal] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = Boolean(homeTeam.trim() && awayTeam.trim() && kickoffLocal)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      await addGame({
        weekId,
        slot: 'Playoff',
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        kickoffTime: Timestamp.fromDate(new Date(kickoffLocal)),
        spread:
          favoredTeam.trim() && line
            ? { favoredTeam: favoredTeam.trim(), line: Number(line) }
            : null,
        total: total ? Number(total) : null,
        finalScore: null,
        status: 'scheduled',
        lineSource: 'manual',
      })
      setHomeTeam('')
      setAwayTeam('')
      setKickoffLocal('')
      setFavoredTeam('')
      setLine('')
      setTotal('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add a Game</h3>
      <label>Slot: Playoff (every game in a playoff week requires a pick)</label>
      <div>
        <label>
          Away team{' '}
          <input
            type="text"
            value={awayTeam}
            onChange={(e) => setAwayTeam(e.target.value)}
            placeholder="e.g. Cowboys"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Home team{' '}
          <input
            type="text"
            value={homeTeam}
            onChange={(e) => setHomeTeam(e.target.value)}
            placeholder="e.g. Eagles"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Kickoff{' '}
          <input
            type="datetime-local"
            value={kickoffLocal}
            onChange={(e) => setKickoffLocal(e.target.value)}
            required
          />
        </label>
      </div>
      <fieldset>
        <legend>Spread (optional — can be filled in later)</legend>
        <label>
          Favored team{' '}
          {/* A dropdown over the two team names already typed above (rather
              than free text) guarantees favoredTeam always exactly matches
              homeTeam or awayTeam — settlement math later will compare
              these by exact string equality, so a typo here would
              otherwise silently break settlement for this game. */}
          <select
            value={favoredTeam}
            onChange={(e) => setFavoredTeam(e.target.value)}
            disabled={!homeTeam.trim() || !awayTeam.trim()}
          >
            <option value="">— none entered —</option>
            {awayTeam.trim() && <option value={awayTeam.trim()}>{awayTeam.trim()}</option>}
            {homeTeam.trim() && <option value={homeTeam.trim()}>{homeTeam.trim()}</option>}
          </select>
        </label>{' '}
        <label>
          Line{' '}
          <input
            type="number"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="e.g. 8.5"
            min={0}
            step={0.5}
          />
        </label>
      </fieldset>
      <div>
        <label>
          Total (optional){' '}
          <input
            type="number"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="e.g. 47.5"
            min={0}
            step={0.5}
          />
        </label>
      </div>
      <button type="submit" disabled={!canSubmit || submitting}>
        {submitting ? 'Adding…' : 'Add Game'}
      </button>
    </form>
  )
}
