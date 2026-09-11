import { useState } from 'react'
import { useUsers } from '../../hooks/useUsers'
import { MIN_STAKE } from '../../lib/constants'
import { updatePickDetails } from '../../lib/picks'
import { getSpreadOptions } from '../../lib/spreadOptions'
import type { Game, Pick, TotalSide } from '../../types'

interface EditPicksSectionProps {
  games: Game[]
  picksInWeek: Pick[]
}

// Admin correction tool for a pick that's already locked (kickoff passed).
// PickSlot.tsx's "locked (kickoff passed)" state is UI-only — Firestore's
// rules don't actually enforce it (see firestore.rules' top comment on the
// deliberate no-auth tradeoff) — but until now there was no path in the
// app itself to fix a wrong side or stake once a user could no longer edit
// their own pick. This is that path, scoped to the currently-selected
// week's picks (same as GamesList/EditGameForm above it on the Admin page).
export function EditPicksSection({ games, picksInWeek }: EditPicksSectionProps) {
  const users = useUsers()

  // Missed picks (isDefaultLoss) are permanently spreadSide: '' / result:
  // 'loss' by definition (PROJECT_SPEC.md Section 4.3) — there's no real
  // side/stake to correct, so they're left out of this list entirely
  // rather than offering an edit control that doesn't apply to them.
  const editablePicks = picksInWeek.filter((p) => !p.isDefaultLoss)

  if (editablePicks.length === 0) {
    return null
  }

  return (
    <div>
      <h3>Edit Picks (fix a wrong side or stake)</h3>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Type</th>
              <th>Game</th>
              <th>Spread Pick</th>
              <th>Stake</th>
              <th>Total Pick</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {editablePicks.map((pick) => {
              const game = games.find((g) => g.id === pick.gameId)
              return (
                <PickRow
                  key={pick.id}
                  pick={pick}
                  game={game}
                  userName={users.find((u) => u.id === pick.userId)?.name ?? pick.userId}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function PickRow({
  pick,
  game,
  userName,
}: {
  pick: Pick
  game: Game | undefined
  userName: string
}) {
  const [editing, setEditing] = useState(false)
  const [spreadSide, setSpreadSide] = useState(pick.spreadSide)
  const [spreadStake, setSpreadStake] = useState(pick.spreadStake)
  const [totalSide, setTotalSide] = useState<TotalSide | ''>(pick.totalSide ?? '')
  const [saving, setSaving] = useState(false)

  const spreadOptions = game ? getSpreadOptions(game) : null

  // A game without a `total` set has no over/under line to pick against —
  // same gating PickSlot.tsx uses to decide whether to show the total
  // controls at all.
  const totalAvailable = game?.total != null

  const canSave = spreadSide !== '' && spreadStake >= MIN_STAKE

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    try {
      // PROJECT_SPEC.md Section 4.3: the total's stake always mirrors the
      // spread stake exactly, never entered independently — so there's no
      // separate stake input for it above, just derived here to match
      // firestore.rules' isValidPick check.
      await updatePickDetails(pick.id, {
        spreadSide,
        spreadStake,
        totalSide: totalSide === '' ? null : totalSide,
        totalStake: totalSide === '' ? null : spreadStake,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setSpreadSide(pick.spreadSide)
    setSpreadStake(pick.spreadStake)
    setTotalSide(pick.totalSide ?? '')
    setEditing(false)
  }

  if (!editing) {
    return (
      <tr>
        <td>{userName}</td>
        <td>{pick.pickType}</td>
        <td>{game ? `${game.awayTeam} @ ${game.homeTeam}` : pick.gameId}</td>
        <td>{pick.spreadSide}</td>
        <td>${pick.spreadStake}</td>
        <td>{pick.totalSide ?? '—'}</td>
        <td>
          {pick.result}
          {pick.totalResult ? ` / ${pick.totalResult}` : ''}
        </td>
        <td>
          <button onClick={() => setEditing(true)} disabled={!game}>
            Edit
          </button>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td>{userName}</td>
      <td>{pick.pickType}</td>
      <td>{game ? `${game.awayTeam} @ ${game.homeTeam}` : pick.gameId}</td>
      <td>
        {spreadOptions ? (
          <select value={spreadSide} onChange={(e) => setSpreadSide(e.target.value)}>
            {spreadOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.value}
              </option>
            ))}
          </select>
        ) : (
          // Falls back to a free-text input if this game has no spread set
          // (spreadSide was presumably saved before one existed, or the
          // admin cleared it) — still editable, just without a dropdown of
          // valid choices to pick from.
          <input type="text" value={spreadSide} onChange={(e) => setSpreadSide(e.target.value)} />
        )}
      </td>
      <td>
        <input
          type="number"
          value={spreadStake}
          onChange={(e) => setSpreadStake(Number(e.target.value))}
          min={MIN_STAKE}
          step={1}
          style={{ width: 70 }}
        />
      </td>
      <td>
        <select
          value={totalSide}
          onChange={(e) => setTotalSide(e.target.value as TotalSide | '')}
          disabled={!totalAvailable}
        >
          <option value="">— none —</option>
          <option value="over">Over</option>
          <option value="under">Under</option>
        </select>
      </td>
      <td>
        {pick.result}
        {pick.totalResult ? ` / ${pick.totalResult}` : ''}
      </td>
      <td>
        <button onClick={handleSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>{' '}
        <button onClick={handleCancel} disabled={saving}>
          Cancel
        </button>
      </td>
    </tr>
  )
}
