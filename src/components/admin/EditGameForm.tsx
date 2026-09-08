import { Timestamp } from 'firebase/firestore'
import { useState } from 'react'
import { fetchEspnScore } from '../../lib/espn'
import { updateGame } from '../../lib/games'
import type { Game, GameSlot } from '../../types'

const SLOTS: GameSlot[] = ['AM', 'PM', 'SNF', 'MNF', 'WildCardPool', 'Bonus', 'Playoff']

// Converts a Firestore Timestamp into the string format
// <input type="datetime-local"> expects ("YYYY-MM-DDTHH:mm"), in the
// viewer's own local time — the inverse of what AddGameForm does when
// turning that same kind of string back into a Timestamp on save.
function toDatetimeLocalValue(timestamp: Game['kickoffTime']): string {
  const d = timestamp.toDate()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface EditGameFormProps {
  game: Game
  onDone: () => void
}

export function EditGameForm({ game, onDone }: EditGameFormProps) {
  const [slot, setSlot] = useState<GameSlot>(game.slot)
  const [homeTeam, setHomeTeam] = useState(game.homeTeam)
  const [awayTeam, setAwayTeam] = useState(game.awayTeam)
  const [kickoffLocal, setKickoffLocal] = useState(() => toDatetimeLocalValue(game.kickoffTime))
  const [favoredTeam, setFavoredTeam] = useState(game.spread?.favoredTeam ?? '')
  const [line, setLine] = useState(game.spread ? String(game.spread.line) : '')
  const [total, setTotal] = useState(game.total != null ? String(game.total) : '')
  const [savingDetails, setSavingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState<string | null>(null)

  const [homeScore, setHomeScore] = useState(game.finalScore ? String(game.finalScore.home) : '')
  const [awayScore, setAwayScore] = useState(game.finalScore ? String(game.finalScore.away) : '')
  const [savingScore, setSavingScore] = useState(false)
  const [espnStatus, setEspnStatus] = useState<string | null>(null)
  const [fetchingEspn, setFetchingEspn] = useState(false)

  const canSaveDetails = homeTeam.trim() && awayTeam.trim() && kickoffLocal

  // Unlike AddGameForm (a fresh form with nothing to desync yet),
  // favoredTeam here can already be set to one of the two team names when
  // an edit starts. If the admin then renames that same team, favoredTeam
  // would silently keep the OLD name — which matches neither team anymore
  // and would break settlement's string-equality comparisons. Renaming
  // the favored team's name along with it keeps them in sync; renaming
  // the OTHER team is unaffected since favoredTeam wasn't pointing at it.
  function handleAwayTeamChange(newValue: string) {
    if (favoredTeam === awayTeam) setFavoredTeam(newValue)
    setAwayTeam(newValue)
  }
  function handleHomeTeamChange(newValue: string) {
    if (favoredTeam === homeTeam) setFavoredTeam(newValue)
    setHomeTeam(newValue)
  }

  async function handleSaveDetails() {
    if (!canSaveDetails) return
    setSavingDetails(true)
    setDetailsError(null)
    try {
      await updateGame(game.id, {
        slot,
        homeTeam: homeTeam.trim(),
        awayTeam: awayTeam.trim(),
        kickoffTime: Timestamp.fromDate(new Date(kickoffLocal)),
        spread:
          favoredTeam.trim() && line ? { favoredTeam: favoredTeam.trim(), line: Number(line) } : null,
        total: total ? Number(total) : null,
        lineSource: 'manual',
      })
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : 'Failed to save.')
    } finally {
      setSavingDetails(false)
    }
  }

  async function handleFetchEspn() {
    setFetchingEspn(true)
    setEspnStatus(null)
    try {
      // Deliberately fetch against the SAVED `game` (not the in-progress
      // edits above) — ESPN matching is based on the teams/kickoff date
      // already on record, and this is a "try to fill in the score"
      // helper, not part of the details-editing flow.
      const result = await fetchEspnScore(game)
      switch (result.status) {
        case 'final':
          setHomeScore(String(result.home))
          setAwayScore(String(result.away))
          setEspnStatus('Filled in from ESPN — review, then click "Save Score" below.')
          break
        case 'not-final':
          setEspnStatus("ESPN has this game but it hasn't finished yet.")
          break
        case 'not-found':
          setEspnStatus("Couldn't find a matching game on ESPN for this date/teams.")
          break
        case 'error':
          setEspnStatus(`ESPN fetch failed: ${result.message}`)
          break
      }
    } finally {
      setFetchingEspn(false)
    }
  }

  async function handleSaveScore() {
    if (homeScore === '' || awayScore === '') return
    setSavingScore(true)
    try {
      await updateGame(game.id, {
        finalScore: { home: Number(homeScore), away: Number(awayScore) },
        status: 'final',
      })
    } finally {
      setSavingScore(false)
    }
  }

  async function handleReopen() {
    await updateGame(game.id, { status: 'scheduled' })
  }

  return (
    <div style={{ border: '2px solid #333', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <h3>
        Edit: {game.awayTeam} @ {game.homeTeam}
      </h3>

      <fieldset>
        <legend>Game Details</legend>
        <div>
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
        </div>
        <div>
          <label>
            Away team{' '}
            <input
              type="text"
              value={awayTeam}
              onChange={(e) => handleAwayTeamChange(e.target.value)}
            />
          </label>
        </div>
        <div>
          <label>
            Home team{' '}
            <input
              type="text"
              value={homeTeam}
              onChange={(e) => handleHomeTeamChange(e.target.value)}
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
            />
          </label>
        </div>
        <div>
          <label>
            Favored team{' '}
            <select value={favoredTeam} onChange={(e) => setFavoredTeam(e.target.value)}>
              <option value="">— none —</option>
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
              min={0}
              step={0.5}
            />
          </label>
        </div>
        <div>
          <label>
            Total{' '}
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              min={0}
              step={0.5}
            />
          </label>
        </div>
        {detailsError && <p style={{ color: 'red' }}>{detailsError}</p>}
        <button onClick={handleSaveDetails} disabled={!canSaveDetails || savingDetails}>
          {savingDetails ? 'Saving…' : 'Save Details'}
        </button>
      </fieldset>

      <fieldset>
        <legend>Final Score (status: {game.status})</legend>
        <button onClick={handleFetchEspn} disabled={fetchingEspn}>
          {fetchingEspn ? 'Checking ESPN…' : 'Fetch Score from ESPN'}
        </button>
        {espnStatus && <p>{espnStatus}</p>}
        <div>
          <label>
            {game.awayTeam} (away){' '}
            <input
              type="number"
              value={awayScore}
              onChange={(e) => setAwayScore(e.target.value)}
              min={0}
            />
          </label>{' '}
          <label>
            {game.homeTeam} (home){' '}
            <input
              type="number"
              value={homeScore}
              onChange={(e) => setHomeScore(e.target.value)}
              min={0}
            />
          </label>
        </div>
        <button
          onClick={handleSaveScore}
          disabled={homeScore === '' || awayScore === '' || savingScore}
        >
          {savingScore ? 'Saving…' : 'Save Score & Mark Final'}
        </button>{' '}
        {game.status === 'final' && (
          <button onClick={handleReopen}>Reopen (mark not final)</button>
        )}
      </fieldset>

      <button onClick={onDone}>Done</button>
    </div>
  )
}
