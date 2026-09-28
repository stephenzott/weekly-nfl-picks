// Run on a schedule by .github/workflows/backfill-missed-picks.yml so a
// missed pick gets coin-flipped in automatically after its deadline passes,
// instead of requiring someone to open the app's Picks screen for that week
// (src/components/picks/WeekPicks.tsx still does that client-side trigger
// too — see the comment there for why it's kept as a redundant fallback,
// same reasoning as update-scores.mjs keeping EditGameForm's manual button
// after automating score fetches).
//
// This duplicates logic from src/lib/missedPicks.ts and src/lib/slots.ts
// rather than importing them, because this is a plain Node script run
// outside Vite/TypeScript — same reasoning as update-scores.mjs duplicating
// src/lib/settlement.ts and seed-users.mjs duplicating firebaseConfig.
// Keeping the SAME deadline rule as missedPicks.ts is the whole point of
// this script (see slotDeadlineGame below) — if this drifts from that
// file, someone could get force-picked into a WildCardPool game before
// every candidate in the pool has actually kicked off.
import { initializeApp } from 'firebase/app'
import { collection, doc, getDocs, getFirestore, setDoc } from 'firebase/firestore'

// Not a secret — see src/lib/firebase.ts for why (Firestore's real
// security comes from firestore.rules, not from hiding this config).
const firebaseConfig = {
  apiKey: 'AIzaSyCg4J920Na5ADzo25pfMyURsEcYzM1XFp8',
  authDomain: 'gen-lang-client-0026826837.firebaseapp.com',
  databaseURL: 'https://gen-lang-client-0026826837-default-rtdb.firebaseio.com',
  projectId: 'gen-lang-client-0026826837',
  storageBucket: 'gen-lang-client-0026826837.firebasestorage.app',
  messagingSenderId: '814240070558',
  appId: '1:814240070558:web:9f54257de40f34364b748f',
}

const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

const MIN_STAKE = 10 // Ported from src/lib/constants.ts — keep in sync.

// --- Ported from src/lib/slots.ts ---------------------------------------

function computeSlotsForRegularWeek(games, highSpreadGameId) {
  const slots = []

  const amGame = games.find((g) => g.slot === 'AM')
  if (amGame) slots.push({ kind: 'fixedGame', pickType: 'AM', game: amGame })

  const pmGame = games.find((g) => g.slot === 'PM')
  if (pmGame) slots.push({ kind: 'fixedGame', pickType: 'PM', game: pmGame })

  const snfGame = games.find((g) => g.slot === 'SNF')
  if (snfGame) slots.push({ kind: 'fixedGame', pickType: 'SNF', game: snfGame })

  const mnfGame = games.find((g) => g.slot === 'MNF')
  if (mnfGame) slots.push({ kind: 'fixedGame', pickType: 'MNF', game: mnfGame })

  const wildCardPoolGames = games.filter((g) => g.slot === 'WildCardPool')
  const highSpreadGame = wildCardPoolGames.find((g) => g.id === highSpreadGameId) ?? null
  const wildCardGames = wildCardPoolGames.filter((g) => g.id !== highSpreadGame?.id)

  if (wildCardGames.length > 0) {
    slots.push({ kind: 'poolChoice', pickType: 'WildCard', candidates: wildCardGames })
  }

  if (highSpreadGame) {
    slots.push({ kind: 'fixedGame', pickType: 'HighSpread', game: highSpreadGame })
  }

  const bonusGames = games.filter((g) => g.slot === 'Bonus')
  for (const game of bonusGames) {
    slots.push({ kind: 'fixedGame', pickType: 'Bonus', game })
  }

  return slots
}

function computeSlotsForPlayoffWeek(games) {
  return games.map((game) => ({ kind: 'fixedGame', pickType: 'Playoff', game }))
}

function findExistingPick(myPicks, slot) {
  if (
    slot.kind === 'fixedGame' &&
    (slot.pickType === 'Bonus' || slot.pickType === 'HighSpread' || slot.pickType === 'Playoff')
  ) {
    return myPicks.find((p) => p.pickType === slot.pickType && p.gameId === slot.game.id)
  }
  return myPicks.find((p) => p.pickType === slot.pickType)
}

// --- Ported from src/lib/picks.ts (pickDocId) ---------------------------

const REPEATABLE_PICK_TYPES = ['Bonus', 'Playoff', 'HighSpread']

function pickDocId(pick) {
  const isRepeatable = REPEATABLE_PICK_TYPES.includes(pick.pickType)
  return isRepeatable
    ? `${pick.userId}_${pick.weekId}_${pick.pickType}_${pick.gameId}`
    : `${pick.userId}_${pick.weekId}_${pick.pickType}`
}

// --- Ported from src/lib/spreadOptions.ts -------------------------------

function getSpreadOptions(game) {
  if (!game.spread) return null
  const { favoredTeam, line } = game.spread
  const underdog = favoredTeam === game.homeTeam ? game.awayTeam : game.homeTeam
  return [
    { value: `${favoredTeam} -${line}` },
    { value: `${underdog} +${line}` },
  ]
}

// --- Ported from src/lib/gameTiming.ts ----------------------------------

function hasKickedOff(game, now) {
  return game.kickoffTime.toDate().getTime() <= now.getTime()
}

// --- Ported from src/lib/missedPicks.ts ---------------------------------

// The deadline for a poolChoice slot is whichever candidate kicks off
// LAST — a user can still submit a WildCardPool pick as long as ANY
// candidate game remains open, so the slot only truly becomes "missed"
// once every candidate has started. This is the exact rule Stephen asked
// to preserve: it's what stops someone who missed an early-window game
// from being force-picked before a later game in the same pool has even
// kicked off.
function slotDeadlineGame(slot) {
  if (slot.kind === 'fixedGame') return slot.game
  return slot.candidates.reduce((latest, g) =>
    g.kickoffTime.toMillis() > latest.kickoffTime.toMillis() ? g : latest,
  )
}

function coinFlipPick(slot) {
  const game =
    slot.kind === 'fixedGame' ? slot.game : slot.candidates[Math.floor(Math.random() * slot.candidates.length)]
  const options = getSpreadOptions(game)
  if (!options) return null
  const chosen = options[Math.floor(Math.random() * options.length)]
  return { gameId: game.id, spreadSide: chosen.value }
}

async function backfillMissedPicksForWeek(week, games, allPicks, users, now) {
  if (games.length === 0) return 0

  const slots =
    week.type === 'playoff' ? computeSlotsForPlayoffWeek(games) : computeSlotsForRegularWeek(games, week.highSpreadGameId)

  const slotsByDeadline = [...slots].sort(
    (a, b) => slotDeadlineGame(a).kickoffTime.toMillis() - slotDeadlineGame(b).kickoffTime.toMillis(),
  )

  let backfilled = 0

  for (const user of users) {
    const myPicks = allPicks.filter((p) => p.userId === user.id)

    for (const slot of slotsByDeadline) {
      if (findExistingPick(myPicks, slot)) continue

      const deadlineGame = slotDeadlineGame(slot)
      if (!hasKickedOff(deadlineGame, now)) continue

      const flip = coinFlipPick(slot)

      let newPick
      if (flip) {
        const otherSlots = slots.filter((s) => s !== slot)
        const isLastSlot = otherSlots.every((s) => findExistingPick(myPicks, s))
        const otherCommitted = otherSlots.reduce(
          (sum, s) => sum + (findExistingPick(myPicks, s)?.spreadStake ?? 0),
          0,
        )
        const stake = isLastSlot ? week.budget - otherCommitted : MIN_STAKE

        newPick = {
          userId: user.id,
          gameId: flip.gameId,
          weekId: week.id,
          pickType: slot.pickType,
          spreadSide: flip.spreadSide,
          spreadStake: stake,
          totalSide: null,
          totalStake: null,
          result: 'pending',
          totalResult: null,
          isAutoPick: true,
        }
      } else {
        newPick = {
          userId: user.id,
          gameId: deadlineGame.id,
          weekId: week.id,
          pickType: slot.pickType,
          spreadSide: '',
          spreadStake: MIN_STAKE,
          totalSide: null,
          totalStake: null,
          result: 'loss',
          totalResult: null,
          isAutoPick: true,
        }
      }

      const id = pickDocId(newPick)
      await setDoc(doc(db, 'picks', id), newPick, { merge: true })
      myPicks.push({ id, ...newPick })
      backfilled++
      console.log(
        `Backfilled: ${user.name} / ${week.label} / ${slot.pickType} -> ${newPick.spreadSide || '(no spread, default loss)'} for $${newPick.spreadStake}`,
      )
    }
  }

  return backfilled
}

// --- Entry point ----------------------------------------------------------
// Runs for every week, not just whichever one the app currently defaults
// to — same "just recompute everything, it's idempotent" approach as
// update-scores.mjs's settlement step (findExistingPick already skips any
// slot that's already answered, real or previously backfilled, so
// re-checking old weeks on every run is harmless, cheap, and self-healing
// if a run is ever missed).

const [weeksSnapshot, gamesSnapshot, picksSnapshot, usersSnapshot] = await Promise.all([
  getDocs(collection(db, 'weeks')),
  getDocs(collection(db, 'games')),
  getDocs(collection(db, 'picks')),
  getDocs(collection(db, 'users')),
])

const weeks = weeksSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
const allGames = gamesSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
const allPicks = picksSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
const users = usersSnapshot.docs.map((d) => ({ id: d.id, ...d.data() }))

const now = new Date()
let totalBackfilled = 0

for (const week of weeks) {
  const gamesForWeek = allGames.filter((g) => g.weekId === week.id)
  // findExistingPick (ported above) only matches on pickType (+ gameId for
  // repeatable types) — it does NOT check weekId itself, because the
  // client-side caller (WeekPicks.tsx) only ever hands it picks already
  // scoped to one week via usePicksForWeek. Since this script fetches the
  // WHOLE picks collection once up front, it must do that same per-week
  // filtering here — otherwise a user's Week 1 "AM" pick would make Week
  // 2's AM slot look already-answered and never get backfilled.
  const picksForWeek = allPicks.filter((p) => p.weekId === week.id)
  totalBackfilled += await backfillMissedPicksForWeek(week, gamesForWeek, picksForWeek, users, now)
}

console.log(`Done. ${totalBackfilled} pick(s) backfilled.`)
process.exit(0)
