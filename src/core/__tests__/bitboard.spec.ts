import { describe, it, expect } from 'vitest'

import { rectangle, stonesCount, emptyStones, isSingle, stonesOr, equals, overlaps, liberties } from '../bitboard'

describe('Bitboard', () => {
  it('counts stones in rectangles', () => {
    for (let width = 0; width <= 32; width++) {
      for (let height = 0; height <= 19; ++height) {
        expect(stonesCount(rectangle(width, height))).toBe(width * height)
      }
    }
  })
  it('determines if a group of stones is just a single stone', () => {
    const stones = emptyStones()
    stones[0] = 208
    stones[1] = 240
    stones[2] = 16
    expect(isSingle(stones)).toBe(false)
  })

  it('handles mixed bitboard lengths', () => {
    const a = new Uint32Array([0b0001])
    const b = new Uint32Array([0b0010, 0b0100])

    expect(stonesOr(a, b)).toEqual(new Uint32Array([0b0011, 0b0100]))
    expect(equals(new Uint32Array([1]), new Uint32Array([1, 0]))).toBe(true)
    expect(overlaps(new Uint32Array([0, 0b0100]), b)).toBe(true)
    expect(liberties(new Uint32Array([0b0001]), new Uint32Array([0b1111, 0b1111]))).toEqual(
      new Uint32Array([0b0010, 0b0001]),
    )
  })
})
