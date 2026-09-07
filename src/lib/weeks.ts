import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
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
