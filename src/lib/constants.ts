// PROJECT_SPEC.md Section 4.3: "$10 minimum bet per pick." The same number
// is reused for the missed-pick default-loss stake (src/lib/missedPicks.ts)
// — that's a coincidence of the spec's numbers, not a coupling, but sharing
// one constant avoids two "10"s in the codebase drifting apart if either
// rule ever changes.
export const MIN_STAKE = 10

// PROJECT_SPEC.md Section 4.4, changed during build (Stephen, 2026-09-08):
// each user's 4 required Season Win Total bets now split a $100 total
// (freely allocated, like the weekly picks budget) instead of a flat $20
// each — see src/components/admin/SeasonWinTotalsSection.tsx.
export const SEASON_WIN_TOTAL_BUDGET = 100
export const SEASON_WIN_TOTAL_REQUIRED_BETS = 4
