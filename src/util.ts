import { arrayToStones } from './core/bitboard'
import { State, type StateJSON } from './core/state'
import { type SolutionInfo, type MoveInfo, encode, decode } from './core/solver'

export const MIN_WIDTH = 9
export const MIN_HEIGHT = 7

type SolutionResponse = SolutionInfo & {
  deadStones?: number[]
}

export type CollectionRootResponse = {
  title: string
  root: StateJSON
  canStretch?: boolean
}

export type ExploreResponse = CollectionRootResponse & {
  state?: StateJSON
}

export type TsumegoResponse = {
  title: string
  subtitle: string
  state: StateJSON
  botToPlay?: boolean
  canStretch?: boolean
}

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

export async function fetchJson<T>(input: URL | RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

export async function getSolutionInfo(collection: string, state: State | { state: StateJSON }) {
  if (state instanceof State) {
    state = { state: state.toJSON() }
  }
  return await fetchJson<SolutionResponse>(new URL(`tsumego/${collection}/`, API_URL), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(state),
  })
}

export async function markDeadStones(collection: string, state: State) {
  const json = await getSolutionInfo(collection, state)
  state.dead = arrayToStones(json.deadStones ?? [], state.height)
}

const URL_SAFE_CHARS64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'

export function encode64(n: number): string {
  if (n < 0 || !Number.isInteger(n)) {
    throw new Error('Input must be a non-negative integer')
  }
  let result = ''
  while (n) {
    result += URL_SAFE_CHARS64[n % 64]
    n = Math.floor(n / 64)
  }
  return result
}

export function decode64(s: string): number {
  let result = 0
  for (let i = s.length - 1; i >= 0; --i) {
    result = result * 64 + URL_SAFE_CHARS64.indexOf(s[i]!)
  }
  return result
}

export function decodeQuery(root: State, s: string): State {
  return decode(root, decode64(s))
}

export function encodeQuery(root: State, state: State): string {
  return encode64(encode(root, state))
}
