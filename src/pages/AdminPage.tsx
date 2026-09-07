import { useState } from 'react'
import { AddGameForm } from '../components/admin/AddGameForm'
import { AddWeekForm } from '../components/admin/AddWeekForm'
import { GamesList } from '../components/admin/GamesList'
import { useGamesForWeek } from '../hooks/useGamesForWeek'
import { useWeeks } from '../hooks/useWeeks'

export function AdminPage() {
  const weeks = useWeeks()
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null)
  const games = useGamesForWeek(selectedWeekId)

  return (
    <div>
      <h1>Admin</h1>

      <AddWeekForm onCreated={setSelectedWeekId} nextOrder={weeks.length} />

      <hr />

      <h2>Manage a Week's Games</h2>
      <label>
        Week{' '}
        <select
          value={selectedWeekId ?? ''}
          onChange={(e) => setSelectedWeekId(e.target.value || null)}
        >
          <option value="">— Select a week —</option>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.label} ({week.type})
            </option>
          ))}
        </select>
      </label>

      {selectedWeekId && (
        <>
          <AddGameForm weekId={selectedWeekId} />
          <GamesList games={games} />
        </>
      )}
    </div>
  )
}
