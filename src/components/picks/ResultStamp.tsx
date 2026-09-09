import type { PickResult } from '../../types'

interface ResultStampProps {
  result: PickResult
}

// STYLE_GUIDE.md's one decorative flourish: a rotated, rubber-stamp-style
// badge for a SETTLED result, colored money-green (win), loss-rust
// (loss), or plain ink (push). Deliberately used ONLY here — not as a
// general-purpose status pill elsewhere in the app — and pending results
// render as plain meta text instead of a stamp, since "pending" isn't a
// real graded outcome yet. The `stamp--animate` class plays the one-time
// "stamping down" keyframe (see index.css) the moment this element is
// first inserted into the DOM; it won't replay on later re-renders of
// the same element, since CSS animations only (re)start on mount or when
// the animation itself changes.
export function ResultStamp({ result }: ResultStampProps) {
  if (result === 'pending') return <span className="meta">pending</span>

  const label = result === 'win' ? 'WIN' : result === 'loss' ? 'LOSS' : 'PUSH'
  const modifier =
    result === 'win' ? 'stamp--win' : result === 'loss' ? 'stamp--loss' : 'stamp--push'

  return <span className={`stamp ${modifier} stamp--animate`}>{label}</span>
}
