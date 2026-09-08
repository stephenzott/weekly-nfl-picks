import { addDoc, collection, onSnapshot, query } from 'firebase/firestore'
import { db } from './firebase'
import type { SeasonWinTotal } from '../types'

// Unlike weeks/games/picks, season win totals aren't scoped to a
// particular week — PROJECT_SPEC.md Section 4.4 is explicit that this is
// "a separate, one-time-per-season feature, tracked independently from the
// weekly $120 pick budget." So there's just one collection, and one
// subscription to the whole season's worth of bets (20 total: 5 users x 4
// bets each — tiny, no need to filter/paginate).
const seasonWinTotalsCollection = collection(db, 'seasonWinTotals')

export function listenSeasonWinTotals(
  callback: (bets: SeasonWinTotal[]) => void,
): () => void {
  const q = query(seasonWinTotalsCollection)
  return onSnapshot(q, (snapshot) => {
    const bets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<SeasonWinTotal, 'id'>),
    }))
    callback(bets)
  })
}

export async function addSeasonWinTotal(bet: Omit<SeasonWinTotal, 'id'>): Promise<string> {
  const docRef = await addDoc(seasonWinTotalsCollection, bet)
  return docRef.id
}
