import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Game } from '../types'

const gamesCollection = collection(db, 'games')

export function listenGamesForWeek(
  weekId: string,
  callback: (games: Game[]) => void,
): () => void {
  // Filtering by weekId (equality on one field) is covered by Firestore's
  // automatic single-field indexes. Combining that with `orderBy` on a
  // *different* field (kickoffTime) would require manually creating a
  // composite index in the Firebase console before the query could run at
  // all. A week only ever has a handful of games, so it's simpler to fetch
  // unsorted and sort by kickoff time here in JS instead.
  const q = query(gamesCollection, where('weekId', '==', weekId))
  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Game, 'id'>),
    }))
    games.sort((a, b) => a.kickoffTime.toMillis() - b.kickoffTime.toMillis())
    callback(games)
  })
}

export async function addGame(game: Omit<Game, 'id'>): Promise<string> {
  const docRef = await addDoc(gamesCollection, game)
  return docRef.id
}
