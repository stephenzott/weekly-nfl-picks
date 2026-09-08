import { useEffect } from 'react'
import { useAllGames } from '../hooks/useAllGames'
import { useAllPicks } from '../hooks/useAllPicks'
import { useAllPropDefinitions } from '../hooks/useAllPropDefinitions'
import { useSeasonWinTotals } from '../hooks/useSeasonWinTotals'
import { useSuperBowlProps } from '../hooks/useSuperBowlProps'
import { useUsers } from '../hooks/useUsers'
import { useWeeks } from '../hooks/useWeeks'
import { settleWeekPicks, settleWeekProps } from '../lib/settleWeek'
import { computeStandings, type StandingsRow } from '../lib/standings'

// Formats a net dollar amount with an explicit +/- sign so it's obvious at
// a glance whether a number is a profit or a loss, rather than relying on
// the reader to notice a minus sign buried in front of a dollar sign.
function formatNet(net: number): string {
  if (net > 0) return `+$${net}`
  if (net < 0) return `-$${Math.abs(net)}`
  return '$0'
}

// "Competition ranking": tied users share the same rank number, and the
// next DISTINCT value skips ahead accordingly (1, 1, 3 — not 1, 1, 2) since
// two people occupy "1st place" and there is no 2nd. Per Stephen
// (2026-09-07): this matters in practice because everyone starts the
// preseason tied at exactly $0, where a naive 1/2/3/4/5 numbering would
// falsely imply someone is already ahead.
function competitionRanks(sortedRows: StandingsRow[]): number[] {
  const ranks: number[] = []
  for (let i = 0; i < sortedRows.length; i++) {
    const tiedWithPrevious = i > 0 && sortedRows[i].seasonNet === sortedRows[i - 1].seasonNet
    ranks.push(tiedWithPrevious ? ranks[i - 1] : i + 1)
  }
  return ranks
}

export function StandingsPage() {
  const users = useUsers()
  const weeks = useWeeks()
  const [allPicks, picksLoaded] = useAllPicks()
  const [allGames, gamesLoaded] = useAllGames()
  const [propDefs, propDefsLoaded] = useAllPropDefinitions()
  const [allProps, propsLoaded] = useSuperBowlProps()
  const seasonWinTotals = useSeasonWinTotals()

  // Settlement engine (task #7) normally runs from the Picks tab, scoped to
  // whichever single week is selected there. Standings shows money summed
  // across EVERY week, so it needs its own trigger too — otherwise a week
  // whose games finished but that nobody happened to re-open on Picks
  // afterward would stay stuck at 'pending' forever, and this page would
  // permanently understate that week's money. Per Stephen (2026-09-07):
  // settle from here as well, across ALL games/picks rather than just one
  // week — same self-healing, idempotent function as Picks uses, just given
  // the whole season's data instead of one week's.
  useEffect(() => {
    if (allGames.length === 0) return
    settleWeekPicks(allGames, allPicks)
  }, [allGames, allPicks])

  // Same reasoning, extended to Super Bowl Props (task #10): props can be
  // settled from either the Picks page (whichever week is selected) or
  // here, so this page can't assume the props it's summing have already
  // been settled elsewhere.
  useEffect(() => {
    if (propDefs.length === 0) return
    settleWeekProps(propDefs, allProps)
  }, [propDefs, allProps])

  const standings = computeStandings(users, weeks, allPicks, seasonWinTotals, propDefs, allProps)
  // PROJECT_SPEC.md Section 4.9's whole point is bragging rights — rank
  // everyone by season net $, best to worst.
  const ranked = [...standings].sort((a, b) => b.seasonNet - a.seasonNet)
  const ranks = competitionRanks(ranked)

  // Gated on the four money-bearing subscriptions (picks/games/props), not
  // on users/weeks: an empty array before its first Firestore snapshot
  // arrives would otherwise render a confident-looking "everyone is at $0"
  // leaderboard that's actually just still loading, not real data. Users/
  // weeks arriving a beat later just means the tables briefly have fewer
  // rows, which isn't misleading the same way.
  if (!picksLoaded || !gamesLoaded || !propDefsLoaded || !propsLoaded) {
    return <p>Loading standings…</p>
  }

  return (
    <div>
      <h1>Standings</h1>

      <h2>Season Leaderboard</h2>
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Season Net</th>
            <th>Record (W-L-P)</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((row, i) => (
            <tr key={row.userId}>
              <td>{ranks[i]}</td>
              <td>{row.userName}</td>
              <td>{formatNet(row.seasonNet)}</td>
              <td>
                {row.record.wins}-{row.record.losses}-{row.record.pushes}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Week-by-Week Breakdown</h2>
      {weeks.length === 0 ? (
        <p>No weeks have been added yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Week</th>
              {users.map((user) => (
                <th key={user.id}>{user.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.id}>
                <td>{week.label}</td>
                {standings.map((row) => (
                  <td key={row.userId}>{formatNet(row.weeklyNet[week.id] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        <small>
          Season Net includes each week's picks (spread + total) and Super Bowl Props, plus
          Season Win Totals once those are settled. Season Win Totals aren't attributed to any
          single week above; Props are, via their prop definition's week.
        </small>
      </p>
    </div>
  )
}
