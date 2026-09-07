import type { User } from '../../types'

interface UserSelectProps {
  users: User[]
  onSelect: (userId: string) => void
}

export function UserSelect({ users, onSelect }: UserSelectProps) {
  return (
    <div>
      <h2>Who are you?</h2>
      <select defaultValue="" onChange={(e) => e.target.value && onSelect(e.target.value)}>
        <option value="" disabled>
          — Select your name —
        </option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name}
          </option>
        ))}
      </select>
    </div>
  )
}
