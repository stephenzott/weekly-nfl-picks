import { Timestamp } from 'firebase/firestore'
import { useState } from 'react'
import { addGame } from '../../lib/games'
import type { Game, GameSlot, WeekType } from '../../types'

const SLOTS: GameSlot[] = [
  'AM',
  'PM',
  'SNF',
  'MNF',
  'WildCardPool',
  'Bonus',
  'Playoff',
]

// Per Stephen (2026-09-08): a regular season week is capped at 6 total
// games, full stop — including Bonus games. Playoff weeks are exempt
// entirely (every game on that week's slate needs its own pick, however
// many that is).
const MAX_REGULAR_SEASON_GAMES = 6

interface AddGameFormProps {
  weekId: string
  weekType: WeekType
  existingGames: Game[]
}

export function AddGameForm({ weekId, weekType, existingGames }: AddGameFormProps) {
  const cappedGamesCount = existingGames.length
  const atMaxGames = weekType === 'regular' && cappedGamesCount >= MAX_REGULAR_SEASON_GAMES
  const [slot, setSlot] = useState<GameSlot>('AM')
  // PROJECT_SPEC.md Section 4.2: playoff weeks have no AM/PM/SNF/etc. roles
  // — every game IS a "Playoff" pick. Per Stephen (2026-09-07): computed
  // fresh from the `weekType` prop at submit time (rather than trusted from
  // `slot` state) so it's always correct regardless of what `slot` happens
  // to hold — e.g. left over from before switching which week is selected
  // in the Admin dropdown, since this component isn't remounted on that
  // switch.
  const effectiveSlot = weekType === 'playoff' ? 'Playoff' : slot
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

  const canSubmit = Boolean(homeTeam.trim() && awayTeam.trim() && kickoffLocal) && !atMaxGames

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    try {
      await addGame({
        weekId,
        slot: effectiveSlot,
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
      // Reset the form for the next game, but leave `slot` alone since
      // admins will often add several games in the same slot in a row
      // (e.g. multiple WildCardPool games).
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
      {atMaxGames && (
        <p className="error-text">
          This week already has {cappedGamesCount} games — regular season weeks are capped at{' '}
          {MAX_REGULAR_SEASON_GAMES} total (including Bonus games). Edit or remove an existing game
          instead of adding another.
        </p>
      )}
      <div>
        {weekType === 'playoff' ? (
          <label>Slot: Playoff (every game in a playoff week requires a pick)</label>
        ) : (
          <label>
            Slot{' '}
            <select value={slot} onChange={(e) => setSlot(e.target.value as GameSlot)}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
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
