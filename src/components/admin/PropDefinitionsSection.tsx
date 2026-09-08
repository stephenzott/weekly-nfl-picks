import { useState } from 'react'
import { usePropDefinitionsForWeek } from '../../hooks/usePropDefinitionsForWeek'
import { addPropDefinition } from '../../lib/propDefinitions'

interface PropDefinitionsSectionProps {
  weekId: string
}

// PROJECT_SPEC.md Section 4.5: Super Bowl props are flexible — the admin
// defines whatever props are of interest that year (coin toss, player
// props, etc.) rather than the app hardcoding specific categories. This
// form is deliberately generic (free-text propType/description, optional
// line) for that reason. Each user's actual pick against a definition is
// task #10 (not built yet) — this only creates the shared definition.
export function PropDefinitionsSection({ weekId }: PropDefinitionsSectionProps) {
  const defs = usePropDefinitionsForWeek(weekId)

  const [propType, setPropType] = useState('')
  const [description, setDescription] = useState('')
  const [line, setLine] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = propType.trim() && description.trim()

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
      })
      setPropType('')
      setDescription('')
      setLine('')
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
          Line (optional){' '}
          <input
            type="number"
            value={line}
            onChange={(e) => setLine(e.target.value)}
            placeholder="e.g. 250.5"
            step={0.5}
          />
        </label>{' '}
        <button type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Adding…' : 'Add Prop'}
        </button>
      </form>

      {defs.length === 0 ? (
        <p>No props added yet for this week.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Description</th>
              <th>Line</th>
            </tr>
          </thead>
          <tbody>
            {defs.map((def) => (
              <tr key={def.id}>
                <td>{def.propType}</td>
                <td>{def.description}</td>
                <td>{def.line ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
