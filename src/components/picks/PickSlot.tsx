import { useState } from 'react'
import { MIN_STAKE } from '../../lib/constants'
import { hasKickedOff } from '../../lib/gameTiming'
import { savePick } from '../../lib/picks'
import { getSpreadOptions } from '../../lib/spreadOptions'
import type { Game, Pick, TotalSide } from '../../types'
import type { Slot } from '../../lib/slots'

interface PickSlotProps {
  slot: Slot
  weekId: string
  userId: string
  // This user's already-saved pick for this slot, if any — used to
  // pre-fill the form so re-opening the app shows what you already picked.
  // May be a real pick OR a system-generated coin-flip auto-pick
  // backfilled by src/lib/missedPicks.ts after this user missed the
  // deadline.
  existingPick: Pick | undefined
  // The week's total budget (almost always $120) and how much of it this
  // user has already committed to OTHER slots — used to enforce the budget
  // as a hard cap (Stephen, 2026-09-07: going over $120 should be blocked,
  // not just warned about).
  budget: number
  otherPicksTotal: number
  // $10 (MIN_STAKE) for every OTHER slot this user hasn't picked yet this
  // week. Reserved off the top of the remaining budget so this slot's
  // stake can never leave a later required slot with less than $10 of
  // room — which would otherwise force a miss that the missed-pick rule's
  // flat $10 default-loss (src/lib/missedPicks.ts) would then push over
  // the $120 cap. Stephen, 2026-09-07: real picks give way so the $10
  // floor always fits, rather than letting misses exceed the cap.
  reserveForOtherSlots: number
  // True when every OTHER required pick this week already has a saved
  // value and this one doesn't yet — i.e., this is the very last pick
  // standing between "some money unspent" and "exactly $120 spent."
  // Per Stephen (2026-09-08): when true, this slot's stake isn't freely
  // entered — it's forced to whatever's left, same trick as Season Win
  // Totals' forced 4th bet (SeasonWinTotalsSection.tsx). Deliberately
  // computed over PICKS only (see WeekPicks.tsx) — props stay freely
  // entered even in the rare week that has them.
  isLastPick: boolean
  // Current time, polled by the parent (see useNow) so the UI locks itself
  // automatically as kickoff times pass, without needing a page refresh.
  now: Date
}

export function PickSlot({
  slot,
  weekId,
  userId,
  existingPick,
  budget,
  otherPicksTotal,
  reserveForOtherSlots,
  isLastPick,
  now,
}: PickSlotProps) {
  // For a "poolChoice" slot (AM/PM/WildCard) the user first has to choose
  // WHICH game they're picking, out of several candidates. For a
  // "fixedGame" slot there's only ever one possible game, so we skip that
  // step entirely.
  const [selectedGameId, setSelectedGameId] = useState(
    () => existingPick?.gameId ?? (slot.kind === 'fixedGame' ? slot.game.id : ''),
  )
  const [spreadSide, setSpreadSide] = useState(() => existingPick?.spreadSide ?? '')
  const [spreadStake, setSpreadStake] = useState(() => existingPick?.spreadStake ?? MIN_STAKE)
  const [totalEnabled, setTotalEnabled] = useState(() => existingPick?.totalSide != null)
  const [totalSide, setTotalSide] = useState<TotalSide>(() => existingPick?.totalSide ?? 'over')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const game: Game | undefined =
    slot.kind === 'fixedGame' ? slot.game : slot.candidates.find((g) => g.id === selectedGameId)

  // PROJECT_SPEC.md Section 4.6: "lock a user's own pick submission after
  // kickoff too." What counts as "locked" depends on whether this user has
  // already committed to a specific game for this slot:
  //  - fixedGame slots (SNF/MNF/HighSpread/Bonus) only ever have one
  //    possible game, so the slot locks the moment THAT game kicks off —
  //    there's nothing else it could mean.
  //  - poolChoice slots (AM/PM/WildCard) only lock once the user's SAVED
  //    pick's specific game kicks off. Deliberately NOT based on whichever
  //    game happens to be selected in the dropdown right now: if it were,
  //    someone could watch their committed game start going badly and
  //    "escape" by switching their whole pick to a different, still-open
  //    game in the same pool — which would defeat the point of locking.
  //    If there's no saved pick yet, the slot isn't locked by this rule at
  //    all (though see `availableCandidates` below for how already-started
  //    candidates get excluded from being newly pickable anyway).
  const committedGame: Game | undefined =
    slot.kind === 'fixedGame'
      ? slot.game
      : existingPick
        ? slot.candidates.find((g) => g.id === existingPick.gameId)
        : undefined
  const locked = Boolean(committedGame && hasKickedOff(committedGame, now))

  // For an as-yet-unpicked poolChoice slot, don't offer candidates whose
  // kickoff has already passed — you can't place a new bet on a game
  // that's already started. The currently selected option always stays in
  // the list (even if it has since kicked off) so the <select> never ends
  // up pointing at a value that isn't one of its own options.
  const availableCandidates =
    slot.kind === 'poolChoice'
      ? slot.candidates.filter((g) => g.id === selectedGameId || !hasKickedOff(g, now))
      : []

  const spreadOptions = game ? getSpreadOptions(game) : null

  // The effective cap for THIS slot's stake isn't the full $120 — it's
  // $120 minus what's already committed elsewhere, minus a $10 reserve
  // for every other slot that still needs a legal pick of its own (see the
  // reserveForOtherSlots prop doc for why).
  const effectiveBudget = budget - reserveForOtherSlots
  // The forced final stake for the last pick: whatever's left. The reserve
  // math above guarantees this is always >= MIN_STAKE by the time it's
  // actually the last pick (every prior pick was capped to leave enough
  // behind) — same reasoning as Season Win Totals' forced 4th bet.
  const effectiveStake = isLastPick ? effectiveBudget - otherPicksTotal : spreadStake
  const projectedTotal = otherPicksTotal + effectiveStake
  const wouldExceedBudget = !isLastPick && projectedTotal > effectiveBudget

  const canSave = Boolean(
    game && spreadSide && effectiveStake >= MIN_STAKE && !wouldExceedBudget && !locked,
  )

  async function handleSave() {
    if (locked) return
    if (!game || !spreadSide) return
    // Deliberately re-check against a FRESH `new Date()` here rather than
    // the `now` prop: `now` is polled every 30s (see useNow) purely so the
    // on-screen UI locks itself without a manual refresh. If we reused
    // that same stale value for the actual save guard, a click landing in
    // that up-to-30s window right after kickoff would slip through even
    // though the UI looked locked — this is the one check that actually
    // has to be accurate the instant it runs.
    if (hasKickedOff(game, new Date())) {
      setError('This game has already kicked off.')
      return
    }
    if (effectiveStake < MIN_STAKE) {
      // PROJECT_SPEC.md Section 4.3: "$10 minimum bet per pick." This is a
      // second check (the button is already disabled below MIN_STAKE) in
      // case this function is ever called from somewhere that skips that
      // check — defensive, not decorative.
      setError(`Stake must be at least $${MIN_STAKE}.`)
      return
    }
    if (wouldExceedBudget) {
      setError(
        reserveForOtherSlots > 0
          ? `This would leave less than $${MIN_STAKE} for your other unpicked slots this week ($${reserveForOtherSlots} needs to stay reserved).`
          : `This would put you at $${projectedTotal} for the week, over the $${budget} budget.`,
      )
      return
    }
    setSaving(true)
    setError(null)
    try {
      await savePick({
        userId,
        gameId: game.id,
        weekId,
        spreadSide,
        spreadStake: effectiveStake,
        totalSide: totalEnabled ? totalSide : null,
        // The mirrored-total rule (Section 4.3): the total's stake always
        // equals the spread stake, never entered independently.
        totalStake: totalEnabled ? effectiveStake : null,
        // Always 'pending' here, not existingPick's old value: handleSave
        // can only run before this pick's game has kicked off (see the
        // `locked` check above), and the settlement engine only ever
        // settles games that are already final — so there's no scenario
        // where a real result could already exist for a pick that's still
        // editable.
        result: 'pending',
        totalResult: totalEnabled ? 'pending' : null,
        isAutoPick: false,
        pickType: slot.pickType,
      })
    } finally {
      setSaving(false)
    }
  }

  // A backfilled auto-pick (src/lib/missedPicks.ts) isn't something to
  // edit — PROJECT_SPEC.md Section 4.3 asks for a missed pick to "display
  // differently in the UI (e.g., grayed out, labeled)," so it gets its
  // own compact, read-only rendering instead of the normal side/stake/
  // total form. Per Stephen (2026-09-11): a missed pick is now a real
  // coin-flipped bet (side + stake, settled normally), not an automatic
  // $10 loss, so this shows what was actually picked rather than hiding
  // it behind "No Pick." The rare fallback case (spreadSide '', when the
  // game never got a spread set — see missedPicks.ts) still reads as a
  // true no-pick loss.
  if (existingPick?.isAutoPick) {
    const missedGame =
      slot.kind === 'fixedGame'
        ? slot.game
        : slot.candidates.find((g) => g.id === existingPick.gameId)
    const matchupLabel = missedGame ? `${missedGame.awayTeam} @ ${missedGame.homeTeam}` : null
    return (
      <div className="ledger-item ledger-item--muted">
        <div className="ledger-label">{slot.label}</div>
        <div className="ledger-detail">
          <span className="error-text">
            {existingPick.spreadSide
              ? `Missed — auto-picked (coin flip): ${existingPick.spreadSide} for $${existingPick.spreadStake}`
              : 'No Pick — missed, automatic $10 loss'}
          </span>
          {matchupLabel && <div className="meta">{matchupLabel}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="ledger-item">
      <div className="ledger-label">
        {slot.label}
        {existingPick && <div className="pick-status">saved</div>}
        {locked && <div className="pick-status">locked (kickoff passed)</div>}
      </div>
      <div className="ledger-detail">
        {slot.kind === 'poolChoice' && (
          <div>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              disabled={locked}
            >
              <option value="">— Choose a game —</option>
              {availableCandidates.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.awayTeam} @ {g.homeTeam}
                </option>
              ))}
            </select>
            {!locked && !existingPick && availableCandidates.length === 0 && (
              <p className="meta">All games in this pool have already kicked off.</p>
            )}
          </div>
        )}
        {slot.kind === 'fixedGame' && (
          <div>
            {slot.game.awayTeam} @ {slot.game.homeTeam}
          </div>
        )}

        {game && !spreadOptions && <p className="meta">Spread hasn't been set for this game yet.</p>}

        {game && spreadOptions && (
          <div>
            {spreadOptions.map((option) => (
              <label key={option.value} style={{ marginRight: 12 }}>
                <input
                  type="radio"
                  name={`${slot.pickType}-${game.id}-side`}
                  checked={spreadSide === option.value}
                  onChange={() => setSpreadSide(option.value)}
                  disabled={locked}
                />{' '}
                {option.value}
              </label>
            ))}

            {game.total != null && (
              <div>
                <label>
                  <input
                    type="checkbox"
                    checked={totalEnabled}
                    onChange={(e) => setTotalEnabled(e.target.checked)}
                    disabled={locked}
                  />{' '}
                  Also bet the total ({game.total}) — stake mirrors the spread stake (${effectiveStake})
                </label>
                {totalEnabled && (
                  <div>
                    <label>
                      <input
                        type="radio"
                        name={`${slot.pickType}-${game.id}-total`}
                        checked={totalSide === 'over'}
                        onChange={() => setTotalSide('over')}
                        disabled={locked}
                      />{' '}
                      Over
                    </label>{' '}
                    <label>
                      <input
                        type="radio"
                        name={`${slot.pickType}-${game.id}-total`}
                        checked={totalSide === 'under'}
                        onChange={() => setTotalSide('under')}
                        disabled={locked}
                      />{' '}
                      Under
                    </label>
                  </div>
                )}
              </div>
            )}

            {isLastPick && !locked && effectiveStake >= MIN_STAKE && (
              <p className="meta">
                Last pick — stake locked at ${effectiveStake} to bring your week to exactly $
                {budget}.
              </p>
            )}
            {isLastPick && !locked && effectiveStake < MIN_STAKE && (
              // Can only happen if an admin added a new required game/prop
              // AFTER earlier picks were already saved this week, leaving
              // less than the $10 minimum for this one — not something a
              // normal pick flow can trigger on its own. Surfacing why
              // (rather than a silently disabled button) points at the
              // actual fix: an earlier pick needs to be lowered first.
              <p className="error-text">
                Only ${effectiveStake} is left for this pick — below the ${MIN_STAKE} minimum. This
                usually means a game/prop was added to this week after earlier picks were already
                saved; lower an earlier pick's stake to free up room.
              </p>
            )}
            {!locked && !isLastPick && wouldExceedBudget && (
              <p className="error-text">
                {reserveForOtherSlots > 0
                  ? `That would leave less than $${MIN_STAKE} for your other unpicked slots this week ($${reserveForOtherSlots} needs to stay reserved).`
                  : `That would put you at $${projectedTotal} for the week — over the $${budget} budget.`}
              </p>
            )}
            {error && <p className="error-text">{error}</p>}
            {locked && !existingPick && <p className="meta">No pick was submitted before kickoff.</p>}
          </div>
        )}
      </div>
      {game && spreadOptions && !locked && (
        <div className="ledger-control">
          <label>
            $
            <input
              type="number"
              min={MIN_STAKE}
              step={1}
              value={isLastPick ? effectiveStake : spreadStake}
              onChange={(e) => setSpreadStake(Number(e.target.value))}
              disabled={locked || isLastPick}
              style={{ width: '5rem', marginLeft: 4, marginRight: 8 }}
            />
          </label>
          <button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Save Pick'}
          </button>
        </div>
      )}
    </div>
  )
}
