import { useUsers } from '../../hooks/useUsers'
import type { Game, Pick } from '../../types'
import { ResultStamp } from './ResultStamp'

interface RevealedPicksProps {
  games: Game[]
  allPicks: Pick[]
  now: Date
}

// PROJECT_SPEC.md Section 4.6: picks for a game are hidden from everyone
// else until THAT SPECIFIC game's kickoff passes — a per-game reveal, not a
// per-week one. This component is the "everyone's picks" read-only view
// (separate from the "my picks" editing form above it): it walks every game
// in the week in kickoff order and, for each one that has already kicked
// off, lists every pick (any user, any pick type) that references it.
// Games that haven't kicked off yet are skipped entirely — matching the
// spec's "don't query/display" instruction as closely as a single shared
// Firestore subscription reasonably allows (see the comment in
// src/lib/picks.ts on why we fetch the whole week's picks up front rather
// than per-game).
export function RevealedPicks({ games, allPicks, now }: RevealedPicksProps) {
  const users = useUsers()
  const userName = (userId: string) => users.find((u) => u.id === userId)?.name ?? userId

  const revealedGames = games.filter((g) => g.kickoffTime.toDate().getTime() <= now.getTime())

  if (revealedGames.length === 0) {
    return <p>No games have kicked off yet this week — picks stay hidden until then.</p>
  }

  return (
    <div>
      <h2>Revealed Picks</h2>
      {revealedGames.map((game) => {
        const picksForGame = allPicks.filter((p) => p.gameId === game.id)
        return (
          <div key={game.id} style={{ marginBottom: 16 }}>
            <strong>
              {game.awayTeam} @ {game.homeTeam}
            </strong>
            {picksForGame.length === 0 ? (
              <p>No one picked this game.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Pick Type</th>
                      <th>Spread</th>
                      <th>Stake</th>
                      <th>Result</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {picksForGame.map((pick) => (
                      <tr key={pick.id} style={pick.isAutoPick ? { opacity: 0.6 } : undefined}>
                        <td>{userName(pick.userId)}</td>
                        <td>
                          {pick.pickType}
                          {pick.isAutoPick && ' (auto)'}
                        </td>
                        <td>{pick.spreadSide || '—'}</td>
                        <td>${pick.spreadStake}</td>
                        <td>
                          <ResultStamp result={pick.result} />
                        </td>
                        <td>
                          {!pick.totalSide || !pick.totalResult ? (
                            '—'
                          ) : (
                            <>
                              {pick.totalSide} (${pick.totalStake}){' '}
                              <ResultStamp result={pick.totalResult} />
                            </>
                          )}
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
