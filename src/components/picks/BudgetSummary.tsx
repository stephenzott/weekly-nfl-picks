import type { Pick } from '../../types'

interface BudgetSummaryProps {
  budget: number
  myPicks: Pick[]
}

export function BudgetSummary({ budget, myPicks }: BudgetSummaryProps) {
  // Only spreadStake counts against the weekly budget — the mirrored total
  // stake is tracked separately and doesn't consume it (PROJECT_SPEC.md
  // Section 4.3).
  const used = myPicks.reduce((sum, pick) => sum + pick.spreadStake, 0)
  const remaining = budget - used

  return (
    <div style={{ marginBottom: 16 }}>
      <strong>Budget:</strong> ${used} used of ${budget} (${remaining} remaining)
      {remaining < 0 && (
        <span style={{ color: 'red' }}> — over budget!</span>
      )}
    </div>
  )
}
