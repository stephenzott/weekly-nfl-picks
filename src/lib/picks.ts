import { collection, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore'
import { db } from './firebase'
import type { Pick, PickResult } from '../types'

const picksCollection = collection(db, 'picks')

// Most pick types are "singleton" slots — a user gets exactly ONE AM pick,
// ONE HighSpread pick, etc. per week, no matter which specific game they
// choose for it (AM/PM/WildCard let the user pick among several candidate
// games; SNF/MNF/HighSpread only ever have one possible game). Only Bonus
// (and, later, Playoff) genuinely repeat: an admin can add several bonus
// games in one week, and each is its own separate required pick.
//
// This distinction matters for how we compute a pick's document ID. We
// deliberately compute IDs ourselves (instead of letting Firestore assign
// random ones via addDoc) so that saving a pick is idempotent — writing to
// the same ID again overwrites in place instead of creating a duplicate.
// For singleton slots the ID must NOT include gameId: if it did, changing
// your mind about which AM game to pick would produce a second document
// (the old game's pick) that Firestore never cleans up, silently
// double-counting against the $120 budget.
const REPEATABLE_PICK_TYPES: Pick['pickType'][] = ['Bonus', 'Playoff']

function pickDocId(pick: Pick | Omit<Pick, 'id'>): string {
  const isRepeatable = REPEATABLE_PICK_TYPES.includes(pick.pickType)
  return isRepeatable
    ? `${pick.userId}_${pick.weekId}_${pick.pickType}_${pick.gameId}`
    : `${pick.userId}_${pick.weekId}_${pick.pickType}`
}

// Subscribes to every pick for a given week (any user). We filter by weekId
// only (a single equality filter, covered by Firestore's automatic
// single-field indexes) rather than also filtering by userId, because
// combining two equality filters in one query would require manually
// creating a composite index first (see the same tradeoff in
// src/lib/games.ts). A week's worth of picks across 5 users is tiny, so
// filtering down to "just this user's picks" client-side (see
// useMyPicksForWeek) is cheap and simpler to reason about. This also means
// the same subscription can later serve the "reveal other users' picks
// after kickoff" feature (PROJECT_SPEC.md Section 4.6) without a second
// Firestore query.
export function listenPicksForWeek(
  weekId: string,
  callback: (picks: Pick[]) => void,
): () => void {
  const q = query(picksCollection, where('weekId', '==', weekId))
  return onSnapshot(q, (snapshot) => {
    const picks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Pick, 'id'>),
    }))
    callback(picks)
  })
}

// Subscribes to EVERY pick across every week (no filter) — used by the
// standings page (src/lib/standings.ts), which needs to sum profit/loss
// across the whole season, not just one week at a time. A whole season's
// worth of picks across 5 users is still a tiny amount of data (a few
// hundred documents at most), so fetching all of them client-side and
// grouping by week in JS is simpler than trying to run a separate query per
// week.
export function listenAllPicks(callback: (picks: Pick[]) => void): () => void {
  return onSnapshot(picksCollection, (snapshot) => {
    const picks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Pick, 'id'>),
    }))
    callback(picks)
  })
}

export async function savePick(pick: Omit<Pick, 'id'>): Promise<void> {
  const id = pickDocId(pick)
  // `setDoc` with `merge: true` creates the document if it doesn't exist yet,
  // or overwrites just these fields if it does — this is what makes
  // "save" double as both "create my pick" and "edit my pick" with one
  // function, since we always know the exact document ID to write to.
  await setDoc(doc(db, 'picks', id), pick, { merge: true })
}

// Used by the settlement engine (src/lib/settleWeek.ts) to write a
// computed win/loss/push back onto an existing pick, without touching any
// of its other fields.
export async function updatePickResult(
  pickId: string,
  result: PickResult,
  totalResult: PickResult | null,
): Promise<void> {
  await updateDoc(doc(db, 'picks', pickId), { result, totalResult })
}
