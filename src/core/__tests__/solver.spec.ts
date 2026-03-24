import { describe, it, expect } from 'vitest'

import { clone, rectangle, stonesXor, south, merge } from '../bitboard'
import { State, TARGET_CAPTURED_SCORE, BUTTON_BONUS } from '../state'
import { Graph, encode, decode } from '../solver'

function debug(state: State) {
  // Shush linter
  state.passes += 0
  // state.log()
}

function straightTwo(): State {
  const s = new State()

  s.visualArea = rectangle(3, 2)
  s.logicalArea = rectangle(2, 1)
  s.player = stonesXor(s.visualArea, s.logicalArea)
  s.target = clone(s.player)

  return s.trim()
}

function straightThree(): State {
  const s = new State()

  s.visualArea = rectangle(4, 2)
  s.logicalArea = rectangle(3, 1)
  s.player = stonesXor(s.visualArea, s.logicalArea)
  s.target = clone(s.player)

  return s.trim()
}

function rectangleSix(): State {
  const s = new State()
  s.visualArea = rectangle(4, 5)
  s.logicalArea = rectangle(3, 2)
  s.external = south(south(south(rectangle(2, 1))))
  merge(s.logicalArea, s.external)
  s.opponent = stonesXor(rectangle(4, 3), rectangle(3, 2))
  s.target = clone(s.opponent)
  s.player = south(south(south(rectangle(4, 2))))
  s.immortal = stonesXor(s.player, s.external)
  return s.trim()
}

describe('Go game graph', () => {
  it('solves straight two loss', () => {
    const root = straightTwo()

    const g = new Graph(root)
    expect(g.lows.length).toBe(324)

    for (let i = 0; i < g.lows.length; ++i) {
      const s = decode(g.root, i)
      const key = encode(g.root, s)
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
      const s = decode(g.root, i, g.moves)
      const key = encode(g.root, s, g.moves)
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

describe('State encoder', () => {
  it('encodes external liberties', () => {
    const root = rectangleSix()
    debug(root)

    const state = new State(root)
    state.makeMove(1, 1)
    debug(state)

    let encoded = encode(root, state)
    expect(encoded).toBe(931787)

    let decoded = decode(root, encoded)
    debug(decoded)

    expect(state.equals(decoded)).toBe(true)

    state.makeMove(1, 0)
    state.makeMove(1, 3)
    debug(state)

    encoded = encode(root, state)
    expect(encoded).toBe(815147)

    decoded = decode(root, encoded)
    debug(decoded)

    expect(state.equals(decoded)).toBe(true)
  })

  it('encodes ko threats', () => {
    const root = rectangleSix()
    root.koThreats = 2

    const state = new State(root)
    state.koThreats = -1

    let encoded = encode(root, state)
    expect(encoded).toBe(3293630)

    let decoded = decode(root, encoded)
    expect(decoded.koThreats).toBe(-1)

    state.makeMove(1, 1)

    encoded = encode(root, state)
    expect(encoded).toBe(4238531)

    decoded = decode(root, encoded)
    expect(decoded.koThreats).toBe(1)
  })
})
