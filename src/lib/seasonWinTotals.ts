import { addDoc, collection, doc, onSnapshot, query, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { settleSeasonWinTotal } from './settlement'
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

// PROJECT_SPEC.md Section 4.4: "Settlement happens at the end of the
// season once win totals are final." Unlike game picks, there's no
// self-healing "view this to trigger settlement" moment for season win
// totals — they're not tied to a week or a game's final-score event, just
// a once-a-year manual admin entry. So settlement here is a direct,
// one-shot write: given the team's real final win count, compute the
// result right now and save both fields together, rather than a separate
// background settlement pass.
export async function updateSeasonWinTotalActualWins(
  bet: SeasonWinTotal,
  actualWins: number,
): Promise<void> {
  const result = settleSeasonWinTotal({ ...bet, actualWins })
  await updateDoc(doc(db, 'seasonWinTotals', bet.id), { actualWins, result })
}
