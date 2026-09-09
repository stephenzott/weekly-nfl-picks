import { useState } from 'react'
import { MIN_STAKE } from '../../lib/constants'
import { saveSuperBowlProp } from '../../lib/superBowlProps'
import type { PropDefinition, SuperBowlProp } from '../../types'
import { ResultStamp } from './ResultStamp'

interface PropPickProps {
  def: PropDefinition
  userId: string
  existingProp: SuperBowlProp | undefined
  // Same budget-sharing shape as PickSlot's props (see WeekPicks.tsx for
  // where these combined figures come from) — PROJECT_SPEC.md Section 4.5:
  // props draw from the SAME $120 pool as that week's game pick(s), not a
  // separate budget, so this needs to already account for every OTHER
  // pick AND prop this user has this week, not just other props.
  budget: number
  otherCommittedTotal: number
  reserveForOtherEntries: number
  // Props don't have their own kickoff time — they lock/reveal based on
  // the week's game(s) kicking off (computed once in WeekPicks.tsx and
  // passed down, rather than each PropPick re-deriving it).
  locked: boolean
}

export function PropPick({
  def,
  userId,
  existingProp,
  budget,
  otherCommittedTotal,
  reserveForOtherEntries,
  locked,
}: PropPickProps) {
  const [pick, setPick] = useState(() => existingProp?.pick ?? '')
  const [stake, setStake] = useState(() => existingProp?.stake ?? MIN_STAKE)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const effectiveBudget = budget - reserveForOtherEntries
  const projectedTotal = otherCommittedTotal + stake
  const wouldExceedBudget = projectedTotal > effectiveBudget

  const canSave = Boolean(pick && stake >= MIN_STAKE && !wouldExceedBudget && !locked)

  async function handleSave() {
    if (locked || !pick) return
    if (stake < MIN_STAKE) {
      setError(`Stake must be at least $${MIN_STAKE}.`)
      return
    }
    if (wouldExceedBudget) {
      setError(
        reserveForOtherEntries > 0
          ? `This would leave less than $${MIN_STAKE} for your other unpicked slots/props this week ($${reserveForOtherEntries} needs to stay reserved).`
          : `This would put you at $${projectedTotal} for the week, over the $${budget} budget.`,
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      await saveSuperBowlProp({
        userId,
        propDefinitionId: def.id,
        pick,
        stake,
        result: 'pending',
      })
    } finally {
      setSaving(false)
    }
  }

  const options = def.line != null ? ['Over', 'Under'] : (def.choices ?? [])

  return (
    <div className="ledger-item">
      <div className="ledger-label">
        {def.description}
        {def.line != null && <div className="pick-status">line: {def.line}</div>}
        {existingProp && <div className="pick-status">saved</div>}
        {locked && <div className="pick-status">locked (kickoff passed)</div>}
      </div>
      <div className="ledger-detail">
        <div>
          {options.map((option) => (
            <label key={option} style={{ marginRight: 12 }}>
              <input
                type="radio"
                name={`prop-${def.id}`}
                checked={pick === option}
                onChange={() => setPick(option)}
                disabled={locked}
              />{' '}
              {option}
            </label>
          ))}
        </div>
        {!locked && wouldExceedBudget && (
          <p className="error-text">
            {reserveForOtherEntries > 0
              ? `That would leave less than $${MIN_STAKE} for your other unpicked slots/props this week ($${reserveForOtherEntries} needs to stay reserved).`
              : `That would put you at $${projectedTotal} for the week — over the $${budget} budget.`}
          </p>
        )}
        {error && <p className="error-text">{error}</p>}
        {locked && !existingProp && <p className="meta">No pick was submitted before kickoff.</p>}
        {existingProp && existingProp.result !== 'pending' && (
          <p>
            <ResultStamp result={existingProp.result} />
          </p>
        )}
      </div>
      {!locked && (
        <div className="ledger-control">
          <label>
            $
            <input
              type="number"
              min={MIN_STAKE}
              step={1}
              value={stake}
              onChange={(e) => setStake(Number(e.target.value))}
              disabled={locked}
              style={{ width: '5rem', marginLeft: 4, marginRight: 8 }}
            />
          </label>
          <button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save Pick'}
          </button>
        </div>
      )}
    </div>
  )
}
