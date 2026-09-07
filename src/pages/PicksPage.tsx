import { useEffect, useState } from 'react'
import { UserSelect } from '../components/picks/UserSelect'
import { WeekPicks } from '../components/picks/WeekPicks'
import { useCurrentUserId } from '../hooks/useCurrentUser'
import { useUsers } from '../hooks/useUsers'
import { useWeeks } from '../hooks/useWeeks'

export function PicksPage() {
  const users = useUsers()
  const [currentUserId, setCurrentUserId] = useCurrentUserId()
  const currentUser = users.find((u) => u.id === currentUserId)

  const weeks = useWeeks()
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null)

  // Default to the most recently added week (highest `order`) once weeks
  // have loaded, but only if the user hasn't already picked a different
  // one from the dropdown below.
  useEffect(() => {
    if (selectedWeekId || weeks.length === 0) return
    const mostRecent = weeks[weeks.length - 1]
    setSelectedWeekId(mostRecent.id)
  }, [weeks, selectedWeekId])

  const selectedWeek = weeks.find((w) => w.id === selectedWeekId)

  if (!currentUser) {
    return (
      <div>
        <h1>Weekly Picks</h1>
        <UserSelect users={users} onSelect={setCurrentUserId} />
      </div>
    )
  }

  return (
    <div>
      <h1>Weekly Picks</h1>
      <p>
        Picking as <strong>{currentUser.name}</strong>{' '}
        <button onClick={() => setCurrentUserId(null)}>(not you?)</button>
      </p>

      <label>
        Week{' '}
        <select
          value={selectedWeekId ?? ''}
          onChange={(e) => setSelectedWeekId(e.target.value || null)}
        >
          <option value="">— Select a week —</option>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.label}
            </option>
          ))}
        </select>
      </label>

      {selectedWeek && <WeekPicks week={selectedWeek} userId={currentUser.id} />}
    </div>
  )
}
