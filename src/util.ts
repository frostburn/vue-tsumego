import { arrayToStones } from './core/bitboard'
import { State, type StateJSON } from './core/state'
import { type SolutionInfo, type MoveInfo, encode, decode } from './core/solver'

/**
 * Minimum supported board width for layout and puzzle rendering.
 */
export const MIN_WIDTH = 9
/**
 * Minimum supported board height for layout and puzzle rendering.
 */
export const MIN_HEIGHT = 7

/**
 * API payload returned by the solver endpoint for a particular position.
 */
type SolutionResponse = SolutionInfo & {
  deadStones?: number[]
}

/**
 * API payload describing a collection root position.
 */
export type CollectionRootResponse = {
  title: string
  root: StateJSON
  canStretch?: boolean
}

/**
 * API payload used by the explore route.
 */
export type ExploreResponse = CollectionRootResponse & {
  state?: StateJSON
}

/**
 * API payload used by single tsumego problem pages.
 */
export type TsumegoResponse = {
  title: string
  subtitle: string
  state: StateJSON
  botToPlay?: boolean
  canStretch?: boolean
}

/**
 * Formats a raw loss value for compact UI display.
 * @param loss Points lost for a sequence of moves.
 * @returns Human-friendly loss string used in move labels.
 */
export function formatLoss(loss: number) {
  if (loss > 100) {
    return 'Ω'
  }
  return loss.toFixed(1)
}

/**
 * Formats a move's low gain value for compact UI display.
 * @param info Solver metadata for a candidate move.
 * @returns Human-friendly gain string used in move labels.
 */
export function formatGain(info: MoveInfo) {
  return '-' + formatLoss(-info.lowGain)
}

/**
 * Produces a color for rendering move quality using a perceptual HSL ramp.
 * @param info Solver metadata for a candidate move.
 * @returns CSS color string used to paint move quality.
 */
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

/**
 * Computes style overrides for rendering the pass move in the move list.
 * @param info Optional solution information for the current position.
 * @returns CSS style object for the pass indicator.
 */
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

/**
 * Base API URL normalized against the current window origin.
 */
export const API_URL = new URL(import.meta.env.VITE_API_URL, window.location.origin)

/**
 * Fetches JSON and throws on non-2xx responses.
 * @param input Request URL or request descriptor.
 * @param init Optional fetch init object.
 * @returns Parsed JSON response body typed as `T`.
 */
export async function fetchJson<T>(input: URL | RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}

/**
 * Requests solution metadata for a collection/state pair.
 * @param collection Collection identifier used by the backend API.
 * @param state State payload or full state object to serialize.
 * @returns Solver response including move scores and optional dead stones.
 */
export async function getSolutionInfo(
  collection: string,
  state: State | { state: StateJSON },
  init?: RequestInit,
) {
  if (state instanceof State) {
    state = { state: state.toJSON() }
  }
  const { headers, ...rest } = init ?? {}
  return await fetchJson<SolutionResponse>(new URL(`tsumego/${collection}/`, API_URL), {
    ...rest,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(state),
  })
}

/**
 * Marks dead stones on a state using solver output.
 * @param collection Collection identifier used by the backend API.
 * @param state Mutable state to update with server-provided dead stones.
 * @returns Resolves when dead-stone metadata has been applied.
 */
export async function markDeadStones(collection: string, state: State, init?: RequestInit) {
  const json = await getSolutionInfo(collection, state, init)
  state.dead = arrayToStones(json.deadStones ?? [], state.height)
}

/**
 * URL-safe base64 alphabet used for query key encoding.
 */
const URL_SAFE_CHARS64 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-_'

/**
 * Encodes a non-negative integer using a URL-safe base64 alphabet.
 * @param n Non-negative integer to encode.
 * @returns URL-safe compact string representation.
 */
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

/**
 * Decodes a URL-safe base64 integer string produced by {@link encode64}.
 * @param s URL-safe encoded integer string.
 * @returns Decoded non-negative integer.
 */
export function decode64(s: string): number {
  let result = 0
  for (let i = s.length - 1; i >= 0; --i) {
    const digit = URL_SAFE_CHARS64.indexOf(s[i]!)
    if (digit < 0) {
      throw new Error(`Invalid query encoding: unexpected character "${s[i]}"`)
    }
    result = result * 64 + digit
  }
  return result
}

/**
 * Decodes a query key into a full board state relative to a root state.
 * @param root Root puzzle state used as encoding context.
 * @param s Encoded query value.
 * @returns Decoded state instance.
 */
export function decodeQuery(root: State, s: string): State {
  return decode(root, decode64(s))
}

/**
 * Encodes a board state into a compact URL query key relative to a root state.
 * @param root Root puzzle state used as encoding context.
 * @param state Child state to encode.
 * @returns URL-safe encoded query string.
 */
export function encodeQuery(root: State, state: State): string {
  return encode64(encode(root, state))
}
