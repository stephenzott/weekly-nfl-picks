import { useState } from 'react'
import { updateGame } from '../../lib/games'
import { sortBySpreadDesc } from '../../lib/slots'
import { setHighSpreadGame } from '../../lib/weeks'
import type { Game, GameSlot, Pick as PickDoc, Week } from '../../types'

interface SharedSlotsPickerProps {
  week: Week
  games: Game[]
  // Used to lock a slot's dropdown/checkbox once a real pick (or
  // backfilled default-loss pick) already references the game currently
  // sitting in that slot — reassigning it out from under a saved pick
  // would leave that pick pointing at a game that's no longer actually the
  // AM/PM/SNF/MNF/HighSpread/Bonus game it was answered for.
  picksInWeek: PickDoc[]
}

const MARQUEE_SLOTS: { slot: GameSlot; label: string }[] = [
  { slot: 'AM', label: '1pm Game (AM)' },
  { slot: 'PM', label: '4pm Game (PM)' },
  { slot: 'SNF', label: 'Sunday Night Football (SNF)' },
  { slot: 'MNF', label: 'Monday Night Football (MNF)' },
]

// Same cap AddGameForm used to enforce by disabling its "Add Game" button —
// a regular season week's 4 marquee slots plus however many Bonus games are
// each a separate required $10-minimum pick, and the $120 weekly budget
// can't actually cover more than 6 of those (PROJECT_SPEC.md Section 4.1).
// WildCard and HighSpread don't count here: no matter how big the pool is,
// each user still only makes ONE WildCard pick and ONE HighSpread pick.
const MAX_REGULAR_SEASON_GAMES = 6

function gameLabel(game: Game): string {
  const spreadText = game.spread ? ` (${game.spread.favoredTeam} -${game.spread.line})` : ' (no spread yet)'
  return `${game.awayTeam} @ ${game.homeTeam}${spreadText}`
}

// Admin assigns each of the 5 shared weekly games — AM, PM, SNF, MNF, and
// HighSpread — plus zero or more Bonus games, by picking from whatever
// ImportGames.tsx has pulled into the shared WildCardPool. Whatever's left
// unassigned stays in WildCardPool and becomes the Wild Card pool users
// pick from directly (see computeSlotsForRegularWeek in src/lib/slots.ts).
//
// AM/PM/SNF/MNF/Bonus are a real field on the Game document (`slot`) —
// assigning a pool game to one of them is just an updateGame call that
// moves it OUT of WildCardPool, and un-assigning moves it back in. HighSpread
// is different: per Stephen (2026-09-08), it's a virtual designation —
// Week.highSpreadGameId points at a WildCardPool game that stays tagged
// WildCardPool the whole time (see setHighSpreadGame/computeSlotsForRegularWeek).
export function SharedSlotsPicker({ week, games, picksInWeek }: SharedSlotsPickerProps) {
  const [saving, setSaving] = useState(false)

  function gameHasAnyPick(gameId: string): boolean {
    return picksInWeek.some((p) => p.gameId === gameId)
  }

  // A pool game that's already been picked (as that week's WildCard choice,
  // before the admin got around to promoting it) can't safely be promoted
  // into a marquee/HighSpread/Bonus slot afterward — see the advisor-caught
  // collision this redesign introduced: nothing stopped users from
  // WildCard-picking a pool game BEFORE it's assigned a role, since pool
  // games are pickable from the moment ImportGames adds them. Promoting it
  // later would leave that pick's gameId pointing at what is now also the
  // mandatory AM/PM/SNF/MNF/Bonus/HighSpread game for everyone — the exact
  // "same physical game, two different required picks" collision
  // computeSlotsForRegularWeek's HighSpread/WildCard split exists to
  // prevent. Filtering these out of every "available to promote" list
  // closes that gap; a game already in the list AS the current
  // selection for a slot is unaffected by this (see the `=== currentId`
  // carve-outs below) — it just can't be reassigned away once picked,
  // same as the existing line-locking idea FetchOddsButton already uses.
  function availablePoolGames(excludeId?: string): Game[] {
    return games.filter(
      (g) =>
        g.slot === 'WildCardPool' &&
        // The `excludeId` game bypasses BOTH exclusions below — it's
        // always the slot's own currently-assigned game, which must keep
        // showing up as the selected option in its own dropdown (its
        // lock, if any, is handled separately via the disabled attribute)
        // regardless of whether it's also this week's HighSpread game or
        // already has a pick against it.
        (g.id === excludeId || (g.id !== (week.highSpreadGameId ?? '') && !gameHasAnyPick(g.id))),
    )
  }

  async function handleMarqueeChange(slot: GameSlot, currentGame: Game | null, newGameId: string) {
    if (newGameId === (currentGame?.id ?? '')) return
    setSaving(true)
    try {
      // Free the old game back into the pool first, then promote the new
      // one — order doesn't matter for correctness (they're different
      // documents) but doing the "give back" half first means a failure
      // partway through never leaves two games claiming the same slot.
      if (currentGame) {
        await updateGame(currentGame.id, { slot: 'WildCardPool' })
      }
      if (newGameId) {
        await updateGame(newGameId, { slot })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleHighSpreadChange(gameId: string) {
    setSaving(true)
    try {
      await setHighSpreadGame(week.id, gameId || null)
    } finally {
      setSaving(false)
    }
  }

  async function handleBonusToggle(game: Game, turnOn: boolean) {
    setSaving(true)
    try {
      await updateGame(game.id, { slot: turnOn ? 'Bonus' : 'WildCardPool' })
    } finally {
      setSaving(false)
    }
  }

  const filledMarqueeCount = MARQUEE_SLOTS.filter(({ slot }) => games.some((g) => g.slot === slot)).length
  const bonusGames = games.filter((g) => g.slot === 'Bonus')
  const atGameCap = filledMarqueeCount + bonusGames.length >= MAX_REGULAR_SEASON_GAMES

  if (games.length === 0) {
    return <p>No games imported yet this week — use Import Games above first.</p>
  }

  const currentHighSpreadId = week.highSpreadGameId ?? ''
  const highSpreadCandidates = sortBySpreadDesc(availablePoolGames(currentHighSpreadId))
  const isHighSpreadLocked = currentHighSpreadId !== '' && gameHasAnyPick(currentHighSpreadId)

  return (
    <div style={{ margin: '12px 0' }}>
      <h3>Shared Games</h3>
      <p>Assign this week's 5 shared games from the pool of imported games.</p>

      {MARQUEE_SLOTS.map(({ slot, label }) => {
        const currentGame = games.find((g) => g.slot === slot) ?? null
        const options = currentGame
          ? [currentGame, ...availablePoolGames(currentGame.id)]
          : availablePoolGames()
        const isLocked = currentGame != null && gameHasAnyPick(currentGame.id)
        return (
          <div key={slot}>
            <label>
              {label}{' '}
              <select
                value={currentGame?.id ?? ''}
                onChange={(e) => handleMarqueeChange(slot, currentGame, e.target.value)}
                disabled={saving || isLocked}
              >
                <option value="">— none selected —</option>
                {options.map((g) => (
                  <option key={g.id} value={g.id}>
                    {gameLabel(g)}
                  </option>
                ))}
              </select>
            </label>{' '}
            {isLocked && <span>(locked — someone has already picked this game)</span>}
          </div>
        )
      })}

      <div>
        <label>
          Highest Spread of the Week{' '}
          <select
            value={currentHighSpreadId}
            onChange={(e) => handleHighSpreadChange(e.target.value)}
            disabled={saving || isHighSpreadLocked}
          >
            <option value="">— none selected —</option>
            {highSpreadCandidates.map((g) => (
              <option key={g.id} value={g.id}>
                {gameLabel(g)}
              </option>
            ))}
          </select>
        </label>{' '}
        {isHighSpreadLocked && <span>(locked — someone has already picked this game)</span>}
      </div>

      <fieldset>
        <legend>Bonus Games (optional — each one is its own required pick)</legend>
        {bonusGames.length === 0 && availablePoolGames().length === 0 && <p>No candidates yet.</p>}
        <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
          {bonusGames.map((g) => {
            const isLocked = gameHasAnyPick(g.id)
            return (
              <li key={g.id}>
                <label>
                  <input
                    type="checkbox"
                    checked
                    disabled={saving || isLocked}
                    onChange={() => handleBonusToggle(g, false)}
                  />{' '}
                  {gameLabel(g)}
                </label>{' '}
                {isLocked && <span>(locked — already picked)</span>}
              </li>
            )
          })}
          {availablePoolGames().map((g) => (
            <li key={g.id}>
              <label>
                <input
                  type="checkbox"
                  checked={false}
                  disabled={saving || atGameCap}
                  onChange={() => handleBonusToggle(g, true)}
                />{' '}
                {gameLabel(g)}
              </label>
            </li>
          ))}
        </ul>
        {atGameCap && (
          <p className="error-text">
            This week already has {filledMarqueeCount + bonusGames.length} marquee/Bonus games —
            capped at {MAX_REGULAR_SEASON_GAMES} total. Remove a Bonus game to add a different one.
          </p>
        )}
      </fieldset>
    </div>
  )
}
