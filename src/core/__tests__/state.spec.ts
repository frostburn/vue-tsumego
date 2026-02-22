import { describe, it, expect } from 'vitest'

import { clone, rectangle, stonesXor, single, stoneAt, equals, east, isEmpty } from '../bitboard'
import { MoveResult, State } from '../state'

function debug(state: State) {
  // Shush linter
  state.passes += 0
  // state.log();
}

function rectangleSix(): State {
  const s = new State()

  s.visualArea = rectangle(4, 3)
  s.logicalArea = clone(s.visualArea)
  s.opponent = stonesXor(s.visualArea, rectangle(3, 2))
  s.target = clone(s.opponent)
  s.koThreats = -1

  return s
}

function rectangleSixGoban(): State {
  const s = new State()
  s.visualArea = rectangle(3, 2)
  s.logicalArea = clone(s.visualArea)

  return s
}

function immortalStraightTwo(): State {
  const s = new State()

  s.visualArea = rectangle(4, 2)
  s.logicalArea = east(rectangle(2, 1))
  s.player = stonesXor(s.visualArea, s.logicalArea)
  s.immortal = clone(s.player)

  return s
}

describe('Go game state', () => {
  it('plays through the rectangle six capture mainline', () => {
    let r: MoveResult
    const s = rectangleSix()

    debug(s)

    r = s.makeMove(single(1, 1))
    debug(s)
    expect(r).toBe(MoveResult.Normal)

    r = s.makeMove(single(1, 0))
    debug(s)
    expect(r).toBe(MoveResult.Normal)

    r = s.makeMove(single(0, 1))
    debug(s)
    expect(r).toBe(MoveResult.Normal)

    r = s.makeMove(single(2, 1))
    debug(s)
    expect(r).toBe(MoveResult.Normal)
    expect(stoneAt(s.target, 2, 1)).toBe(true)

    r = s.makeMove(single(2, 0))
    expect(r).toBe(MoveResult.TakeTarget)
    debug(s)
  })

  it('creates a ko square', () => {
    const s = rectangleSixGoban()

    debug(s)

    s.makeMove(single(0, 0))
    s.makeMove(single(1, 0))
    s.makeMove(single(1, 1))
    s.makeMove(single(0, 1))

    debug(s)

    expect(equals(s.ko, single(0, 0))).toBe(true)
  })

  it("doesn't create a ko square", () => {
    const s = immortalStraightTwo()

    debug(s)

    s.makeMove(single(-1, -1))
    s.makeMove(single(1, 0))
    s.makeMove(single(2, 0))

    debug(s)

    expect(isEmpty(s.ko)).toBe(true)
  })
})
