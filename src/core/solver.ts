import {
  type Stones,
  dots,
  emptyStones,
  stonesCount,
  stonesAnd,
  equals,
  overlaps,
  witherBy,
  subtract,
  stonesNot,
  merge,
  coordsOf,
} from './bitboard'
import { State, MoveResult, SCORE_Q7_SCALE } from './state'

export type MoveInfo = {
  // Coordinates of the move or -1, -1 for a pass
  x: number
  y: number

  // Score differences compared to the parent state
  lowGain: number
  highGain: number

  // Best moves have a gain of zero, but optimize for the other gain as well if possible
  lowIdeal: boolean
  highIdeal: boolean

  // A move is forcing if it's high-optimal and passing isn't a low-optimal move as a response
  forcing: boolean
}

export type SolutionInfo = {
  // Moves that are available.
  moves: MoveInfo[]
}

const MIN_VALUE = -32767 // Not -32768 to support unary minus
const MAX_VALUE = 32767

function keyspaceSize(root: State): number {
  const numMoves = stonesCount(root.logicalArea)
  let result = 1

  // Stones and empty space
  result *= 3 ** numMoves

  // Location or absence of ko
  result *= numMoves + 1

  // External liberties filled by the player
  result *= stonesCount(stonesAnd(root.external, root.player)) + 1
  // External liberties filled by the opponent
  result *= stonesCount(stonesAnd(root.external, root.opponent)) + 1

  // Ko threats and their inverses
  result *= 2 * Math.abs(root.koThreats) + 1

  // Button ownership
  result *= 3

  // Passed or not
  result *= 2

  // Color to play
  result *= 2

  return result
}

export class Graph {
  root: State
  moves: Stones[]

  lows: Int16Array
  highs: Int16Array

  constructor(root: State) {
    this.root = root
    this.moves = dots(root.logicalArea)
    this.moves.push(emptyStones())
    const size = keyspaceSize(root)
    this.lows = new Int16Array(size)
    this.highs = new Int16Array(size)
    this.lows.fill(MIN_VALUE)
    this.highs.fill(MAX_VALUE)
  }

  // Encode root's child state into a number
  encode(state: State) {
    let result = 0
    result = 2 * result + state.passes
    result = 3 * result + state.button + 1

    result = (2 * Math.abs(this.root.koThreats) + 1) * result + state.koThreats
    let player = state.player
    let opponent = state.opponent
    if (state.whiteToPlay !== this.root.whiteToPlay) {
      player = state.opponent
      opponent = state.player
    }
    result =
      (stonesCount(stonesAnd(this.root.external, this.root.opponent)) + 1) * result +
      stonesCount(stonesAnd(this.root.external, opponent))
    result =
      (stonesCount(stonesAnd(this.root.external, this.root.player)) + 1) * result +
      stonesCount(stonesAnd(this.root.external, player))

    result *= this.moves.length
    for (let i = 0; i < this.moves.length; ++i) {
      if (equals(this.moves[i], state.ko)) {
        result += i
        break
      }
    }

    for (let i = 0; i < this.moves.length - 1; ++i) {
      result *= 3
      if (overlaps(this.moves[i], state.player)) {
        result += 1
      } else if (overlaps(this.moves[i], state.opponent)) {
        result += 2
      }
    }

    result = 2 * result + Number(state.whiteToPlay)

    return result
  }

  // Decode a number into a game state
  decode(key: number) {
    const result = new State(this.root)
    const effectiveArea = stonesAnd(result.logicalArea, stonesNot(result.external))
    subtract(result.player, effectiveArea)
    subtract(result.opponent, effectiveArea)

    let m = 2
    let n = key % m
    key = (key - n) / m
    result.whiteToPlay = !!n

    if (result.whiteToPlay !== this.root.whiteToPlay) {
      ;[result.player, result.opponent] = [result.opponent, result.player]
    }

    for (let i = this.moves.length - 2; i >= 0; --i) {
      n = key % 3
      key = (key - n) / 3
      if (n === 1) {
        merge(result.player, this.moves[i])
      } else if (n === 2) {
        merge(result.opponent, this.moves[i])
      }
    }

    m = this.moves.length
    n = key % m
    key = (key - n) / m
    result.ko = this.moves[n]

    const playerExternal = stonesAnd(this.root.external, this.root.player)
    m = stonesCount(playerExternal) + 1
    n = key % m
    key = (key - n) / m
    witherBy(playerExternal, m - 1 - n)

    const opponentExternal = stonesAnd(this.root.external, this.root.opponent)
    m = stonesCount(opponentExternal) + 1
    n = key % m
    key = (key - n) / m
    witherBy(opponentExternal, m - 1 - n)

    if (result.whiteToPlay === this.root.whiteToPlay) {
      merge(result.player, playerExternal)
      merge(result.opponent, opponentExternal)
    } else {
      merge(result.opponent, playerExternal)
      merge(result.player, opponentExternal)
    }

    m = 2 * Math.abs(this.root.koThreats) + 1
    n = key % m
    key = (key - n) / m
    result.koThreats = n - Math.abs(this.root.koThreats)

    m = 3
    n = key % m
    key = (key - n) / m
    result.button = n - 1

    result.passes = key % 2
    key -= result.passes

    return result
  }

  // Returns `false` when done
  iterate(): boolean {
    let didChange = false
    for (let key = 0; key < this.lows.length; ++key) {
      let low = this.lows[key]
      let high = MIN_VALUE
      const parent = this.decode(key)
      for (const move of this.moves) {
        const child = new State(parent)
        const r = child.makeMove(move)
        if (r === MoveResult.Illegal) {
          continue
        }
        if (r === MoveResult.TakeTarget) {
          const childScore = -child.targetLostScoreQ7()
          low = Math.max(low, childScore)
          high = Math.max(high, childScore)
        } else if (r === MoveResult.SecondPass) {
          const childScore = -child.scoreQ7()
          low = Math.max(low, childScore)
          high = Math.max(high, childScore)
        } else {
          const childKey = this.encode(child)
          low = Math.max(low, -this.highs[childKey])
          high = Math.max(high, -this.lows[childKey])
        }
      }
      if (low !== this.lows[key] || high !== this.highs[key]) {
        this.lows[key] = low
        this.highs[key] = high
        didChange = true
      }
    }
    return didChange
  }

  getValueRange(state: State) {
    const key = this.encode(state)
    return [this.lows[key] / SCORE_Q7_SCALE, this.highs[key] / SCORE_Q7_SCALE]
  }

  getInfo(state: State): SolutionInfo {
    const [low, high] = this.getValueRange(state)

    const moves: MoveInfo[] = []

    let lowsHigh = -Infinity
    let highsLow = -Infinity
    for (let i = 0; i < this.moves.length; ++i) {
      const child = new State(state)
      const r = child.makeMove(this.moves[i])
      if (r === MoveResult.Illegal) {
        continue
      }
      let childInfo: MoveInfo | null = null
      if (r === MoveResult.TakeTarget || r === MoveResult.SecondPass) {
        const childScore = r === MoveResult.TakeTarget ? child.targetLostScore() : child.score()
        const lowGain = -childScore - low
        const highGain = -childScore - high
        if (!lowGain) {
          lowsHigh = Math.max(lowsHigh, highGain)
        }
        if (!highGain) {
          highsLow = Math.max(highsLow, lowGain)
        }
        childInfo = {
          ...coordsOf(this.moves[i]),
          lowGain,
          highGain,
          lowIdeal: false,
          highIdeal: false,
          forcing: false,
        }
      } else {
        const [childLow, childHigh] = this.getValueRange(child)
        let forcing = false
        const lowGain = -childHigh - low
        const highGain = -childLow - high
        if (!lowGain) {
          lowsHigh = Math.max(lowsHigh, highGain)
        }
        if (!highGain) {
          highsLow = Math.max(highsLow, lowGain)
          const grandChild = new State(child)
          const gr = grandChild.makeMove(emptyStones())
          let grandHigh
          if (gr === MoveResult.TakeTarget || gr == MoveResult.SecondPass) {
            grandHigh =
              gr === MoveResult.TakeTarget ? grandChild.targetLostScore() : grandChild.score()
          } else {
            grandHigh = this.getValueRange(grandChild)[1]
          }
          forcing = childLow > -grandHigh
        }
        childInfo = {
          ...coordsOf(this.moves[i]),
          lowGain,
          highGain,
          lowIdeal: false,
          highIdeal: false,
          forcing,
        }
      }
      moves.push(childInfo!)
    }

    for (const childInfo of moves) {
      if (!childInfo.lowGain && childInfo.highGain === lowsHigh) {
        childInfo.lowIdeal = true
      }
      if (!childInfo.highGain && childInfo.lowGain === highsLow) {
        childInfo.highIdeal = true
      }
    }

    return {
      moves,
    }
  }
}
