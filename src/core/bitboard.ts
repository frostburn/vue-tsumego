/**
 * Stones of a single color represented as row-wise bitmasks.
 */
export type Stones = Uint16Array

/**
 * Coordinates for a single stone (`-1, -1` represents pass).
 */
export type Coords = {
  x: number
  y: number
}

/**
 * Fixed internal bitboard width.
 */
export const WIDTH = 16
/**
 * Default bitboard height.
 */
export const HEIGHT = 16 // Not a hard limit, arrays may be trimmed for efficiency

// Note: Bitboard semantics are mirrored from numeric rendering
const EAST_STONE_32 = 0b10000000000000000000000000000000

/**
 * Obtain an empty bitboard stack of stones.
 * @param height Height of the bitboard array.
 * @returns An empty goban.
 */
export function emptyStones(height = HEIGHT): Stones {
  return new Uint16Array(height)
}

/**
 * Obtain a random collection of stones.
 * @param height Height of the bitboard array.
 * @returns A gobanful with 50% chance of air or stones.
 */
export function randomStones(height = HEIGHT): Stones {
  const stones = emptyStones(height)
  for (let i = 0; i < height; ++i) {
    stones[i] = Math.random() * 2 ** WIDTH
  }
  return stones
}

/**
 * Clone a collection of stones.
 * @param stones A collection of stones to copy.
 * @returns A copy of the stones.
 */
export function clone(stones: Stones): Stones {
  return new Uint16Array(stones)
}

/**
 * Produce lines of ASCII from the stone collection using @ for stones and . for empty space.
 * @param stones Stones to render.
 * @returns Array of printable board lines.
 */
export function stoneDisplayLines(stones: Stones): string[] {
  const result = ['┌─' + '──'.repeat(WIDTH) + '┐']
  for (let y = 0; y < stones.length; ++y) {
    let line = '│'
    for (let x = 0; x < WIDTH; ++x) {
      if (stones[y]! & (1 << x)) {
        line += ' @'
      } else {
        line += ' .'
      }
    }
    line += ' │'
    result.push(line)
  }
  result.push('└─' + '──'.repeat(WIDTH) + '┘')
  return result
}

/**
 * Render stones of a single color in ASCII using @ for stones and . for empty space.
 * @param stones Stones to log.
 * @returns Nothing.
 */
export function logStones(stones: Stones): void {
  console.log(stoneDisplayLines(stones).join('\n'))
}

/**
 * Create a collection consisting of only a single stone at the given coordinates.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @param height Logical height of the resulting bitboard
 * @returns A collection of a single stone or nothing if `x` is negative.
 */
export function single(x: number, y: number, height = HEIGHT): Stones {
  if (x < 0 || x >= WIDTH) {
    return emptyStones(height)
  }
  const result = emptyStones(height)
  result[y] = 1 << x
  return result
}

/**
 * Test if a collection of stones is all empty space.
 * @param stones A collection of stones.
 * @returns `true` if there aren't any stones present.
 */
export function isEmpty(stones: Stones) {
  for (let i = 0; i < stones.length; ++i) {
    if (stones[i]) {
      return false
    }
  }
  return true
}

/**
 * Test if a collection has at least one stone.
 * @param stones A collection of stones.
 * @returns `true` if there is a stones present.
 */
export function isNonEmpty(stones: Stones) {
  for (let i = 0; i < stones.length; ++i) {
    if (stones[i]) {
      return true
    }
  }
  return false
}

/**
 * Clears a stone collection in-place.
 * @param stones Stones to mutate.
 * @returns Nothing.
 */
export function clear(stones: Stones) {
  stones.fill(0)
}

/**
 * Tests whether two collections are equal when trailing zero rows are ignored.
 * @param a First stone collection.
 * @param b Second stone collection.
 * @returns `true` when both collections represent the same occupied points.
 */
export function equals(a: Stones, b: Stones) {
  if (a.length > b.length) {
    ;[a, b] = [b, a]
  }
  for (let i = 0; i < a.length; ++i) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  for (let i = a.length; i < b.length; ++i) {
    if (b[i]) {
      return false
    }
  }
  return true
}

/**
 * Tests whether two collections share at least one occupied intersection.
 * @param a First stone collection.
 * @param b Second stone collection.
 * @returns `true` when both collections overlap.
 */
export function overlaps(a: Stones, b: Stones) {
  for (let i = Math.min(a.length, b.length) - 1; i >= 0; --i) {
    if (a[i]! & b[i]!) {
      return true
    }
  }
  return false
}

/**
 * Add stones from `...rest` to `a`, modifying `a` in place.
 * @param a Stones to merge into.
 * @param rest Stones to merge.
 * @throws An error if `a` doesn't have the height to merge the stones
 * @returns `a` for chaining
 */
export function merge(a: Stones, ...rest: Stones[]) {
  for (const b of rest) {
    if (a.length < b.length) {
      throw new Error(`The target height ${a.length} is less than source height ${b.length}.`)
    }
    for (let i = 0; i < a.length; ++i) {
      // XXX: Abuses `undefined` aliasing to `0`
      a[i]! |= b[i]!
    }
  }
  return a
}

/**
 * Constrain stones in `a` to those in all of `...rest`, modifying `a` in place.
 * @param a Stones to mask.
 * @param rest Stones to mask by.
 * @returns `a` for chaining
 */
export function mask(a: Stones, ...rest: Stones[]) {
  for (const b of rest) {
    for (let i = 0; i < a.length; ++i) {
      // XXX: Abuses `undefined` aliasing to `0`
      a[i]! &= b[i]!
    }
  }
  return a
}

/**
 * Flip stones in `a` to empty space and vice-versa according to `...rest`, modifying `a` in place.
 * @param a Stones to flip.
 * @param rest Places to be flipped.
 * @throws An error if `a` doesn't have the height to flip the stones
 * @returns `a` for chaining
 */
export function flip(a: Stones, ...rest: Stones[]) {
  for (const b of rest) {
    if (a.length < b.length) {
      throw new Error(`The target height ${a.length} is less than source height ${b.length}.`)
    }
    for (let i = 0; i < a.length; ++i) {
      // XXX: Abuses `undefined` aliasing to `0`
      a[i]! ^= b[i]!
    }
  }
  return a
}

/**
 * Remove stones `...rest` from `a`, modifying `a` in place.
 * @param a Stones to subtract from.
 * @param rest Stones to subtract.
 * @returns `a` for chaining
 */
export function subtract(a: Stones, ...rest: Stones[]) {
  for (const b of rest) {
    for (let i = 0; i < a.length; ++i) {
      a[i]! &= ~b[i]!
    }
  }
  return a
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 16-bit integer.
 * @param x 16-bit integer.
 * @returns The number of set bits in the input.
 */
export function popcount16(x: number) {
  x -= (x >> 1) & 0x5555
  x = (x & 0x3333) + ((x >> 2) & 0x3333)
  x = (x + (x >> 4)) & 0x0f0f
  return (x + (x >> 8)) & 0x1f
}

/**
 * Population count (aka hamming weight) function. Counts the number of set (i.e. 1-valued) bits in a 32-bit integer.
 * @param x 32-bit integer.
 * @returns The number of set bits in the input.
 */
export function popcount(x: number) {
  x -= (x >> 1) & 0x55555555
  x = (x & 0x33333333) + ((x >> 2) & 0x33333333)
  x = (x + (x >> 4)) & 0x0f0f0f0f
  x += x >> 8
  x += x >> 16

  return x & 0x7f
}

/**
 * Counts stones in a collection.
 * @param stones Stones to count.
 * @returns Number of occupied intersections.
 */
export function stonesCount(stones: Stones) {
  return stones.map(popcount16).reduce((a, b) => a + b, 0)
}

/**
 * Perform a flood-fill of the source bitboard into the target without masking. Modifies source in-place.
 * @param source Small bitboard pattern to expand.
 * @param target Bitboard pattern to constrain the expansion.
 * @returns Nothing.
 */
export function bleed(source: Stones, target: Stones) {
  if (isEmpty(source)) {
    return
  }

  const len = source.length
  const temp = new Uint16Array(source)
  flooding: while (true) {
    source[0]! |= (source[1]! | (source[0]! >>> 1) | (source[0]! << 1)) & target[0]!

    for (let i = 1; i < len - 1; ++i) {
      source[i]! |=
        (source[i - 1]! | (source[i]! >>> 1) | (source[i]! << 1) | source[i + 1]!) & target[i]!
    }

    source[len - 1]! |=
      (source[len - 2]! | (source[len - 1]! >>> 1) | (source[len - 1]! << 1)) & target[len - 1]!

    for (let i = 0; i < len; ++i) {
      if (temp[i]! !== source[i]!) {
        for (let j = 0; j < len; ++j) {
          temp[j] = source[j]!
        }
        continue flooding
      }
    }
    break
  }
}

/**
 * Perform a flood-fill of the source bitboard into the target. Modifies source in-place.
 * @param source Small bitboard pattern to expand.
 * @param target Bitboard pattern to constrain the expansion.
 * @returns Nothing.
 */
export function flood(source: Stones, target: Stones) {
  mask(source, target)
  bleed(source, target)
}

/**
 * Returns the maximum occupied x-extent of a stone collection.
 * @param stones Stones to measure.
 * @returns Width required to contain all stones.
 */
export function widthOf(stones: Stones): number {
  return stones.reduce((acc, cur) => Math.max(acc, 32 - Math.clz32(cur)), 0)
}

/**
 * Returns the maximum occupied y-extent of a stone collection.
 * @param stones Stones to measure.
 * @returns Height required to contain all stones.
 */
export function heightOf(stones: Stones): number {
  let result = 0
  for (let j = 0; j < stones.length; ++j) {
    if (stones[j]) {
      result = j + 1
    }
  }
  return result
}

/**
 * Creates a filled rectangle bitboard.
 * @param width Rectangle width.
 * @param height Rectangle height.
 * @param trueHeight Optional backing-array height.
 * @returns Rectangle stones bitboard.
 */
export function rectangle(width: number, height: number, trueHeight?: number): Stones {
  const result = emptyStones(trueHeight ?? height)
  if (!width || !height) {
    return result
  }
  // Note that 32-bit fields would need a hack
  // width === WIDTH ? ~0 : (1 << width) - 1

  result.fill((1 << width) - 1)
  for (let i = height; i < result.length; ++i) {
    result[i] = 0
  }
  return result
}

/**
 * Returns the bitwise AND of one or more stone collections.
 * @param stones Base stones value.
 * @param rest Additional masks.
 * @returns New stones containing only shared points.
 */
export function stonesAnd(stones: Stones, ...rest: Stones[]): Stones {
  const result = clone(stones)
  for (const b of rest) {
    for (let i = 0; i < result.length; ++i) {
      result[i]! &= b[i]!
    }
  }
  return result
}

/**
 * Returns the bitwise OR of one or more stone collections.
 * @param rest Stones to combine.
 * @returns New stones containing all occupied points.
 */
export function stonesOr(...rest: Stones[]): Stones {
  const height = rest.reduce((acc, cur) => Math.max(acc, cur.length), 0)
  const result = emptyStones(height)
  for (const b of rest) {
    for (let i = 0; i < height; ++i) {
      result[i]! |= b[i]!
    }
  }
  return result
}

/**
 * Returns the bitwise XOR of one or more stone collections.
 * @param rest Stones to combine.
 * @returns New stones with odd-parity occupancy.
 */
export function stonesXor(...rest: Stones[]): Stones {
  const height = rest.reduce((acc, cur) => Math.max(acc, cur.length), 0)
  const result = emptyStones(height)
  for (const b of rest) {
    for (let i = 0; i < height; ++i) {
      result[i]! ^= b[i]!
    }
  }
  return result
}

/**
 * Inverts a stone collection and pads full rows up to `height`.
 * @param stones Source stones.
 * @param height Output height.
 * @returns Inverted stone collection.
 */
export function stonesNot(stones: Stones, height = HEIGHT): Stones {
  const result = emptyStones(height)
  for (let i = 0; i < result.length; ++i) {
    result[i]! = ~stones[i]!
  }
  return result
}

/**
 * Inverts a stone collection in-place.
 * @param stones Stones to invert.
 * @returns The same mutated stones object.
 */
export function invertInPlace(stones: Stones): Stones {
  for (let i = 0; i < stones.length; ++i) {
    stones[i]! = ~stones[i]!
  }
  return stones
}

/**
 * Computes liberty points adjacent to stones constrained by `empty`.
 * @param stones Stones to evaluate.
 * @param empty Intersections that count as empty.
 * @returns Liberty intersections.
 */
export function liberties(stones: Stones, empty: Stones): Stones {
  const len = empty.length
  const result = emptyStones(len)
  result[0] = ((stones[0]! << 1) | (stones[0]! >>> 1) | stones[1]!) & ~stones[0]! & empty[0]!
  for (let i = 1; i < len - 1; ++i) {
    result[i]! =
      (stones[i - 1]! | (stones[i]! << 1) | (stones[i]! >>> 1) | stones[i + 1]!) &
      ~stones[i]! &
      empty[i]!
  }
  result[len - 1]! =
    (stones[len - 2]! | (stones[len - 1]! << 1) | (stones[len - 1]! >>> 1)) &
    ~stones[len - 1]! &
    empty[len - 1]!
  return result
}

/**
 * Shifts all stones one row toward the top of the board.
 * @param stones Source stones.
 * @returns Shifted stones.
 */
export function north(stones: Stones): Stones {
  const result = clone(stones)
  result.copyWithin(0, 1)
  result[result.length - 1] = 0
  return result
}

/**
 * Shifts all stones one row toward the bottom of the board.
 * @param stones Source stones.
 * @returns Shifted stones.
 */
export function south(stones: Stones): Stones {
  const result = clone(stones)
  result.copyWithin(1, 0)
  result[0] = 0
  return result
}

/**
 * Shifts all stones downward by `amount`, extending board height.
 * @param stones Source stones.
 * @param amount Number of rows to shift by.
 * @returns Shifted stones with expanded height.
 */
export function southPlus(stones: Stones, amount = 1): Stones {
  const result = emptyStones(stones.length + amount)
  for (let i = 0; i < stones.length; ++i) {
    result[i + amount] = stones[i]!
  }
  return result
}

/**
 * Shifts all stones one column west (left).
 * @param stones Source stones.
 * @returns Shifted stones.
 */
export function west(stones: Stones): Stones {
  const result = clone(stones)
  for (let i = 0; i < stones.length; ++i) {
    result[i]! >>>= 1
  }
  return result
}

/**
 * Shifts all stones one column east (right).
 * @param stones Source stones.
 * @returns Shifted stones.
 */
export function east(stones: Stones): Stones {
  const result = clone(stones)
  for (let i = 0; i < stones.length; ++i) {
    result[i]! <<= 1
  }
  return result
}

/**
 * Tests whether a collection contains exactly one stone.
 * @param stones Stones to evaluate.
 * @returns `true` if exactly one stone is set.
 */
export function isSingle(stones: Stones): boolean {
  let i
  for (i = 0; i < stones.length; ++i) {
    if (stones[i]) {
      if (stones[i]! & (stones[i]! - 1)) {
        return false
      }
      for (i++; i < stones.length; ++i) {
        if (stones[i]) {
          return false
        }
      }
      return true
    }
  }
  return false
}

/**
 * Test if there is a stone in the collection at the given coordinates.
 * @param stones A collection of stones.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns `true` if there is a stone at the given coordinates.
 */
export function stoneAt(stones: Stones, x: number, y: number): boolean {
  // XXX: Abuses `undefined` aliasing to `0`
  return !!(stones[y]! & (1 << x))
}

/**
 * Splits a collection into one-stone bitboards.
 * @param stones Source stones.
 * @returns One-stone bitboards for each occupied point.
 */
export function dots(stones: Stones): Stones[] {
  const len = stones.length
  const result: Stones[] = []
  for (let i = 0; i < len; ++i) {
    let slice = stones[i]
    let p = 1
    while (slice) {
      if (slice & p) {
        const dot = emptyStones(len)
        dot[i] = p
        result.push(dot)
        slice ^= p
      }
      p <<= 1
    }
  }
  return result
}

/**
 * Splits stones into 4-connected chains.
 * @param stones Source stones.
 * @returns One bitboard per connected chain.
 */
export function chains(stones: Stones): Stones[] {
  stones = clone(stones)
  const result: Stones[] = []
  for (let i = 0; i < stones.length; ++i) {
    for (let j = 0; j < WIDTH; j += 2) {
      const chain = emptyStones(stones.length)
      chain[i] = 3 << j
      if (overlaps(chain, stones)) {
        flood(chain, stones)
        subtract(stones, chain)
        result.push(chain)
      }
    }
  }
  return result
}

/**
 * Removes up to `amount` north-eastern-most stones, mutating `stones`.
 * @param stones Stones to mutate.
 * @param amount Number of stones to remove.
 * @returns Nothing.
 */
export function witherBy(stones: Stones, amount: number) {
  for (let i = 0; i < stones.length; ++i) {
    while (stones[i] && amount) {
      stones[i]! ^= EAST_STONE_32 >>> Math.clz32(stones[i]!)
      amount--
    }
  }
}

/**
 * Converts a one-stone move bitboard into x/y coordinates.
 * @param move Move bitboard.
 * @returns Coordinates of the move, or `(-1, -1)` for pass.
 */
export function coordsOf(move: Stones): Coords {
  for (let y = 0; y < move.length; ++y) {
    if (move[y]) {
      return {
        x: 31 - Math.clz32(move[y]!),
        y,
      }
    }
  }
  return {
    x: -1,
    y: -1,
  }
}

/**
 * Converts a collection into an array of occupied coordinates.
 * @param stones Stones to expand.
 * @returns List of occupied coordinates.
 */
export function gridOf(stones: Stones): Coords[] {
  const result: Coords[] = []
  for (let y = 0; y < stones.length; ++y) {
    if (stones[y]) {
      for (let x = 0; x < WIDTH; ++x) {
        if (stones[y]! & (1 << x)) {
          result.push({ x, y })
        }
      }
    }
  }
  return result
}

/**
 * Convert an `Array` of numbers to `Stones`.
 * Pads zeros up to `height` if provided
 * @param slices Row bitmasks.
 * @param height Optional target height.
 * @returns Stones representation.
 */
export function arrayToStones(slices: number[], height?: number): Stones {
  const result = emptyStones(height ?? slices.length)
  for (let i = 0; i < slices.length; ++i) {
    result[i] = slices[i]!
  }
  return result
}

/**
 * Convert `Stones` to an `Array` of numbers.
 * @param stones Stones to serialize.
 * @returns Trimmed row bitmask array.
 */
export function stonesToArray(stones: Stones): number[] {
  const result = Array.from(stones)
  while (result.length && !result[result.length - 1]) {
    result.pop()
  }
  return result
}

/**
 * Resizes a stone collection to `height`, truncating or zero-padding as needed.
 * @param stones Stones to resize.
 * @param height Target height.
 * @returns Resized stones.
 */
export function toHeight(stones: Stones, height = HEIGHT): Stones {
  if (stones.length === height) {
    return stones
  }
  if (stones.length > height) {
    return stones.slice(0, height)
  }
  const result = emptyStones(height)
  for (let i = 0; i < stones.length; ++i) {
    result[i] = stones[i]!
  }
  return result
}
