import { padStones } from './core/bitboard'
import { State, type StateJSON } from './core/state'
import { type SolutionInfo, type MoveInfo } from './core/solver'

export const MIN_WIDTH = 9
export const MIN_HEIGHT = 7

export function formatGain(info: MoveInfo) {
  const gain = info.lowGain
  if (gain < -100) {
    return '-Ω'
  }
  if (!gain) {
    return '-0.0'
  }
  return gain.toFixed(1)
}

export function fillGain(info: MoveInfo) {
  const x = -info.lowGain
  if (x > 100) {
    return 'purple'
  }
  const h = 90 - 7 * x
  const s = 100 / (0.05 * x + 1)
  const l = 52 / (0.014 * x + 1)
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`
}

export function passStyle(info: SolutionInfo | undefined) {
  if (info === undefined) {
    return { 'background-color': 'green', 'border-color': 'darkgreen' }
  }
  for (const move of info.moves) {
    if (move.x < 0) {
      const fill = fillGain(move)
      if (move.lowIdeal) {
        return { 'background-color': fill, 'border-color': 'dodgerblue' }
      } else {
        return { 'background-color': fill, 'border-color': `hsl(from ${fill} h s calc(l - 20))` }
      }
    }
  }
  return {}
}

// Normalize http://localhost:8xxx vs. /api/
export const API_URL = new URL(import.meta.env.VITE_API_URL, window.location.origin)

export async function getSolutionInfo(collection: string, state: State | { state: StateJSON }) {
  if (state instanceof State) {
    state = { state: state.toJSON() }
  }
  const response = await fetch(new URL(`tsumego/${collection}/`, API_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  })
  return await response.json()
}

export async function markDeadStones(collection: string, state: State) {
  const json = await getSolutionInfo(collection, state)
  state.dead = padStones(json.deadStones)
}
