import type { Game } from '../types'

export function hasKickedOff(game: Game, now: Date): boolean {
  return game.kickoffTime.toDate().getTime() <= now.getTime()
}
