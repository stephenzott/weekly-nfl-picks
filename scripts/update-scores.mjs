// Run on a schedule by .github/workflows/update-scores.yml so games and
// bets settle automatically after games finish, instead of requiring:
//  (a) an admin to open each game's Edit form and click "Fetch Score" by
//      hand (src/components/admin/EditGameForm.tsx still has that manual
//      button too — this script doesn't replace it, it's just that nobody
//      usually needs to use it anymore), AND
//  (b) someone to have the Week Picks or Standings page open afterward,
//      since that's normally what triggers settleWeekPicks
//      (src/lib/settleWeek.ts) to turn a final score into win/loss/push on
//      every pick.
//
// This duplicates logic from src/lib/espn.ts and src/lib/settlement.ts
// rather than importing them, because this is a plain Node script run
// outside Vite/TypeScript — same reasoning as scripts/seed-users.mjs
// duplicating firebaseConfig instead of importing src/lib/firebase.ts.
//
// Deliberately NOT ported here: settleWeekProps (Super Bowl Props) and
// season win totals. Both settle off a value an admin types in by hand
// (actualValue/correctChoice/actualWins), not off an ESPN score, so
// there's no new data for this script to react to — they still settle the
// existing way, next time anyone opens the app after an admin enters
// that value.
import { initializeApp } from 'firebase/app'
import { collection, getDocs, getFirestore, updateDoc, query, where } from 'firebase/firestore'

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

// --- Step 1: fetch final scores from ESPN for any game that's kicked off
// but is still marked 'scheduled' ---------------------------------------

const ESPN_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'

// ESPN's `dates` query param wants YYYYMMDD in US Eastern time (the NFL's
// own scheduling timezone) — NOT whatever timezone this happens to run in.
// GitHub Actions runners default to UTC, so a naive
// date.getFullYear()/getMonth()/getDate() here (which src/lib/espn.ts can
// get away with, since it only ever runs in a friend's browser, which is
// effectively always set to US Eastern per that file's own comment) would
// compute the WRONG calendar date for any game that kicks off late enough
// to cross midnight UTC — e.g. a Sunday 8:20pm ET game is already Monday
// in UTC. Intl.DateTimeFormat with an explicit timeZone sidesteps that by
// asking directly "what's the date in America/New_York," regardless of
// the runner's own timezone.
function formatDateParam(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const get = (type) => parts.find((p) => p.type === type).value
  return `${get('year')}${get('month')}${get('day')}`
}

// Very loose matching: ESPN's team names ("Philadelphia Eagles") always
// contain the nickname we store ("Eagles"), so a case-insensitive
// substring check is enough without needing a full team-name mapping
// table to keep in sync — same reasoning as src/lib/espn.ts.
function teamNameMatches(ourName, espnName) {
  return espnName.toLowerCase().includes(ourName.toLowerCase())
}

async function fetchEspnScore(game) {
  const dateParam = formatDateParam(game.kickoffTime.toDate())
  let events
  try {
    const response = await fetch(`${ESPN_SCOREBOARD_URL}?dates=${dateParam}`)
    if (!response.ok) {
      return { status: 'error', message: `ESPN returned HTTP ${response.status}` }
    }
    const data = await response.json()
    events = data.events ?? []
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : 'Network request failed' }
  }

  for (const event of events) {
    const competitors = event.competitions?.[0]?.competitors
    if (!competitors) continue

    const homeC = competitors.find((c) => c.homeAway === 'home')
    const awayC = competitors.find((c) => c.homeAway === 'away')
    if (!homeC?.team || !awayC?.team) continue

    const homeMatches = [homeC.team.displayName, homeC.team.shortDisplayName, homeC.team.name].some(
      (name) => name && teamNameMatches(game.homeTeam, name),
    )
    const awayMatches = [awayC.team.displayName, awayC.team.shortDisplayName, awayC.team.name].some(
      (name) => name && teamNameMatches(game.awayTeam, name),
    )
    if (!homeMatches || !awayMatches) continue

    const completed = event.competitions?.[0]?.status?.type?.completed === true
    if (!completed) return { status: 'not-final' }

    const home = Number(homeC.score)
    const away = Number(awayC.score)
    if (Number.isNaN(home) || Number.isNaN(away)) {
      return { status: 'error', message: 'ESPN returned a non-numeric score' }
    }
    return { status: 'final', home, away }
  }

  return { status: 'not-found' }
}

const gamesCollection = collection(db, 'games')

// Only 'scheduled' games can possibly need a score — a game already marked
// 'final' is never touched again here, so a manual admin correction (via
// the Edit Game form) always wins and can't get silently overwritten on
// this script's next run.
const scheduledGamesQuery = query(gamesCollection, where('status', '==', 'scheduled'))
const scheduledSnapshot = await getDocs(scheduledGamesQuery)

const now = new Date()
let scoresUpdated = 0

for (const docSnap of scheduledSnapshot.docs) {
  const game = { id: docSnap.id, ...docSnap.data() }
  const label = `${game.awayTeam} @ ${game.homeTeam}`

  // No point asking ESPN about a game that hasn't kicked off yet.
  if (game.kickoffTime.toDate() > now) continue

  const result = await fetchEspnScore(game)
  if (result.status === 'final') {
    await updateDoc(docSnap.ref, {
      finalScore: { home: result.home, away: result.away },
      status: 'final',
    })
    scoresUpdated++
    console.log(`Score updated: ${label} -> ${result.away}-${result.home}`)
  } else {
    console.log(`Score skipped: ${label} (${result.status}${result.message ? `: ${result.message}` : ''})`)
  }
}

console.log(`Step 1 done. ${scoresUpdated} score(s) updated.`)

// --- Step 2: settle every pick against every FINAL game --------------
// Ported from settleSpread/settleTotal/settlePick in src/lib/settlement.ts
// and the re-settle-everything loop in settleWeekPicks
// (src/lib/settleWeek.ts) — see those files for the full reasoning behind
// each rule. Re-settling every pick (not just ones tied to games this run
// just updated) mirrors settleWeekPicks's own "always re-settle, it's a
// pure function so writing the same result twice is harmless" approach,
// which is what lets a later manual score correction (via EditGameForm)
// get picked up here too on the next scheduled run.

function settleOverUnder(actualValue, line, wantsOver) {
  if (actualValue === line) return 'push'
  const wentOver = actualValue > line
  return wantsOver === wentOver ? 'win' : 'loss'
}

function settleSpread(game, pick) {
  if (!game.finalScore || !game.spread) return 'pending'
  const { favoredTeam, line } = game.spread

  if (favoredTeam !== game.homeTeam && favoredTeam !== game.awayTeam) return 'pending'

  const pickedFavorite = pick.spreadSide.startsWith(favoredTeam)

  const favoredScore = favoredTeam === game.homeTeam ? game.finalScore.home : game.finalScore.away
  const underdogScore = favoredTeam === game.homeTeam ? game.finalScore.away : game.finalScore.home
  const favoredMargin = favoredScore - underdogScore

  if (favoredMargin === line) return 'push'

  const favoriteCovered = favoredMargin > line
  const pickCovered = pickedFavorite ? favoriteCovered : !favoriteCovered
  return pickCovered ? 'win' : 'loss'
}

function settleTotal(game, pick) {
  if (pick.totalSide == null) return null
  if (!game.finalScore || game.total == null) return 'pending'

  const combinedScore = game.finalScore.home + game.finalScore.away
  return settleOverUnder(combinedScore, game.total, pick.totalSide === 'over')
}

// Re-fetch games fresh (rather than reusing the in-memory list from step
// 1) so this reflects every final game in Firestore right now, including
// ones that were already final before this run started.
const allGamesSnapshot = await getDocs(gamesCollection)
const finalGamesById = new Map()
for (const docSnap of allGamesSnapshot.docs) {
  const game = { id: docSnap.id, ...docSnap.data() }
  if (game.status === 'final' && game.finalScore != null) {
    finalGamesById.set(game.id, game)
  }
}

const picksCollection = collection(db, 'picks')
const allPicksSnapshot = await getDocs(picksCollection)

let picksSettled = 0

for (const docSnap of allPicksSnapshot.docs) {
  const pick = { id: docSnap.id, ...docSnap.data() }

  // Default-loss (missed) picks are already permanently 'loss'/null by
  // definition (PROJECT_SPEC.md Section 4.3) — no game outcome to derive
  // them from.
  if (pick.isDefaultLoss) continue

  const game = finalGamesById.get(pick.gameId)
  if (!game) continue

  const result = settleSpread(game, pick)
  const totalResult = settleTotal(game, pick)

  if (result === pick.result && totalResult === pick.totalResult) continue

  await updateDoc(docSnap.ref, { result, totalResult })
  picksSettled++
}

console.log(`Step 2 done. ${picksSettled} pick(s) settled/updated.`)
process.exit(0)
