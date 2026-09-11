import { useState } from 'react'
import { useSeasonWinTotals } from '../../hooks/useSeasonWinTotals'
import { useUsers } from '../../hooks/useUsers'
import { MIN_STAKE, SEASON_WIN_TOTAL_BUDGET, SEASON_WIN_TOTAL_REQUIRED_BETS } from '../../lib/constants'
import {
  addSeasonWinTotal,
  updateSeasonWinTotalActualWins,
  updateSeasonWinTotalDetails,
} from '../../lib/seasonWinTotals'
import type { SeasonWinTotal, WinTotalSide } from '../../types'

export function SeasonWinTotalsSection() {
  const users = useUsers()
  const bets = useSeasonWinTotals()

  const [userId, setUserId] = useState('')
  const [team, setTeam] = useState('')
  const [line, setLine] = useState('')
  const [side, setSide] = useState<WinTotalSide>('over')
  const [stake, setStake] = useState(MIN_STAKE)
  const [submitting, setSubmitting] = useState(false)

  const betsForSelectedUser = bets.filter((b) => b.userId === userId)
  const selectedUserIsFull = userId !== '' && betsForSelectedUser.length >= SEASON_WIN_TOTAL_REQUIRED_BETS

  // PROJECT_SPEC.md Section 4.4, changed during build (Stephen,
  // 2026-09-08): the 4 required bets must now sum to EXACTLY $100 (not
  // just "up to $100"), freely split however the user wants — same
  // "reserve $10 for every OTHER not-yet-placed bet" math as the weekly
  // picks budget (see WeekPicks.tsx/PickSlot.tsx), scoped to one user's 4
  // season-long bets. To guarantee the total lands exactly on $100 rather
  // than under it, the LAST of the 4 bets isn't freely entered at all —
  // its stake is forced to whatever's left, closing the gap exactly (the
  // same trick as "split the check" UIs auto-filling the final share).
  const alreadyStaked = betsForSelectedUser.reduce((sum, b) => sum + b.stake, 0)
  const isLastBet = betsForSelectedUser.length === SEASON_WIN_TOTAL_REQUIRED_BETS - 1
  const remainingBudget = SEASON_WIN_TOTAL_BUDGET - alreadyStaked
  const otherUnplacedBets = Math.max(0, SEASON_WIN_TOTAL_REQUIRED_BETS - betsForSelectedUser.length - 1)
  const reserveForOtherBets = otherUnplacedBets * MIN_STAKE
  const maxStakeForThisBet = remainingBudget - reserveForOtherBets
  // The forced final stake: whatever's left after the first 3 bets. The
  // reserve math above guarantees this is always >= MIN_STAKE by the time
  // it's actually the 4th bet being entered (each prior bet was capped to
  // leave enough behind), so it never needs its own validation.
  const effectiveStake = isLastBet ? remainingBudget : stake
  const wouldExceedBudget = !isLastBet && stake > maxStakeForThisBet

  const canSubmit =
    userId &&
    team.trim() &&
    line &&
    !selectedUserIsFull &&
    effectiveStake >= MIN_STAKE &&
    !wouldExceedBudget

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
        stake: effectiveStake,
        actualWins: null,
        result: 'pending',
      })
      setTeam('')
      setLine('')
      setSide('over')
      setStake(MIN_STAKE)
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
                {u.name} ({bets.filter((b) => b.userId === u.id).length}/{SEASON_WIN_TOTAL_REQUIRED_BETS})
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
        <label>
          Stake ($){' '}
          <input
            type="number"
            value={isLastBet ? remainingBudget : stake}
            onChange={(e) => setStake(Number(e.target.value))}
            min={MIN_STAKE}
            step={1}
            disabled={isLastBet}
          />
        </label>{' '}
        <button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Adding…' : 'Add Bet'}
        </button>
        {userId && isLastBet && (
          <p>
            Last bet — stake locked at ${remainingBudget} to bring{' '}
            {users.find((u) => u.id === userId)?.name}'s total to exactly ${SEASON_WIN_TOTAL_BUDGET}.
          </p>
        )}
        {userId && !isLastBet && !selectedUserIsFull && (
          <p>
            ${remainingBudget} of ${SEASON_WIN_TOTAL_BUDGET} left for{' '}
            {users.find((u) => u.id === userId)?.name}'s remaining bets
            {reserveForOtherBets > 0 && ` ($${reserveForOtherBets} of that needs to stay reserved for the others)`}.
          </p>
        )}
        {userId && wouldExceedBudget && !selectedUserIsFull && (
          <p className="error-text">
            That stake is more than the ${maxStakeForThisBet} available for this bet right now.
          </p>
        )}
        {selectedUserIsFull && (
          <p className="error-text">
            {users.find((u) => u.id === userId)?.name} already has {SEASON_WIN_TOTAL_REQUIRED_BETS}{' '}
            season win total bets.
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <SeasonWinTotalRow
                key={bet.id}
                bet={bet}
                userName={users.find((u) => u.id === bet.userId)?.name ?? bet.userId}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Split into its own component (rather than inline in the table above) so
// the "actual wins" input field has its own local state per row — without
// this, typing into one row's input would need to update one shared piece
// of parent state keyed by bet id, which is more bookkeeping for the same
// result.
function SeasonWinTotalRow({
  bet,
  userName,
}: {
  bet: SeasonWinTotal
  userName: string
}) {
  const [actualWinsInput, setActualWinsInput] = useState(bet.actualWins != null ? String(bet.actualWins) : '')
  const [saving, setSaving] = useState(false)

  // Separate from `editingDetails` below: entering the season's real
  // outcome (actualWins) and correcting a bet that was typed in wrong
  // (team/line/side/stake) are different actions, so they get independent
  // edit states rather than sharing one "editing" flag.
  const [editingDetails, setEditingDetails] = useState(false)
  const [team, setTeam] = useState(bet.team)
  const [line, setLine] = useState(String(bet.line))
  const [side, setSide] = useState<WinTotalSide>(bet.side)
  const [stake, setStake] = useState(String(bet.stake))
  const [savingDetails, setSavingDetails] = useState(false)

  async function handleSaveActualWins() {
    if (actualWinsInput === '') return
    setSaving(true)
    try {
      // PROJECT_SPEC.md Section 4.4: settlement happens once, at the end of
      // the season, when the team's real final win count is known —
      // computing and writing `result` here (rather than a background
      // settlement pass) matches that "one manual entry, once" shape. See
      // updateSeasonWinTotalActualWins in src/lib/seasonWinTotals.ts.
      await updateSeasonWinTotalActualWins(bet, Number(actualWinsInput))
    } finally {
      setSaving(false)
    }
  }

  const canSaveDetails = team.trim() && line !== '' && Number(stake) >= MIN_STAKE

  async function handleSaveDetails() {
    if (!canSaveDetails) return
    setSavingDetails(true)
    try {
      await updateSeasonWinTotalDetails(bet, {
        team: team.trim(),
        line: Number(line),
        side,
        stake: Number(stake),
      })
      setEditingDetails(false)
    } finally {
      setSavingDetails(false)
    }
  }

  function handleCancelDetails() {
    setTeam(bet.team)
    setLine(String(bet.line))
    setSide(bet.side)
    setStake(String(bet.stake))
    setEditingDetails(false)
  }

  if (editingDetails) {
    return (
      <tr>
        <td>{userName}</td>
        <td>
          <input type="text" value={team} onChange={(e) => setTeam(e.target.value)} style={{ width: 90 }} />{' '}
          <input
            type="number"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            min={0}
            step={0.5}
            style={{ width: 60 }}
          />{' '}
          <select value={side} onChange={(e) => setSide(e.target.value as WinTotalSide)}>
            <option value="over">Over</option>
            <option value="under">Under</option>
          </select>
        </td>
        <td>
          <input
            type="number"
            value={stake}
            onChange={(e) => setStake(e.target.value)}
            min={MIN_STAKE}
            step={1}
            style={{ width: 60 }}
          />
        </td>
        <td>{bet.actualWins ?? '—'}</td>
        <td>{bet.result}</td>
        <td>
          <button onClick={handleSaveDetails} disabled={!canSaveDetails || savingDetails}>
            {savingDetails ? 'Saving…' : 'Save'}
          </button>{' '}
          <button onClick={handleCancelDetails} disabled={savingDetails}>
            Cancel
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{userName}</td>
      <td>
        {bet.team} {bet.line} ({bet.side})
      </td>
      <td>${bet.stake}</td>
      <td>
        <input
          type="number"
          value={actualWinsInput}
          onChange={(e) => setActualWinsInput(e.target.value)}
          min={0}
          style={{ width: 60 }}
        />{' '}
        <button onClick={handleSaveActualWins} disabled={actualWinsInput === '' || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </td>
      <td>{bet.result}</td>
      <td>
        <button onClick={() => setEditingDetails(true)}>Edit</button>
      </td>
    </tr>
  )
}
