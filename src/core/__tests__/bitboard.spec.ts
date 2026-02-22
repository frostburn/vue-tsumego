import { describe, it, expect } from 'vitest'

import { rectangle, stonesCount, emptyStones, isSingle } from '../bitboard'

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
})
