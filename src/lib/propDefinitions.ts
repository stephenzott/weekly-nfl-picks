import { addDoc, collection, onSnapshot, query, where } from 'firebase/firestore'
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

export async function addPropDefinition(def: Omit<PropDefinition, 'id'>): Promise<string> {
  const docRef = await addDoc(propDefinitionsCollection, def)
  return docRef.id
}
