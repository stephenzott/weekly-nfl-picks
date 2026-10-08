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
        <>
          <p>
            <strong>Regular season weeks</strong> are import-only — there's no manual game entry
            anymore:
          </p>
          <ol style={{ maxWidth: 640 }}>
            <li>
              Set the date range in <strong>Import Games</strong> to cover this week's games
              (defaults to today through a week out — widen it for holiday weeks with odd kickoff
              days, e.g. the Wednesday game before Thanksgiving or a Friday/Christmas game), then
              click <strong>Load Games</strong>.
            </li>
            <li>
              Review the new-games checklist (unchecking anything you don't want) and click{' '}
              <strong>Import</strong>. Every new game lands in a shared pool — this same click
              also refreshes spread/total odds on games already on the board.
            </li>
            <li>
              In <strong>Shared Games</strong> below, use the dropdowns to assign one pool game
              each to <strong>AM</strong> (1pm), <strong>PM</strong> (4pm), <strong>SNF</strong>,{' '}
              <strong>MNF</strong>, and <strong>Highest Spread of the Week</strong>. Every user
              bets these same 5 games. Optionally check off any one-off <strong>Bonus</strong>{' '}
              games (international game, Thanksgiving game, etc.) — each is its own required pick.
            </li>
            <li>
              Whatever's left unassigned in the pool automatically becomes the Wild Card pick
              (users pick any one leftover game) — you need at least 2 leftover games for that
              pick to show up.
            </li>
            <li>
              A week caps out at <strong>6 total</strong> marquee + Bonus games (AM/PM/SNF/MNF
              plus however many Bonus games) — the Bonus checklist disables itself once you hit
              that limit. WildCard and HighSpread don't count toward it.
            </li>
            <li>
              Once someone actually picks a game, its slot locks — you can't reassign it (or the
              Highest Spread pick) out from under them.
            </li>
            <li>
              That's it — there's no separate "save the week" step. Everything saves as you go,
              and users can start picking as soon as the games they need exist.
            </li>
          </ol>
          <p>
            <strong>Playoff weeks</strong> still use manual entry below (<strong>Add a Game</strong>
            ) — every game on a playoff slate requires its own pick, so there's no shared-slot
            structure to assign games into.
          </p>
        </>
      )}
    </div>
  )
}
