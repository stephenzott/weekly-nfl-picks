import { useState } from 'react'
import { AddGameForm } from '../components/admin/AddGameForm'
import { AddWeekForm } from '../components/admin/AddWeekForm'
import { EditGameForm } from '../components/admin/EditGameForm'
import { FetchOddsButton } from '../components/admin/FetchOddsButton'
import { GamesList } from '../components/admin/GamesList'
import { HighSpreadPicker } from '../components/admin/HighSpreadPicker'
import { HowToAddGames } from '../components/admin/HowToAddGames'
import { ImportWildCardGames } from '../components/admin/ImportWildCardGames'
import { PropDefinitionsSection } from '../components/admin/PropDefinitionsSection'
import { SeasonWinTotalsSection } from '../components/admin/SeasonWinTotalsSection'
import { useGamesForWeek } from '../hooks/useGamesForWeek'
import { usePicksForWeek } from '../hooks/usePicksForWeek'
import { useWeeks } from '../hooks/useWeeks'

export function AdminPage() {
  const weeks = useWeeks()
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null)
  const games = useGamesForWeek(selectedWeekId)
  const picksInWeek = usePicksForWeek(selectedWeekId)
  const [editingGameId, setEditingGameId] = useState<string | null>(null)
  const editingGame = games.find((g) => g.id === editingGameId)
  const selectedWeek = weeks.find((w) => w.id === selectedWeekId)

  return (
    <div className="page">
      <h2>Admin</h2>

      <AddWeekForm onCreated={setSelectedWeekId} nextOrder={weeks.length} />

      <hr />

      <h2>Manage a Week's Games</h2>
      <HowToAddGames />
      <label>
        Week{' '}
        <select
          value={selectedWeekId ?? ''}
          onChange={(e) => {
            setSelectedWeekId(e.target.value || null)
            setEditingGameId(null)
          }}
        >
          <option value="">— Select a week —</option>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.label} ({week.type})
            </option>
          ))}
        </select>
      </label>

      {selectedWeekId && selectedWeek && (
        <>
          <AddGameForm weekId={selectedWeekId} weekType={selectedWeek.type} existingGames={games} />
          {editingGame && (
            // `key` forces a fresh remount (and fresh useState initializers)
            // when switching which game is being edited — without it,
            // React reuses the same EditGameForm instance and its
            // init-once form state, so clicking Edit on a different game
            // would keep showing (and, on save, overwrite the wrong game
            // with) the PREVIOUS game's data. Same failure mode as the key
            // on PickSlot in WeekPicks.tsx, same fix.
            <EditGameForm
              key={editingGame.id}
              game={editingGame}
              weekType={selectedWeek.type}
              onDone={() => setEditingGameId(null)}
            />
          )}
          {selectedWeek.type === 'regular' && (
            <ImportWildCardGames weekId={selectedWeekId} existingGames={games} />
          )}
          <FetchOddsButton games={games} picksInWeek={picksInWeek} />
          {selectedWeek.type === 'regular' && (
            <HighSpreadPicker week={selectedWeek} games={games} picksInWeek={picksInWeek} />
          )}
          <GamesList games={games} onEdit={setEditingGameId} />

          <hr />
          {/* Props are only relevant during Super Bowl week, but there's no
              rigid "this week IS the Super Bowl" flag in the data model —
              any week can have props added, same as any week can have a
              Bonus game (Section 4.1). It's on the admin to only use this
              during the actual Super Bowl week. */}
          <PropDefinitionsSection weekId={selectedWeekId} />
        </>
      )}

      <hr />
      <SeasonWinTotalsSection />
    </div>
  )
}
