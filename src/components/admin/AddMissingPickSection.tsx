import { useState } from 'react'
import { useUsers } from '../../hooks/useUsers'
import { MIN_STAKE } from '../../lib/constants'
import { savePick } from '../../lib/picks'
import { getSpreadOptions } from '../../lib/spreadOptions'
import { computeSlotsForPlayoffWeek, computeSlotsForRegularWeek, findExistingPick, type Slot } from '../../lib/slots'
import type { Game, Pick, TotalSide, Week } from '../../types'

interface AddMissingPickSectionProps {
  week: Week
  games: Game[]
  picksInWeek: Pick[]
}

// Covers the case PickSlot.tsx/EditPicksSection.tsx can't: a user never
// saved a pick at all before kickoff. Once that happens, PickSlot's
// "locked (kickoff passed)" state blocks the normal form, and — if anyone
// has opened the app since — backfillMissedPicksForWeek (src/lib/
// missedPicks.ts) has already written a coin-flipped auto-pick for that
// exact slot. Either way (no doc yet, or an auto-pick already there),
// `savePick` writes to the SAME deterministic document ID
// (userId_weekId_pickType, see src/lib/picks.ts), so using it here both
// creates the pick if it's missing and overwrites the auto-pick if one
// already exists — no need to tell those two cases apart first.
export function AddMissingPickSection({ week, games, picksInWeek }: AddMissingPickSectionProps) {
  const users = useUsers()

  const slots: Slot[] =
    week.type === 'playoff'
      ? computeSlotsForPlayoffWeek(games)
      : computeSlotsForRegularWeek(games, week.highSpreadGameId)

  const [userId, setUserId] = useState('')
  const [slotIndex, setSlotIndex] = useState('')
  const [candidateGameId, setCandidateGameId] = useState('')
  const [spreadSide, setSpreadSide] = useState('')
  const [stake, setStake] = useState(String(MIN_STAKE))
  const [totalSide, setTotalSide] = useState<TotalSide | ''>('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)

  const selectedSlot = slotIndex === '' ? null : slots[Number(slotIndex)]

  // poolChoice (WildCard) slots offer several candidate games — the admin
  // picks which one this pick is actually against, same choice a user
  // would normally make themselves. fixedGame slots have only the one
  // game, so there's nothing to choose.
  const game: Game | undefined =
    selectedSlot?.kind === 'fixedGame'
      ? selectedSlot.game
      : selectedSlot?.kind === 'poolChoice'
        ? selectedSlot.candidates.find((g) => g.id === candidateGameId)
        : undefined

  const spreadOptions = game ? getSpreadOptions(game) : null
  const totalAvailable = game?.total != null

  const myPicks = picksInWeek.filter((p) => p.userId === userId)
  const existingForSlot = selectedSlot ? findExistingPick(myPicks, selectedSlot) : undefined

  function handleSlotChange(newIndex: string) {
    setSlotIndex(newIndex)
    setCandidateGameId('')
    setSpreadSide('')
    setTotalSide('')
    setStake(String(MIN_STAKE))
    setStatus(null)
  }

  // Pre-fills from whatever's already saved for this slot (a real pick or
  // a coin-flip auto-pick) once enough is selected to know which pick that
  // is — lets the admin see/adjust rather than starting blank every time,
  // and makes "override the coin flip" and "add a pick that was never
  // saved" look like the exact same action.
  function loadExisting() {
    if (!existingForSlot) return
    if (existingForSlot.spreadSide) setSpreadSide(existingForSlot.spreadSide)
    setStake(String(existingForSlot.spreadStake))
    setTotalSide(existingForSlot.totalSide ?? '')
  }

  const canSave = userId && game && spreadSide !== '' && Number(stake) >= MIN_STAKE

  async function handleSave() {
    if (!canSave || !selectedSlot || !game) return
    setSaving(true)
    setStatus(null)
    try {
      await savePick({
        userId,
        gameId: game.id,
        weekId: week.id,
        pickType: selectedSlot.pickType,
        spreadSide,
        spreadStake: Number(stake),
        totalSide: totalSide === '' ? null : totalSide,
        totalStake: totalSide === '' ? null : Number(stake),
        // 'pending' regardless of whether the game's already final — this
        // mirrors PickSlot's own save call, and the self-healing
        // settlement pass (settleWeekPicks, run next time anyone views
        // Week Picks/Standings, or the scheduled score-update Action)
        // fills in the real result from here.
        result: 'pending',
        totalResult: totalSide === '' ? null : 'pending',
        isAutoPick: false,
      })
      setStatus(`Saved ${selectedSlot.label} for ${users.find((u) => u.id === userId)?.name ?? userId}.`)
      setSpreadSide('')
      setStake(String(MIN_STAKE))
      setTotalSide('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3>Add a Missing Pick</h3>
      <p>
        For a pick that was never saved before kickoff (including one already backfilled as a
        coin-flip auto-pick) — lets you fill in what the user actually meant to pick instead.
      </p>
      <div>
        <label>
          Player{' '}
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">— Select —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Slot{' '}
          <select value={slotIndex} onChange={(e) => handleSlotChange(e.target.value)}>
            <option value="">— Select —</option>
            {slots.map((slot, i) => (
              <option key={i} value={i}>
                {slot.label}
              </option>
            ))}
          </select>
        </label>{' '}
        {selectedSlot?.kind === 'poolChoice' && (
          <label>
            Game{' '}
            <select value={candidateGameId} onChange={(e) => setCandidateGameId(e.target.value)}>
              <option value="">— Select —</option>
              {selectedSlot.candidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.awayTeam} @ {g.homeTeam}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {userId && selectedSlot && game && (
        <div>
          {existingForSlot && (
            <p>
              {existingForSlot.isAutoPick ? 'Currently a coin-flip auto-pick.' : 'Already has a real pick saved.'}{' '}
              <button type="button" onClick={loadExisting}>
                Load it to edit
              </button>
            </p>
          )}
          <label>
            Spread pick{' '}
            {spreadOptions ? (
              <select value={spreadSide} onChange={(e) => setSpreadSide(e.target.value)}>
                <option value="">— Select —</option>
                {spreadOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.value}
                  </option>
                ))}
              </select>
            ) : (
              <em>No spread set on this game yet.</em>
            )}
          </label>{' '}
          <label>
            Stake ($){' '}
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min={MIN_STAKE}
              step={1}
              style={{ width: 70 }}
            />
          </label>{' '}
          <label>
            Total pick{' '}
            <select
              value={totalSide}
              onChange={(e) => setTotalSide(e.target.value as TotalSide | '')}
              disabled={!totalAvailable}
            >
              <option value="">— none —</option>
              <option value="over">Over</option>
              <option value="under">Under</option>
            </select>
          </label>{' '}
          <button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save Pick'}
          </button>
        </div>
      )}
      {status && <p>{status}</p>}
    </div>
  )
}
