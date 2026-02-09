// Stones of a single color are represented as bitboard consisting of 19 unsigned integers
// The height of the goban is fixed at 19
export type Stones = Uint32Array

// Coordinates for a single stone or -1, -1 for a pass
export type Coords = {
  x: number
  y: number
}

// Bitboard constants
export const WIDTH = 32
export const HEIGHT = 19

const EAST_STONE = 2147483648

// Large scale structure
export const NUM_SLICES = HEIGHT

/**
 * Obtain an empty bitboard stack of stones.
 * @returns An empty goban.
 */
export function emptyStones(): Stones {
  return new Uint32Array(NUM_SLICES)
}

/**
 * Obtain a random collection of stones.
 * @returns A gobanful with 50% chance of air or stones.
 */
export function randomStones(): Stones {
  const stones = emptyStones()
  for (let i = 0; i < NUM_SLICES; ++i) {
    stones[i] = Math.random() * 2 ** 32
  }
  return stones
}

/**
 * Clone a collection of stones.
 * @param stones A collection of stones to copy.
 * @returns A copy of the stones.
 */
export function clone(stones: Stones): Stones {
  return new Uint32Array(stones)
}

/**
 * Produce lines of ASCII from the stone collection using @ for stones and . for empty space.
 */
export function stoneDisplayLines(stones: Stones): string[] {
  const result = ['┌─' + '──'.repeat(WIDTH) + '┐']
  for (let y = 0; y < stones.length; ++y) {
    let line = '│'
    for (let x = 0; x < WIDTH; ++x) {
      if (stones[y] & (1 << x)) {
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
 */
export function logStones(stones: Stones): void {
  console.log(stoneDisplayLines(stones).join('\n'))
}

/**
 * Create a collection consisting of only a single stone at the given coordinates.
 * @param x Horizontal coordinate. 0-indexed, left to right.
 * @param y Vertical coordinate. 0-indexed, top to bottom.
 * @returns A collection of a single stone or nothing if `x` is negative.
 */
export function single(x: number, y: number): Stones {
  const result = emptyStones()
  if (x >= 0) {
    result[y] = 1 << x
  }
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

// Clear a collection of stones in-place
export function clear(stones: Stones) {
  stones.fill(0)
}

export function equals(a: Stones, b: Stones) {
  for (let i = 0; i < NUM_SLICES; ++i) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export function overlaps(a: Stones, b: Stones) {
  for (let i = 0; i < NUM_SLICES; ++i) {
    if (a[i] & b[i]) {
      return true
    }
  }
  return false
}

/**
 * Add stones from `b` to `a`, modifying `a` in place.
 * @param a Stones to merge into.
 * @param b Stones to merge.
 */
export function merge(a: Stones, b: Stones) {
  for (let i = 0; i < a.length; ++i) {
    a[i] |= b[i]
  }
}

/**
 * Constrain stones in `a` to those in `b`, modifying `a` in place.
 * @param a Stones to mask.
 * @param b Stones to mask by.
 */
export function mask(a: Stones, b: Stones) {
  for (let i = 0; i < a.length; ++i) {
    a[i] &= b[i]
  }
}

/**
 * Flip stones in `a` from empty space and vice-versa according to `b`
 * @param a Stones to flip.
 * @param b Places to be flipped.
 */
export function flip(a: Stones, b: Stones) {
  for (let i = 0; i < a.length; ++i) {
    a[i] ^= b[i]
  }
}

/**
 * Remove stones `b` from `a`, modifying `a` in place.
 * @param a Stones to subtract from.
 * @param b Stones to subtract.
 */
export function subtract(a: Stones, b: Stones) {
  for (let i = 0; i < a.length; ++i) {
    a[i] &= ~b[i]
  }
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

export function stonesCount(stones: Stones) {
  return stones.map(popcount).reduce((a, b) => a + b)
}

/**
 * Perform a flood-fill of the source bitboard into the target without masking. Modifies source in-place.
 * @param source Small bitboard pattern to expand.
 * @param target Bitboard pattern to constrain the expansion.
 */
export function bleed(source: Stones, target: Stones) {
  if (isEmpty(source)) {
    return
  }

  const temp = new Uint32Array(source)
  flooding: while (true) {
    source[0] |= (source[1] | (source[0] >>> 1) | (source[0] << 1)) & target[0]

    for (let i = 1; i < NUM_SLICES - 2; ++i) {
      source[i] |=
        (source[i - 1] | (source[i] >>> 1) | (source[i] << 1) | source[i + 1]) & target[i]
    }

    source[NUM_SLICES - 1] |=
      (source[NUM_SLICES - 2] | (source[NUM_SLICES - 1] >>> 1) | (source[NUM_SLICES - 1] << 1)) &
      target[NUM_SLICES - 1]

    for (let i = 0; i < NUM_SLICES; ++i) {
      if (temp[i] !== source[i]) {
        for (let j = 0; j < NUM_SLICES; ++j) {
          temp[j] = source[j]
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
 */
export function flood(source: Stones, target: Stones) {
  mask(source, target)
  bleed(source, target)
}

export function widthOf(stones: Stones): number {
  return stones.reduce((acc, cur) => Math.max(acc, WIDTH - Math.clz32(cur)), 0)
}

export function heightOf(stones: Stones): number {
  let result = 0
  for (let j = 0; j < stones.length; ++j) {
    if (stones[j]) {
      result = j + 1
    }
  }
  return result
}

export function rectangle(width: number, height: number): Stones {
  const result = emptyStones()
  if (!width || !height) {
    return result
  }
  result[0] = width === WIDTH ? ~0 : (1 << width) - 1
  for (let i = 1; i < height; ++i) {
    result[i] = result[0]
  }
  return result
}

export function stonesAnd(stones: Stones, ...rest: Stones[]): Stones {
  const result = clone(stones)
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let j = 0; j < rest.length; j++) {
      result[i] &= rest[j][i]
    }
  }
  return result
}

export function stonesOr(stones: Stones, ...rest: Stones[]): Stones {
  const result = clone(stones)
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let j = 0; j < rest.length; j++) {
      result[i] |= rest[j][i]
    }
  }
  return result
}

export function stonesXor(stones: Stones, ...rest: Stones[]): Stones {
  const result = clone(stones)
  for (let i = 0; i < NUM_SLICES; ++i) {
    for (let j = 0; j < rest.length; j++) {
      result[i] ^= rest[j][i]
    }
  }
  return result
}

export function stonesNot(stones: Stones): Stones {
  const result = clone(stones)
  for (let i = 0; i < result.length; ++i) {
    result[i] = ~result[i]
  }
  return result
}

export function invertInPlace(stones: Stones): Stones {
  for (let i = 0; i < stones.length; ++i) {
    stones[i] = ~stones[i]
  }
  return stones
}

export function liberties(stones: Stones, empty: Stones): Stones {
  const result = emptyStones()
  result[0] = ((stones[0] << 1) | (stones[0] >>> 1) | stones[1]) & ~stones[0] & empty[0]
  for (let i = 1; i < NUM_SLICES - 1; ++i) {
    result[i] =
      (stones[i - 1] | (stones[i] << 1) | (stones[i] >>> 1) | stones[i + 1]) & ~stones[i] & empty[i]
  }
  result[NUM_SLICES - 1] =
    (stones[NUM_SLICES - 2] | (stones[NUM_SLICES - 1] << 1) | (stones[NUM_SLICES - 1] >>> 1)) &
    ~stones[NUM_SLICES - 1] &
    empty[NUM_SLICES - 1]
  return result
}

export function north(stones: Stones): Stones {
  const result = clone(stones)
  result.copyWithin(0, 1)
  result[result.length - 1] = 0
  return result
}

export function south(stones: Stones): Stones {
  const result = clone(stones)
  result.copyWithin(1, 0)
  result[0] = 0
  return result
}

export function west(stones: Stones): Stones {
  const result = clone(stones)
  for (let i = 0; i < stones.length; ++i) {
    result[i] >>>= 1
  }
  return result
}

export function east(stones: Stones): Stones {
  const result = clone(stones)
  for (let i = 0; i < stones.length; ++i) {
    result[i] <<= 1
  }
  return result
}

export function isSingle(stones: Stones): boolean {
  let i
  for (i = 0; i < stones.length; ++i) {
    if (stones[i] && !(stones[i] & (stones[i] - 1))) {
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
  if (y < 0 || y >= stones.length) {
    return false
  }
  return !!(stones[y] & (1 << x))
}

export function dots(stones: Stones): Stones[] {
  const result: Stones[] = []
  for (let i = 0; i < NUM_SLICES; ++i) {
    let slice = stones[i]
    let p = 1
    while (slice) {
      if (slice & p) {
        const dot = emptyStones()
        dot[i] = p
        result.push(dot)
        slice ^= p
      }
      p <<= 1
    }
  }
  return result
}

export function witherBy(stones: Stones, amount: number) {
  for (let i = 0; i < stones.length; ++i) {
    while (stones[i] && amount) {
      stones[i] ^= EAST_STONE >>> Math.clz32(stones[i])
      amount--
    }
  }
}

export function coordsOf(move: Stones): Coords {
  for (let y = 0; y < move.length; ++y) {
    if (move[y]) {
      return {
        x: WIDTH - 1 - Math.clz32(move[y]),
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
 * Convert an `Array` of numbers to `Stones`.
 */
export function padStones(slices: number[]): Stones {
  const result = emptyStones()
  for (let i = 0; i < slices.length; ++i) {
    result[i] = slices[i]
  }
  return result
}

/**
 * Convert `Stones` to an `Array` of numbers.
 */
export function stripStones(stones: Stones): number[] {
  const result = Array.from(stones)
  while (result.length && !result[result.length - 1]) {
    result.pop()
  }
  return result
}
