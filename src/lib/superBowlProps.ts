import { collection, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { PickResult, SuperBowlProp } from '../types'

const superBowlPropsCollection = collection(db, 'superBowlProps')

// One user can only have ONE pick against a given prop definition — same
// idempotent-save reasoning as picks.ts's pickDocId: deriving the doc ID
// from userId+propDefinitionId means re-submitting (e.g. changing your
// pick before the deadline) overwrites in place instead of creating a
// second, orphaned document.
function propDocId(prop: { userId: string; propDefinitionId: string }): string {
  return `${prop.userId}_${prop.propDefinitionId}`
}

// Subscribes to EVERY prop pick across every prop/week (no filter) — props
// are a tiny once-a-year dataset (a handful of props x 5 users), and a
// SuperBowlProp doesn't carry its own weekId (only its PropDefinition
// does), so filtering by week would require first knowing which
// propDefinitionIds belong to that week anyway. Simpler to fetch
// everything and let callers cross-reference against the propDefinitions
// they already have, same tradeoff as listenAllPicks/listenAllGames.
export function listenSuperBowlProps(callback: (props: SuperBowlProp[]) => void): () => void {
  return onSnapshot(superBowlPropsCollection, (snapshot) => {
    const props = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SuperBowlProp, 'id'>),
    }))
    callback(props)
  })
}

export async function saveSuperBowlProp(prop: Omit<SuperBowlProp, 'id'>): Promise<void> {
  const id = propDocId(prop)
  await setDoc(doc(db, 'superBowlProps', id), prop, { merge: true })
}

// Used by the settlement engine (settleWeekProps in src/lib/settleWeek.ts)
// to write a computed win/loss result back onto an existing prop pick,
// without touching its other fields.
export async function updateSuperBowlPropResult(propId: string, result: PickResult): Promise<void> {
  await updateDoc(doc(db, 'superBowlProps', propId), { result })
}
