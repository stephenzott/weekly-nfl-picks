import { useState } from 'react'
import { savePick } from '../../lib/picks'
import { getSpreadOptions } from '../../lib/spreadOptions'
import type { Game, Pick, TotalSide } from '../../types'
import type { Slot } from '../../lib/slots'

interface PickSlotProps {
  slot: Slot
  weekId: string
  userId: string
  // This user's already-saved pick for this slot, if any — used to
  // pre-fill the form so re-opening the app shows what you already picked.
  existingPick: Pick | undefined
  // The week's total budget (almost always $120) and how much of it this
  // user has already committed to OTHER slots — used to enforce the budget
  // as a hard cap (Stephen, 2026-09-07: going over $120 should be blocked,
  // not just warned about).
  budget: number
  otherPicksTotal: number
}

const MIN_STAKE = 10

export function PickSlot({
  slot,
  weekId,
  userId,
  existingPick,
  budget,
  otherPicksTotal,
}: PickSlotProps) {
  // For a "poolChoice" slot (AM/PM/WildCard) the user first has to choose
  // WHICH game they're picking, out of several candidates. For a
  // "fixedGame" slot there's only ever one possible game, so we skip that
  // step entirely.
  const [selectedGameId, setSelectedGameId] = useState(
    () => existingPick?.gameId ?? (slot.kind === 'fixedGame' ? slot.game.id : ''),
  )
  const [spreadSide, setSpreadSide] = useState(() => existingPick?.spreadSide ?? '')
  const [spreadStake, setSpreadStake] = useState(() => existingPick?.spreadStake ?? MIN_STAKE)
  const [totalEnabled, setTotalEnabled] = useState(() => existingPick?.totalSide != null)
  const [totalSide, setTotalSide] = useState<TotalSide>(() => existingPick?.totalSide ?? 'over')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const game: Game | undefined =
    slot.kind === 'fixedGame' ? slot.game : slot.candidates.find((g) => g.id === selectedGameId)

  const spreadOptions = game ? getSpreadOptions(game) : null

  const projectedTotal = otherPicksTotal + spreadStake
  const wouldExceedBudget = projectedTotal > budget

  const canSave = Boolean(
    game && spreadSide && spreadStake >= MIN_STAKE && !wouldExceedBudget,
  )

  async function handleSave() {
    if (!game || !spreadSide) return
    if (spreadStake < MIN_STAKE) {
      // PROJECT_SPEC.md Section 4.3: "$10 minimum bet per pick." This is a
      // second check (the button is already disabled below MIN_STAKE) in
      // case this function is ever called from somewhere that skips that
      // check — defensive, not decorative.
      setError(`Stake must be at least $${MIN_STAKE}.`)
      return
    }
    if (wouldExceedBudget) {
      setError(
        `This would put you at $${projectedTotal} for the week, over the $${budget} budget.`,
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      await savePick({
        userId,
        gameId: game.id,
        weekId,
        spreadSide,
        spreadStake,
        totalSide: totalEnabled ? totalSide : null,
        // The mirrored-total rule (Section 4.3): the total's stake always
        // equals the spread stake, never entered independently.
        totalStake: totalEnabled ? spreadStake : null,
        result: existingPick?.result ?? 'pending',
        isDefaultLoss: false,
        pickType: slot.pickType,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ border: '1px solid #ccc', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <strong>{slot.label}</strong>{' '}
      {existingPick && <span>(saved)</span>}
      {slot.kind === 'poolChoice' && (
        <div>
          <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
            <option value="">— Choose a game —</option>
            {slot.candidates.map((g) => (
              <option key={g.id} value={g.id}>
                {g.awayTeam} @ {g.homeTeam}
              </option>
            ))}
          </select>
        </div>
      )}
      {slot.kind === 'fixedGame' && (
        <div>
          {slot.game.awayTeam} @ {slot.game.homeTeam}
        </div>
      )}

      {game && !spreadOptions && <p>Spread hasn't been set for this game yet.</p>}

      {game && spreadOptions && (
        <div>
          {spreadOptions.map((option) => (
            <label key={option.value} style={{ marginRight: 12 }}>
              <input
                type="radio"
                name={`${slot.pickType}-${game.id}-side`}
                checked={spreadSide === option.value}
                onChange={() => setSpreadSide(option.value)}
              />{' '}
              {option.value}
            </label>
          ))}
          <div>
            <label>
              Stake ($){' '}
              <input
                type="number"
                min={MIN_STAKE}
                step={1}
                value={spreadStake}
                onChange={(e) => setSpreadStake(Number(e.target.value))}
              />
            </label>
            {wouldExceedBudget && (
              <p style={{ color: 'red' }}>
                That would put you at ${projectedTotal} for the week — over the ${budget} budget.
              </p>
            )}
          </div>

          {game.total != null && (
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={totalEnabled}
                  onChange={(e) => setTotalEnabled(e.target.checked)}
                />{' '}
                Also bet the total ({game.total}) — stake mirrors the spread stake (${spreadStake})
              </label>
              {totalEnabled && (
                <div>
                  <label>
                    <input
                      type="radio"
                      name={`${slot.pickType}-${game.id}-total`}
                      checked={totalSide === 'over'}
                      onChange={() => setTotalSide('over')}
                    />{' '}
                    Over
                  </label>{' '}
                  <label>
                    <input
                      type="radio"
                      name={`${slot.pickType}-${game.id}-total`}
                      checked={totalSide === 'under'}
                      onChange={() => setTotalSide('under')}
                    />{' '}
                    Under
                  </label>
                </div>
              )}
            </div>
          )}

          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save Pick'}
          </button>
        </div>
      )}
    </div>
  )
}
