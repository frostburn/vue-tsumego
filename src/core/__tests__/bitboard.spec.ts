import { describe, it, expect } from 'vitest'

import { rectangle, stonesCount } from '../bitboard'

describe('Bitboard', () => {
  it('counts stones in rectangles', () => {
    for (let width = 0; width <= 32; width++) {
      for (let height = 0; height <= 19; ++height) {
        expect(stonesCount(rectangle(width, height))).toBe(width * height)
      }
    }
  })
})
