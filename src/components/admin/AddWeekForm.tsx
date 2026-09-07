import { useState } from 'react'
import { addWeek } from '../../lib/weeks'
import type { WeekType } from '../../types'

interface AddWeekFormProps {
  // Called with the new week's ID after it's created, so the parent page
  // can e.g. auto-select it. "Props" are how a parent component passes
  // data (including callback functions) down into a child component —
  // standard React practice, not specific to this app.
  onCreated: (weekId: string) => void
  // The `order` value to assign to the next week added (see weeks.ts) —
  // the parent page passes `weeks.length` so weeks stay numbered in the
  // sequence they were created.
  nextOrder: number
}

export function AddWeekForm({ onCreated, nextOrder }: AddWeekFormProps) {
  // Each `useState` call here tracks one form field. React re-renders this
  // component whenever any of these change, keeping the on-screen inputs in
  // sync with the values we're about to submit — this "controlled inputs"
  // pattern (input value comes from state, changes flow back into state) is
  // the standard way to build forms in React.
  const [label, setLabel] = useState('')
  const [type, setType] = useState<WeekType>('regular')
  const [budget, setBudget] = useState(120)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    // Browsers normally reload the page on form submit; this stops that so
    // we can handle the submit ourselves with JavaScript instead.
    e.preventDefault()
    if (!label.trim()) return

    setSubmitting(true)
    try {
      const weekId = await addWeek({ label: label.trim(), type, budget }, nextOrder)
      onCreated(weekId)
      setLabel('')
      setType('regular')
      setBudget(120)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3>Add a Week</h3>
      <div>
        <label>
          Label{' '}
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Week 1, Wild Card, Super Bowl"
            required
          />
        </label>
      </div>
      <div>
        <label>
          Type{' '}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WeekType)}
          >
            <option value="regular">Regular season</option>
            <option value="playoff">Playoff</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Budget ($){' '}
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            min={0}
            step={1}
          />
        </label>
      </div>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Adding…' : 'Add Week'}
      </button>
    </form>
  )
}
