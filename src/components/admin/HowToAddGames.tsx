import { useState } from 'react'

// Per Stephen (2026-09-08): a toggleable help panel so someone OTHER than
// Stephen can run the weekly admin setup without having to ask him first.
// Kept as a plain collapsible block (no routing/modal) so it's always right
// where the work happens, and easy to keep in sync by hand as the process
// changes — this intentionally restates the same steps as PROJECT_SPEC.md
// Section 4.1, just in plainer/shorter form for someone who hasn't read the
// spec.
export function HowToAddGames() {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ margin: '12px 0' }}>
      <button onClick={() => setOpen((o) => !o)}>
        {open ? 'Hide' : 'How to add games'}
      </button>
      {open && (
        <ol style={{ maxWidth: 640 }}>
          <li>
            Add exactly one game each for <strong>AM</strong> (1pm), <strong>PM</strong> (4pm),{' '}
            <strong>SNF</strong>, and <strong>MNF</strong> — set the Slot dropdown to match when
            adding each one. Every user bets these same 4 games.
          </li>
          <li>
            Add any one-off <strong>Bonus</strong> games for the week (international game,
            Thanksgiving game, etc.) with Slot set to Bonus. Each Bonus game is its own required
            pick.
          </li>
          <li>
            Add any extra games as <strong>WildCardPool</strong> — these feed the Wild Card and
            Highest Spread picks below. You need at least 2 of these for BOTH picks to show up
            (1 becomes Highest Spread, whatever's left becomes the Wild Card pool); with only 1,
            it can become Highest Spread but there's no Wild Card that week.
          </li>
          <li>
            A regular season week caps out at <strong>6 games total</strong> — including Bonus.
            "Add Game" disables itself once you hit 6, so if you want Bonus AND
            WildCard/HighSpread games, budget for that (e.g. 4 marquee + 2 WildCardPool leaves no
            room for Bonus that week).
          </li>
          <li>
            Click <strong>Fetch Odds</strong> to auto-fill spread/total for every game you've
            added so far (matched by team name). If you add more games afterward, click it again.
          </li>
          <li>
            Use the <strong>Highest Spread Pick</strong> dropdown to choose which WildCardPool
            game is this week's Highest Spread pick. Once someone actually picks it, that
            selection locks — you can't reassign it out from under them.
          </li>
          <li>
            That's it — there's no separate "save the week" step. Everything saves as you go, and
            users can start picking as soon as the games they need exist.
          </li>
        </ol>
      )}
    </div>
  )
}
