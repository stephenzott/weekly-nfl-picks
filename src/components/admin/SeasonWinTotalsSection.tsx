import { useState } from 'react'
import { useSeasonWinTotals } from '../../hooks/useSeasonWinTotals'
import { useUsers } from '../../hooks/useUsers'
import { addSeasonWinTotal } from '../../lib/seasonWinTotals'
import type { WinTotalSide } from '../../types'

// PROJECT_SPEC.md Section 4.4: "each user makes exactly 4 bets ... at a
// flat $20 per bet ... not flexible." REQUIRED_BETS_PER_USER and
// FLAT_STAKE encode those two hard constraints so the form can enforce
// them (stake isn't even an input field — it's always $20) rather than
// just hoping whoever's using Admin remembers the rule.
const REQUIRED_BETS_PER_USER = 4
const FLAT_STAKE = 20

export function SeasonWinTotalsSection() {
  const users = useUsers()
  const bets = useSeasonWinTotals()

  const [userId, setUserId] = useState('')
  const [team, setTeam] = useState('')
  const [line, setLine] = useState('')
  const [side, setSide] = useState<WinTotalSide>('over')
  const [submitting, setSubmitting] = useState(false)

  const betsForSelectedUser = bets.filter((b) => b.userId === userId)
  const selectedUserIsFull = userId !== '' && betsForSelectedUser.length >= REQUIRED_BETS_PER_USER

  const canSubmit = userId && team.trim() && line && !selectedUserIsFull

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await addSeasonWinTotal({
        userId,
        team: team.trim(),
        line: Number(line),
        side,
        stake: FLAT_STAKE,
        actualWins: null,
        result: 'pending',
      })
      setTeam('')
      setLine('')
      setSide('over')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2>Season Win Totals</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Player{' '}
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Select —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({bets.filter((b) => b.userId === u.id).length}/{REQUIRED_BETS_PER_USER})
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Team{' '}
          <input
            type="text"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder="e.g. Vikings"
          />
        </label>{' '}
        <label>
          Line{' '}
          <input
            type="number"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="e.g. 9.5"
            min={0}
            step={0.5}
          />
        </label>{' '}
        <label>
          <select value={side} onChange={(e) => setSide(e.target.value as WinTotalSide)}>
            <option value="over">Over</option>
            <option value="under">Under</option>
          </select>
        </label>{' '}
        <span>${FLAT_STAKE} (flat)</span>{' '}
        <button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Adding…' : 'Add Bet'}
        </button>
        {selectedUserIsFull && (
          <p style={{ color: 'red' }}>
            {users.find((u) => u.id === userId)?.name} already has {REQUIRED_BETS_PER_USER} season
            win total bets.
          </p>
        )}
      </form>

      {bets.length === 0 ? (
        <p>No season win total bets entered yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Bet</th>
              <th>Stake</th>
              <th>Actual Wins</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id}>
                <td>{users.find((u) => u.id === bet.userId)?.name ?? bet.userId}</td>
                <td>
                  {bet.team} {bet.line} ({bet.side})
                </td>
                <td>${bet.stake}</td>
                <td>{bet.actualWins ?? '—'}</td>
                <td>{bet.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
