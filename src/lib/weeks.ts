import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'
import type { Week } from '../types'

const weeksCollection = collection(db, 'weeks')

export function listenWeeks(callback: (weeks: Week[]) => void): () => void {
  // Weeks don't have a natural sortable field (labels like "Week 1" vs.
  // "Wild Card" don't sort chronologically as strings, and Firestore's
  // auto-generated document IDs are random, NOT creation-ordered — sorting
  // by `__name__` would give an arbitrary order). `order` is a plain
  // incrementing number we set ourselves when a week is created
  // (see addWeek below), purely so this dropdown lists weeks in the order
  // they were added.
  const q = query(weeksCollection, orderBy('order'))
  return onSnapshot(q, (snapshot) => {
    const weeks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Week, 'id' | 'order'>),
    }))
    callback(weeks)
  })
}

export async function addWeek(
  week: Omit<Week, 'id'>,
  order: number,
): Promise<string> {
  const docRef = await addDoc(weeksCollection, { ...week, order })
  return docRef.id
}

// Admin-only action (2026-09-08): designates which WildCardPool game is
// this week's "Highest Spread" pick, replacing the old auto-computed
// version. updateDoc only sends this one field, but Firestore security
// rules validate the FULL resulting document after the merge — so this
// doesn't need to (and per firestore.rules' own hasAll-not-hasOnly
// tradeoff, must not) resend label/type/budget/order.
export async function setHighSpreadGame(weekId: string, gameId: string | null): Promise<void> {
  await updateDoc(doc(weeksCollection, weekId), { highSpreadGameId: gameId })
}
