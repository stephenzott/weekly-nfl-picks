import { useState } from 'react'
import { usePropDefinitionsForWeek } from '../../hooks/usePropDefinitionsForWeek'
import { addPropDefinition, updatePropDefinitionSettlement } from '../../lib/propDefinitions'
import type { PropDefinition } from '../../types'

interface PropDefinitionsSectionProps {
  weekId: string
}

// PROJECT_SPEC.md Section 4.5: Super Bowl props are flexible — the admin
// defines whatever props are of interest that year (coin toss, player
// props, etc.) rather than the app hardcoding specific categories. This
// form is deliberately generic (free-text propType/description, optional
// line) for that reason.
//
// Per Stephen (2026-09-08): a prop needs EITHER a line (an Over/Under
// stat prop) OR a fixed list of choices (e.g. "Heads,Tails" for a coin
// toss) — not free text for the pick itself, so answers stay consistent
// enough to settle automatically. Choices are entered here as a simple
// comma-separated list rather than a repeatable list of inputs, matching
// the same "keep the admin form lightweight" spirit as the rest of Admin.
export function PropDefinitionsSection({ weekId }: PropDefinitionsSectionProps) {
  const defs = usePropDefinitionsForWeek(weekId)

  const [propType, setPropType] = useState('')
  const [description, setDescription] = useState('')
  const [line, setLine] = useState('')
  const [choicesInput, setChoicesInput] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const choices = choicesInput
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0)

  // Every prop needs a settleable shape: either a line (Over/Under) or at
  // least 2 named choices — never both, never neither.
  const canSubmit =
    propType.trim() && description.trim() && (line !== '' ? choices.length === 0 : choices.length >= 2)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await addPropDefinition({
        weekId,
        propType: propType.trim(),
        description: description.trim(),
        line: line ? Number(line) : null,
        choices: line ? null : choices,
        actualValue: null,
        correctChoice: null,
      })
      setPropType('')
      setDescription('')
      setLine('')
      setChoicesInput('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h2>Super Bowl Props</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Prop type{' '}
          <input
            type="text"
            value={propType}
            onChange={(e) => setPropType(e.target.value)}
            placeholder="e.g. coinToss, passingYards"
          />
        </label>{' '}
        <label>
          Description{' '}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Sam Darnold Passing Yards"
          />
        </label>{' '}
        <label>
          Line (for an Over/Under prop){' '}
          <input
            type="number"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="e.g. 250.5"
            step={0.5}
            disabled={choices.length > 0}
          />
        </label>{' '}
        <label>
          Choices (for a pick-one prop, comma-separated){' '}
          <input
            type="text"
            value={choicesInput}
            onChange={(e) => setChoicesInput(e.target.value)}
            placeholder="e.g. Heads, Tails"
            disabled={line !== ''}
          />
        </label>{' '}
        <button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Adding…' : 'Add Prop'}
        </button>
        {!canSubmit && (propType.trim() || description.trim() || line || choicesInput) && (
          <p style={{ color: 'red' }}>Enter either a line, or at least 2 comma-separated choices — not both.</p>
        )}
      </form>

      {defs.length === 0 ? (
        <p>No props added yet for this week.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Line / Choices</th>
              <th>Settle</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => (
              <PropDefinitionRow key={def.id} def={def} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// Split out for its own local input state, same reasoning as
// SeasonWinTotalRow in SeasonWinTotalsSection.tsx.
function PropDefinitionRow({ def }: { def: PropDefinition }) {
  const [actualValueInput, setActualValueInput] = useState(
    def.actualValue != null ? String(def.actualValue) : '',
  )
  const [correctChoice, setCorrectChoice] = useState(def.correctChoice ?? '')
  const [saving, setSaving] = useState(false)

  async function handleSaveActualValue() {
    if (actualValueInput === '') return
    setSaving(true)
    try {
      await updatePropDefinitionSettlement(def.id, { actualValue: Number(actualValueInput) })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveCorrectChoice() {
    if (!correctChoice) return
    setSaving(true)
    try {
      await updatePropDefinitionSettlement(def.id, { correctChoice })
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td>{def.propType}</td>
      <td>{def.description}</td>
      <td>{def.line ?? def.choices?.join(' / ') ?? '—'}</td>
      <td>
        {def.line != null ? (
          <>
            <input
              type="number"
              value={actualValueInput}
              onChange={(e) => setActualValueInput(e.target.value)}
              placeholder="actual value"
              style={{ width: 80 }}
            />{' '}
            <button onClick={handleSaveActualValue} disabled={actualValueInput === '' || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {def.actualValue != null && <span> (settled: {def.actualValue})</span>}
          </>
        ) : (
          <>
            <select value={correctChoice} onChange={(e) => setCorrectChoice(e.target.value)}>
              <option value="">— correct answer —</option>
              {def.choices?.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>{' '}
            <button onClick={handleSaveCorrectChoice} disabled={!correctChoice || saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            {def.correctChoice != null && <span> (settled: {def.correctChoice})</span>}
          </>
        )}
      </td>
    </tr>
  )
}
