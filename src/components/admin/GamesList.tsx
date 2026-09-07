import type { Game } from '../../types'

interface GamesListProps {
  games: Game[]
}

export function GamesList({ games }: GamesListProps) {
  if (games.length === 0) {
    return <p>No games added yet for this week.</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Slot</th>
          <th>Matchup</th>
          <th>Kickoff</th>
          <th>Spread</th>
          <th>Total</th>
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
          </tr>
        ))}
      </tbody>
    </table>
  )
}
