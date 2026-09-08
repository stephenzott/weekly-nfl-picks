import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import type { PropDefinition } from '../types'

const propDefinitionsCollection = collection(db, 'propDefinitions')

export function listenPropDefinitionsForWeek(
  weekId: string,
  callback: (defs: PropDefinition[]) => void,
): () => void {
  const q = query(propDefinitionsCollection, where('weekId', '==', weekId))
  return onSnapshot(q, (snapshot) => {
    const defs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PropDefinition, 'id'>),
    }))
    callback(defs)
  })
}

// Whole-collection subscription — used by the standings page, which needs
// to self-heal prop settlement across EVERY week's props, not just
// whichever week is currently selected on the Picks tab (same reasoning as
// listenAllGames/listenAllPicks).
export function listenAllPropDefinitions(callback: (defs: PropDefinition[]) => void): () => void {
  return onSnapshot(propDefinitionsCollection, (snapshot) => {
    const defs = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<PropDefinition, 'id'>),
    }))
    callback(defs)
  })
}

export async function addPropDefinition(def: Omit<PropDefinition, 'id'>): Promise<string> {
  const docRef = await addDoc(propDefinitionsCollection, def)
  return docRef.id
}

// Records the real-world outcome an admin enters after the fact — exactly
// one of `actualValue`/`correctChoice` depending on whether this
// definition uses `line` or `choices` (see the type's own comments). This
// is what settleWeekProps (src/lib/settleWeek.ts) reads to auto-settle
// every user's pick against this definition.
export async function updatePropDefinitionSettlement(
  defId: string,
  updates: { actualValue?: number; correctChoice?: string },
): Promise<void> {
  await updateDoc(doc(db, 'propDefinitions', defId), updates)
}
