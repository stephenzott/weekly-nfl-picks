// Data-access functions for the `users` collection. Keeping all reads/writes
// for a collection behind small named functions (rather than sprinkling raw
// Firestore calls through components) is standard practice — it gives every
// collection one place to look for its query logic, and makes it easy to
// swap the underlying query later without touching UI code.
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from './firebase'
import type { User } from '../types'

const usersCollection = collection(db, 'users')

// Subscribes to the live list of users, sorted by name. Firestore's
// `onSnapshot` calls `callback` immediately with the current data, then
// again every time the data changes anywhere (any device) — this is what
// gives the app its "real-time sync across everyone's devices" behavior
// from PROJECT_SPEC.md Section 1, with no extra work on our part.
// Returns an "unsubscribe" function; call it (e.g. in a React effect
// cleanup) to stop listening when a component unmounts.
export function listenUsers(callback: (users: User[]) => void): () => void {
  const q = query(usersCollection, orderBy('name'))
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<User, 'id'>),
    }))
    callback(users)
  })
}
