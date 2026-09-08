import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
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

// Subscribes to every game across every week (no filter) — used by the
// standings page (src/pages/StandingsPage.tsx), which needs to settle
// picks from ANY week whenever anyone views it (see the comment on
// listenAllPicks in src/lib/picks.ts for the same "whole collection is
// still tiny" reasoning).
export function listenAllGames(callback: (games: Game[]) => void): () => void {
  return onSnapshot(gamesCollection, (snapshot) => {
    const games = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Game, 'id'>),
    }))
    callback(games)
  })
}

export async function addGame(game: Omit<Game, 'id'>): Promise<string> {
  const docRef = await addDoc(gamesCollection, game)
  return docRef.id
}

// Partial update — used for both correcting a game's details (kickoff,
// teams, spread, total) and for recording a final score. `lineSource` is
// deliberately part of the updatable fields (not just set once at
// creation): PROJECT_SPEC.md Section 4.7 has the admin's "Fetch Odds"
// button and manual edits both writing to the same spread/total fields, so
// whichever one touched them last should be reflected here for
// transparency/debugging, per the spec's own reasoning for the field.
export async function updateGame(gameId: string, updates: Partial<Omit<Game, 'id'>>): Promise<void> {
  await updateDoc(doc(db, 'games', gameId), updates)
}
