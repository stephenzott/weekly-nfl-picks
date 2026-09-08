// PROJECT_SPEC.md Section 4.3: "$10 minimum bet per pick." The same number
// is reused for the missed-pick default-loss stake (src/lib/missedPicks.ts)
// — that's a coincidence of the spec's numbers, not a coupling, but sharing
// one constant avoids two "10"s in the codebase drifting apart if either
// rule ever changes.
export const MIN_STAKE = 10
