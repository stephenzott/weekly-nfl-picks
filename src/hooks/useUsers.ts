import { useEffect, useState } from 'react'
import { listenUsers } from '../lib/users'
import type { User } from '../types'

export function useUsers(): User[] {
  const [users, setUsers] = useState<User[]>([])

  useEffect(() => {
    const unsubscribe = listenUsers(setUsers)
    return unsubscribe
  }, [])

  return users
}
