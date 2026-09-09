import { useUsers } from '../../hooks/useUsers'
import type { PropDefinition, SuperBowlProp } from '../../types'
import { ResultStamp } from './ResultStamp'

interface RevealedPropsProps {
  propDefs: PropDefinition[]
  allProps: SuperBowlProp[]
  // A single shared boolean (not per-prop like RevealedPicks' per-game
  // reveal) since every prop in a week locks/reveals together, tied to the
  // same game(s) kicking off — see WeekPicks.tsx for how this is derived.
  locked: boolean
}

// PROJECT_SPEC.md Section 4.6's per-game visibility rule, applied to props:
// hide everyone's prop picks until the tied-to game has kicked off. Mirrors
// RevealedPicks' structure (one table per "thing being picked"), just
// keyed by prop definition instead of by game.
export function RevealedProps({ propDefs, allProps, locked }: RevealedPropsProps) {
  const users = useUsers()
  const userName = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId

  if (propDefs.length === 0) return null

  if (!locked) {
    return <p>Prop picks stay hidden until this week's game(s) kick off.</p>
  }

  return (
    <div>
      <h2>Revealed Props</h2>
      {propDefs.map((def) => {
        const picksForProp = allProps.filter((p) => p.propDefinitionId === def.id)
        return (
          <div key={def.id} style={{ marginBottom: 16 }}>
            <strong>{def.description}</strong>
            {picksForProp.length === 0 ? (
              <p>No one picked this prop.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pick</th>
                      <th>Stake</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picksForProp.map((prop) => (
                      <tr key={prop.id}>
                        <td>{userName(prop.userId)}</td>
                        <td>{prop.pick}</td>
                        <td>${prop.stake}</td>
                        <td>
                          <ResultStamp result={prop.result} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
