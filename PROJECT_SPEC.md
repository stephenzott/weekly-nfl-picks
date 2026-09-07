# Weekly NFL Picks — Project Spec for Build

This document is the complete handoff spec for building this app. It was assembled through a requirements-gathering conversation with the project owner (Stephen) and should contain everything needed to start building without re-asking most of these questions. If anything below is ambiguous, ask Stephen directly rather than guessing.

---

## 1. What This Is

A private web app for 5 friends to pick NFL games against the spread (and optionally the total) each week, using fake money, and compare results with each other. Replaces a Google Sheet they used last season. Hosted free on GitHub Pages, backed by a free Firebase (Firestore) project for shared real-time data across everyone's devices.

**Repo:** https://github.com/stephenzott/weekly-nfl-picks
**Users:** 5 named people, no passwords — pick your name from a dropdown to identify yourself. All 5 have admin access.

---

## 2. Tech Stack

- **Frontend:** React, deployed as a static build to GitHub Pages
- **Backend/data:** Firebase Firestore (NoSQL document database), real-time sync, no server code required
- **Auth:** None. This was a deliberate choice — the group wants simplicity ("honor system") over hardened security. Anyone with the app URL and a bit of technical know-how could theoretically read Firestore data directly, bypassing the "hide picks until kickoff" UI rule. This tradeoff was discussed and accepted. Do not add Firebase Auth unless Stephen asks for it.
- **External data (optional, both should have manual fallback in the admin UI):**
  - **The Odds API** (https://the-odds-api.com) for auto-filled spreads/totals. Free tier: 500 credits/month, no card required. Cost per call = (# markets) × (# regions) — requesting `spreads,totals` for `us` region = 2 credits per call. At roughly one call per week, this is nowhere near the limit. **Stephen needs to sign up for a free API key and provide it — do not proceed with live integration until you have it. Build the manual-entry path first regardless, since it's needed as a fallback anyway.**
  - **ESPN's public scoreboard endpoint** for final scores, to help settle bets automatically: `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard`. No API key required. This is an unofficial/undocumented endpoint — stable for years but could change without notice, so always keep manual score entry as a fallback in the admin tab.

---

## 3. Firebase Config

```js
const firebaseConfig = {
  apiKey: "AIzaSyCg4J920Na5ADzo25pfMyURsEcYzM1XFp8",
  authDomain: "gen-lang-client-0026826837.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0026826837-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0026826837",
  storageBucket: "gen-lang-client-0026826837.firebasestorage.app",
  messagingSenderId: "814240070558",
  appId: "1:814240070558:web:9f54257de40f34364b748f"
};
```

Note: `databaseURL` is for the Realtime Database product, which we are **not** using — we're using **Firestore**, a different product in the same Firebase project. It's fine that this field is present; it just won't be used. Firestore was created in "test mode" (open read/write, no rules yet). Before this app is used with real weekly picks, appropriate Firestore security rules should be added — at minimum, restrict writes to documents that look like valid picks/games/users (shape validation), even without full auth-based access control, to prevent accidental or malicious corruption of the data. Discuss the exact ruleset with Stephen since the "no auth" decision constrains what's actually enforceable.

---

## 4. Full Requirements Spec

### 4.1 Weekly Picks — Regular Season

Each week, every user makes picks against the spread for exactly these slots:

1. **1pm ET game** — user chooses which 1pm game to pick from that week's 1pm slate
2. **4pm ET game** — same, from the 4pm slate
3. **Sunday Night Football** — the week's SNF game
4. **Monday Night Football** — the week's MNF game
5. **Wild Card game** — user picks any one game from a shared pool of "leftover" games not already covered by slots 1–4. Multiple users CAN pick the same wild-card game — no requirement that they differ.
6. **Highest Spread** — the system automatically identifies whichever single game that week has the largest spread (by absolute value), across the ENTIRE week's slate (marquee games + wild-card pool games + any bonus games). This is calculated on the fly by scanning that week's games — do not store it as a static flag, since spreads could be corrected/edited after entry and a stored flag could go stale.

**Bonus slots:** Some weeks have extra one-off games beyond the usual schedule (an international game, a Saturday game, a Thanksgiving/Christmas game, etc.). Admins should be able to add an arbitrary number of extra "bonus" slots in any given week. These share the same $120 weekly budget — they don't get separate money.

### 4.2 Weekly Picks — Playoffs

No fixed slot structure. Users pick every single game on that week's playoff slate (Wild Card weekend might have 6 games, Divisional 4, Conference Championship 2, Super Bowl 1). Same $120 budget for the week, split across however many games there are — more games in a playoff week means smaller average stakes per pick, and that's expected/fine.

**Super Bowl week is special:** in addition to the standard spread pick on the Super Bowl game itself, this week ALSO includes prop bets (see 4.5 below), and those props draw from the SAME $120 weekly budget as the spread pick — they are not a separate pool.

### 4.3 Money Rules

- **$120 total budget per week**, for spread picks (across all of that week's picks — 6 in a normal week, more in playoffs). This is NOT an even split — each user freely allocates however much of the $120 they want to each pick.
- **$10 minimum bet per pick.** Enforce this in the UI — reject a stake below $10 on any individual pick.
- **Totals (over/under) are optional per game.** If a user opts into the total for a given game, the total's stake must exactly match whatever they staked on that game's spread pick (this mirrors last season's actual spreadsheet behavior — e.g. $20 on the spread pick means $20 on the total pick too, but the user separately chooses over or under). The total's money is tracked separately from the $120 spread budget — it doesn't eat into it, but the amount is always tied to (mirrors) the corresponding spread stake.
- **Even-money payouts.** Risk $X, win $X. No juice/vig (e.g., NOT the standard sportsbook "bet $110 to win $100").
- **Push (tie exactly on the line)** = stake fully returned, no win or loss recorded.
- **$120 budget resets every week.** It does NOT roll over or accumulate as a running bankroll. Season standings are the SUM of each week's profit/loss across the whole season — i.e., cumulative net winnings, not a bankroll balance.
- **Missed pick = automatic $10 loss.** If a user hasn't submitted a pick for a game before it kicks off, the system should record a default pick for them: $10 stake, automatic loss, clearly flagged as a default/missed pick (not a real pick) so it displays differently in the UI (e.g., grayed out, labeled "No Pick"). Since this is a static site with no always-on server, this check does not need to run instantly at kickoff — it's acceptable for it to run client-side whenever any user next opens the app (i.e., on load, scan for games whose kickoff has passed with no submitted pick from any user, and backfill $10 default losses for those). This was explicitly discussed and approved.

### 4.4 Season Win Totals (Preseason feature)

Before the season starts, each user makes exactly 4 bets on individual teams' regular-season win totals (over/under), at a flat $20 per bet (not flexible — always exactly 4 bets, always $20 each). Example from last year's data: "Vikings 9.5 (Under), $20." This is a separate, one-time-per-season feature, tracked independently from the weekly $120 pick budget. Settlement happens at the end of the season once win totals are final.

### 4.5 Super Bowl Props (Super Bowl week feature)

During Super Bowl week only, in addition to the normal spread pick on the game itself, include additional prop bet types, e.g.:
- Coin toss (heads/tails)
- Player passing yards (over/under a line)
- Player rushing yards (over/under a line)
- Player receiving yards (over/under a line)

These draw from the same $120 weekly budget as that week's spread pick (see 4.2). The specific props/players will vary year to year and should be addable by an admin (similar to adding a game, but for a prop instead) — build this as a flexible "add a prop bet" admin feature rather than hardcoding specific stat categories, since the exact props of interest may change.

### 4.6 Visibility Rule

A user's picks for a given game are hidden from all other users until that specific game's kickoff time passes. This is a PER-GAME reveal, not a per-week reveal — e.g., once the 1pm games kick off, everyone's 1pm picks become visible, even though SNF/MNF picks for that same week are still hidden because those games haven't started yet. This is enforced at the UI level only (see Section 3 note on auth/security tradeoffs) — simply don't query/display other users' pick documents for a game until `now >= game.kickoffTime`.

### 4.7 Odds Fetch Timing

Since this is a static site with no backend/cron, odds are never pulled automatically in the background — it's always a manual, user-triggered action. Build a **"Fetch Odds" button in the admin tab** that calls The Odds API on demand when an admin is setting up a week's games (typically early in the week once the NFL schedule/lines are out). It's fine to click it again later in the week to refresh if lines have moved. However, once users have started submitting picks for a game, that game's line should be treated as locked — don't let a later "Fetch Odds" refresh silently overwrite a spread/total that people have already picked against. Manual admin override of the spread/total should always remain available regardless (for corrections, or games the API didn't return).

Note: since there's no backend, the API key will be embedded directly in the public frontend JS bundle and is technically visible to anyone who inspects network requests or source. This was discussed and explicitly accepted as a reasonable tradeoff for a free-tier key used by a small private group — no additional proxy/obfuscation layer is needed.

### 4.8 Admin Tab

Available to all 5 users (no special admin-only role). Functionality:
- Add games for a given week (teams, kickoff time/date, slot type: AM/PM/SNF/MNF/WildCardPool/Bonus/Playoff)
- Set/edit each game's spread and total (auto-fill attempt via The Odds API, but always manually editable/overridable)
- Add Super Bowl props during Super Bowl week (see 4.5)
- Enter/confirm final scores to settle bets (auto-fill attempt via ESPN scoreboard endpoint, always manually editable/overridable)
- Add the 4 Season Win Totals bets before the season (see 4.4)

### 4.9 Leaderboard / Standings

Track and display, per user:
- Weekly profit/loss (sum of that week's settled picks, including totals and any props/season-win-totals that settled that week)
- Season cumulative profit/loss (running sum across all weeks)
- Win/loss record against the spread (count of individual picks won vs. lost, for bragging rights — mirrors the "record" number seen in last year's spreadsheet, e.g. "$45, 60" meant $45 net profit and a 60-pick win count)

Compute these on the fly from the `picks` (and `seasonWinTotals`/`superBowlProps`) collections rather than storing a separately-maintained running total, to avoid sync bugs.

---

## 5. Data Model (Firestore)

Collections (each a set of documents/"cards" with the following fields):

**`users`**
- `id`, `name`

**`weeks`**
- `id`, `label` (e.g. "Week 1", "Wild Card", "AFC Championship", "Super Bowl")
- `type`: `"regular"` | `"playoff"`
- `budget`: number (almost always 120)

**`games`**
- `id`, `weekId` (reference to a `weeks` doc)
- `slot`: `"AM"` | `"PM"` | `"SNF"` | `"MNF"` | `"WildCardPool"` | `"Bonus"` | `"Playoff"`
- `homeTeam`, `awayTeam`
- `kickoffTime` (timestamp — drives both the pick lock and the visibility reveal)
- `spread` (e.g. `{ favoredTeam: "Eagles", line: -8.5 }`)
- `total` (number, e.g. `47.5`)
- `finalScore` (e.g. `{ home: 24, away: 20 }`, null until final)
- `status`: `"scheduled"` | `"final"`
- `lineSource`: `"api"` | `"manual"` (for transparency/debugging)

**`picks`**
- `id`, `userId`, `gameId`, `weekId`
- `spreadSide` (e.g. `"Eagles -8.5"`), `spreadStake` (number, min 10)
- `pickType`: `"AM"` | `"PM"` | `"SNF"` | `"MNF"` | `"WildCard"` | `"HighSpread"` | `"Bonus"` | `"Playoff"` — note this may differ conceptually from the game's own `slot`, since e.g. the same wild-card-pool game could simultaneously be someone's "WildCard" pick type and also happen to be the auto-computed "HighSpread" pick for someone else
- `totalSide` (`"over"` | `"under"` | null), `totalStake` (number or null — always equal to `spreadStake` when `totalSide` is set)
- `result`: `"win"` | `"loss"` | `"push"` | `"pending"`
- `isDefaultLoss`: boolean (true if this was auto-generated from a missed pick)

**`seasonWinTotals`**
- `id`, `userId`, `team`, `line` (e.g. 9.5), `side` (`"over"` | `"under"`), `stake` (always 20), `actualWins` (filled in at season end), `result`

**`superBowlProps`**
- `id`, `userId`, `propType` (free text/flexible, e.g. `"coinToss"`, `"passingYards"`), `description` (e.g. "Sam Darnold Passing Yards"), `line` (number or null for coin toss), `pick`, `stake`, `result`

---

## 6. Reference Data — Last Season's Spreadsheet

Stephen provided last season's actual tracking spreadsheet (Google Sheets export) during requirements gathering, which confirmed the structure above and is where the bonus-slot, missed-pick, season-win-totals, and Super Bowl props details came from. If useful for validating settlement math or UI copy, ask Stephen to re-share that CSV — it wasn't included as a file in this handoff doc, but contains a full season of real example data (weeks 1–18 plus playoffs) that could serve as good test/seed data.

---

## 7. Build Roadmap

Suggested order (a full regular-season week end-to-end before layering on the more unusual cases):

1. **Project scaffolding** — React app skeleton, Firebase SDK wired up with the config in Section 3, GitHub Pages deploy pipeline (remember: GitHub Pages serves from a subpath like `stephenzott.github.io/weekly-nfl-picks/`, so the React Router base path and `package.json` `homepage` field need to account for that)
2. **Pick-making screen** — name selection (no login), weekly pick slots (AM/PM/SNF/MNF/WildCard/HighSpread), stake entry with $10 minimum and running total against the $120 budget, optional mirrored total bet
3. **Reveal/lock logic** — hide other users' picks per-game until kickoff (Section 4.6); lock a user's own pick submission after kickoff too
4. **Missed-pick backfill** — the client-side "check on load" logic from Section 4.3
5. **Admin tab** — add games/bonus slots, set spread/total (manual + Odds API attempt), enter scores (manual + ESPN endpoint attempt), add Super Bowl props, add Season Win Totals bets
6. **Settlement engine** — turn final scores into win/loss/push per pick, per the even-money/push rules in 4.3
7. **Standings/leaderboard** — weekly and season cumulative views, win/loss record display
8. **Playoff mode** — variable-game-count weeks (Section 4.2) instead of fixed slots
9. **Season Win Totals + Super Bowl Props UI** — the once-a-season and once-a-week special features
10. **Responsive polish** — needs to work well on 5 different people's phones/tablets/laptops
11. **Deployment** — GitHub Pages build/deploy, Firestore security rules pass (see Section 3 note)

---

## 8. Explicitly Deferred / Open Items

- Firestore security rules are currently wide open ("test mode"). Should be tightened before real use, within the constraint that there's no user auth (see Section 3).
- The Odds API key has not yet been created — manual entry should work standalone regardless, with API auto-fill as an enhancement layered in once Stephen provides a key.
- Exact visual/UI design has not been specified — use good judgment for a clean, mobile-friendly sports app aesthetic unless Stephen has specific preferences.
