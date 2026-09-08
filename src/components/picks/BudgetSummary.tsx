import type { Pick, SuperBowlProp } from '../../types'

interface BudgetSummaryProps {
  budget: number
  myPicks: Pick[]
  // PROJECT_SPEC.md Section 4.5: props draw from the SAME $120 pool as
  // game picks, not a separate budget — optional since most weeks have no
  // props at all.
  myProps?: SuperBowlProp[]
}

export function BudgetSummary({ budget, myPicks, myProps = [] }: BudgetSummaryProps) {
  // Only spreadStake counts against the weekly budget — the mirrored total
  // stake is tracked separately and doesn't consume it (PROJECT_SPEC.md
  // Section 4.3).
  const used =
    myPicks.reduce((sum, pick) => sum + pick.spreadStake, 0) +
    myProps.reduce((sum, prop) => sum + prop.stake, 0)
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
