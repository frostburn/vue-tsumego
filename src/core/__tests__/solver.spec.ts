import { describe, it, expect } from 'vitest'

import { clone, rectangle, stonesXor } from '../bitboard'
import { State, TARGET_CAPTURED_SCORE, BUTTON_BONUS } from '../state'
import { Graph } from '../solver'

function straightTwo(): State {
  const s = new State()

  s.visualArea = rectangle(3, 2)
  s.logicalArea = rectangle(2, 1)
  s.player = stonesXor(s.visualArea, s.logicalArea)
  s.target = clone(s.player)

  return s
}

function straightThree(): State {
  const s = new State()

  s.visualArea = rectangle(4, 2)
  s.logicalArea = rectangle(3, 1)
  s.player = stonesXor(s.visualArea, s.logicalArea)
  s.target = clone(s.player)

  return s
}

describe('Go game graph', () => {
  it('solves straight two loss', () => {
    const root = straightTwo()

    const g = new Graph(root)
    expect(g.lows.length).toBe(324)

    for (let i = 0; i < g.lows.length; ++i) {
      const s = g.decode(i)
      const key = g.encode(s)
      expect(key).toBe(i)
    }

    for (let i = 0; i < 3; ++i) {
      const didChange = g.iterate()
      expect(didChange).toBe(true)
    }
    const didChange = g.iterate()
    expect(didChange).toBe(false)

    const score = BUTTON_BONUS - TARGET_CAPTURED_SCORE
    expect(g.getValueRange(root)).toEqual([score, score])

    const info = g.getInfo(root)
    const expected = {
      moves: [
        {
          x: 0,
          y: 0,
          lowGain: -0.5,
          highGain: -0.5,
          lowIdeal: false,
          highIdeal: false,
          forcing: false,
        },
        {
          x: 1,
          y: 0,
          lowGain: -0.5,
          highGain: -0.5,
          lowIdeal: false,
          highIdeal: false,
          forcing: false,
        },
        {
          x: -1,
          y: -1,
          lowGain: 0,
          highGain: 0,
          lowIdeal: true,
          highIdeal: true,
          forcing: true,
        },
      ],
    }
    expect(info).toEqual(expected)
  })

  it('solves straight three defense', () => {
    const root = straightThree()

    const g = new Graph(root)
    expect(g.highs.length).toBe(1296)

    for (let i = 0; i < g.highs.length; ++i) {
      const s = g.decode(i)
      const key = g.encode(s)
      expect(key).toBe(i)
    }

    for (let i = 0; i < 5; ++i) {
      const didChange = g.iterate()
      expect(didChange).toBe(true)
    }

    const didChange = g.iterate()
    expect(didChange).toBe(false)
    const score = 8 - BUTTON_BONUS
    expect(g.getValueRange(root)).toEqual([score, score])
  })

  it('solves straight three attack', () => {
    const root = straightThree()
    ;[root.player, root.opponent] = [root.opponent, root.player]

    const g = new Graph(root)
    expect(g.lows.length).toBe(1296)

    for (let i = 0; i < 5; ++i) {
      const didChange = g.iterate()
      expect(didChange).toBe(true)
    }

    const didChange = g.iterate()
    expect(didChange).toBe(false)
    const score = TARGET_CAPTURED_SCORE - BUTTON_BONUS
    expect(g.getValueRange(root)).toEqual([score, score])
  })
})
