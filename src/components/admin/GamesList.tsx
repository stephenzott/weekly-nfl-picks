import type { Game } from '../../types'

interface GamesListProps {
  games: Game[]
  onEdit: (gameId: string) => void
}

export function GamesList({ games, onEdit }: GamesListProps) {
  if (games.length === 0) {
    return <p>No games added yet for this week.</p>
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Slot</th>
            <th>Matchup</th>
            <th>Kickoff</th>
            <th>Spread</th>
            <th>Total</th>
            <th>Score</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {games.map((game) => (
            <tr key={game.id}>
              <td>{game.slot}</td>
              <td>
                {game.awayTeam} @ {game.homeTeam}
              </td>
              {/* Firestore Timestamps have a .toDate() method that converts
                  to a plain JS Date, which toLocaleString() then formats
                  using the viewer's own local timezone. */}
              <td>{game.kickoffTime.toDate().toLocaleString()}</td>
              <td>
                {game.spread
                  ? `${game.spread.favoredTeam} -${game.spread.line}`
                  : '—'}
              </td>
              <td>{game.total ?? '—'}</td>
              <td>
                {game.finalScore
                  ? `${game.awayTeam} ${game.finalScore.away} - ${game.finalScore.home} ${game.homeTeam}`
                  : '—'}
              </td>
              <td>{game.status}</td>
              <td>
                <button onClick={() => onEdit(game.id)}>Edit</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
