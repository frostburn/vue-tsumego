import { describe, it, expect } from 'vitest'

import {
  rectangle,
  stonesCount,
  emptyStones,
  isSingle,
  stonesOr,
  equals,
  overlaps,
  randomStones,
  stonesAnd,
  stoneAt,
} from '../bitboard'

describe('Bitboard', () => {
  it('counts stones in rectangles', () => {
    for (let width = 0; width <= 16; width++) {
      for (let height = 0; height <= 16; ++height) {
        expect(stonesCount(rectangle(width, height))).toBe(width * height)
        for (let truePlus = 0; truePlus <= 2; ++truePlus) {
          expect(stonesCount(rectangle(width, height, height + truePlus))).toBe(width * height)
        }
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
    const a = new Uint16Array([0b0001])
    const b = new Uint16Array([0b0010, 0b0100])

    expect(stonesOr(a, b)).toEqual(new Uint16Array([0b0011, 0b0100]))
    expect(equals(new Uint16Array([1]), new Uint16Array([1, 0]))).toBe(true)
    expect(overlaps(new Uint16Array([0b010]), b)).toBe(true)
  })
  it('supports bitwise `&` with collapsing behavior', () => {
    const a = randomStones(4)
    const b = randomStones(6)
    const c = stonesAnd(a, b)

    expect(c.length).toBe(4)

    for (let x = 0; x < 16; ++x) {
      for (let y = 0; y < 7; ++y) {
        expect(stoneAt(c, x, y)).toBe(stoneAt(a, x, y) && stoneAt(b, x, y))
      }
    }
  })
  it('supports bitwise `|` with expanding behavior', () => {
    const a = randomStones(3)
    const b = randomStones(5)
    const c = stonesOr(a, b)

    expect(c.length).toBe(5)

    for (let x = 0; x < 16; ++x) {
      for (let y = 0; y < 6; ++y) {
        expect(stoneAt(c, x, y)).toBe(stoneAt(a, x, y) || stoneAt(b, x, y))
      }
    }
  })
})
