import {
  type Stones,
  emptyStones,
  widthOf,
  heightOf,
  isEmpty,
  isNonEmpty,
  single,
  clear,
  overlaps,
  stonesNot,
  invertInPlace,
  stonesAnd,
  stonesOr,
  stonesXor,
  merge,
  flip,
  flood,
  bleed,
  liberties,
  north,
  east,
  west,
  south,
  equals,
  isSingle,
  subtract,
  clone,
  stonesCount,
  padStones,
  stripStones,
} from './bitboard'

// Result of making a move
export enum MoveResult {
  // Non-moves
  Illegal,

  // Game-ending moves
  TargetLost, // Not a legal move but can happen as an optimization
  SecondPass,
  TakeTarget,

  // Non-constructive moves
  ClearKo,
  TakeButton,
  Pass,

  // Constructive moves
  FillExternal,
  Normal,
  KoThreatAndRetake,
}

// Types of stones on the goban
// Normal stones have no special properties
// Capturing target stones ends the game
// Immortal stones cannot be captured
// Intangible stones are for aesthetics but please prefer marking outside stones as immortal instead
export type StoneStatus = 'normal' | 'target' | 'immortal' | 'intangible'

// A playing piece on the goban
export type GridStone = {
  type: 'black' | 'white'
  status: StoneStatus
  id: number
  x: number
  y: number
}

// Empty space on the goban
export type GridSpace = {
  type: 'ko' | 'external' | 'empty' | 'outside' | 'void'
  playable: boolean
  id: number
  x: number
  y: number
}

export type GridItem = GridStone | GridSpace

// State serialization format
export type StateJSON = {
  visualArea: number[]
  logicalArea: number[]
  player: number[]
  opponent: number[]
  ko: number[]
  target: number[]
  immortal: number[]
  external: number[]
  passes: number
  koThreats: number
  button: number
  whiteToPlay: boolean
}

// Conversion between JS numbers and 16-bit fixed-point
export const SCORE_Q7_SCALE = 128

export const TARGET_CAPTURED_SCORE = 200
const TARGET_CAPTURED_SCORE_Q7 = TARGET_CAPTURED_SCORE * SCORE_Q7_SCALE

// Taking the button is worth a quarter point
const BUTTON_Q7 = SCORE_Q7_SCALE / 4
export const BUTTON_BONUS = BUTTON_Q7 / SCORE_Q7_SCALE

// Saving up abstract "external" ko-threats is incentivized
const KO_THREAT_Q7 = SCORE_Q7_SCALE / 32
export const KO_THREAT_BONUS = KO_THREAT_Q7 / SCORE_Q7_SCALE

/**
 * A 32x19 goban of go stones suitable for navigating tsumego (go problems)
 * Everything is encoded from the perspective of the player to play.
 **/
export class State {
  // The visual playing area. Zeroed bits signify void not part of the board.
  visualArea: Stones

  // The logical playing area. Moves cannot be made inside zeroed bits. Outside stones are for decoration.
  logicalArea: Stones

  // Stones of the player to make the next move.
  player: Stones

  // Stones of the player that made the last move.
  opponent: Stones

  // The zero bitboard. Or a single bit signifying the illegal ko recapture.
  ko: Stones

  // Tsumego target(s) to be captured or saved depending on the problem.
  target: Stones

  // Stones that cannot be captured even if they run out of liberties.
  immortal: Stones

  // External liberties. Should be adjacent to the target. Always counts as empty space.
  // Player/opponent flags indicate who can fill in the liberties.
  external: Stones

  // Number of consecutive passes made. Clearing a ko or taking the button doesn't qualify.
  passes: number

  // Number of external ko threats available. Negative numbers signify that the opponent has ko threats.
  koThreats: number

  // Indicate the owner of the button. Awarded to the first player to make a passing move. Worth a quarter-point of area score.
  // -1: opponent has button
  //  0: button not awarded yet
  // +1: player has button
  button: number

  // Indicate which color "player" refers to.
  whiteToPlay: boolean

  /**
   * Construct a new empty 32x19 goban.
   */
  constructor(state?: State) {
    if (state === undefined) {
      this.visualArea = emptyStones()
      this.logicalArea = emptyStones()
      this.player = emptyStones()
      this.opponent = emptyStones()
      this.ko = emptyStones()
      this.target = emptyStones()
      this.immortal = emptyStones()
      this.external = emptyStones()
      this.passes = 0
      this.koThreats = 0
      this.button = 0
      this.whiteToPlay = false
    } else {
      this.visualArea = clone(state.visualArea)
      this.logicalArea = clone(state.logicalArea)
      this.player = clone(state.player)
      this.opponent = clone(state.opponent)
      this.ko = clone(state.ko)
      this.target = clone(state.target)
      this.immortal = clone(state.immortal)
      this.external = clone(state.external)
      this.passes = state.passes
      this.koThreats = state.koThreats
      this.button = state.button
      this.whiteToPlay = state.whiteToPlay
    }
  }

  /**
   * Update game state from serialized data.
   */
  assignFromJSON(obj: StateJSON) {
    this.visualArea = padStones(obj.visualArea)
    this.logicalArea = padStones(obj.logicalArea)
    this.player = padStones(obj.player)
    this.opponent = padStones(obj.opponent)
    this.ko = padStones(obj.ko)
    this.target = padStones(obj.target)
    this.immortal = padStones(obj.immortal)
    this.external = padStones(obj.external)
    this.passes = obj.passes
    this.koThreats = obj.koThreats
    this.button = obj.button
    this.whiteToPlay = obj.whiteToPlay
  }

  /**
   * Serialize game state.
   */
  toJSON() {
    return {
      visualArea: stripStones(this.visualArea),
      logicalArea: stripStones(this.logicalArea),
      player: stripStones(this.player),
      opponent: stripStones(this.opponent),
      ko: stripStones(this.ko),
      target: stripStones(this.target),
      immortal: stripStones(this.immortal),
      external: stripStones(this.external),
      passes: this.passes,
      koThreats: this.koThreats,
      button: this.button,
      whiteToPlay: this.whiteToPlay,
    }
  }

  get width(): number {
    return widthOf(this.visualArea)
  }

  get height(): number {
    return heightOf(this.visualArea)
  }

  /**
   * An array of strings suitable for rendering the goban in the console.
   */
  displayLines(): string[] {
    const black = this.whiteToPlay ? this.opponent : this.player
    const white = this.whiteToPlay ? this.player : this.opponent

    const width = this.width
    const height = this.height
    const result = ['\x1b[0;30;46m╔═' + '══'.repeat(width) + '╗\x1b[0m']
    for (let y = 0; y < height; ++y) {
      const visualArea = this.visualArea[y]
      const logicalArea = this.logicalArea[y]
      const target = this.target[y]
      const immortal = this.immortal[y]
      const external = this.external[y]
      const ko = this.ko[y]
      let line = '\x1b[0;30;46m║'
      for (let x = 0; x < width; ++x) {
        // Probe
        const p = 1 << x

        // Visual / logical playing area indicators
        if (p & visualArea) {
          if (p & logicalArea) {
            line += '\x1b[0;30;43m' // Yellow BG
          } else {
            line += '\x1b[0;30;46m' // Cyan BG
          }
        } else {
          if (p & logicalArea) {
            line += '\x1b[0;30;101m' // Bright Red BG (error)
          } else {
            line += '\x1b[0m' // No BG (outside)
          }
        }

        // Stones
        if (p & black[y]) {
          line += '\x1b[30m' // Black
          if (p & target) {
            if (p & immortal) {
              line += '\x1b[1m' // Bold
            }
            line += ' b'
          } else if (p & immortal) {
            line += ' B'
          } else if (p & external) {
            line += ' +'
          } else if (p & white[y]) {
            line += ' #'
          } else {
            line += ' @'
          }
        } else if (p & white[y]) {
          line += '\x1b[97m' // Bright White
          if (p & target) {
            if (p & immortal) {
              line += '\x1b[1m' // Bold
            }
            line += ' w'
          } else if (p & immortal) {
            line += ' W'
          } else if (p & external) {
            line += ' -'
          } else {
            line += ' 0'
          }
        } else if (p & ko) {
          line += '\x1b[35m'
          line += ' *'
        } else if (p & visualArea) {
          if (p & target) {
            line += '\x1b[34m'
            line += ' !'
          } else {
            line += '\x1b[35m'
            if (p & logicalArea) {
              line += ' .'
            } else {
              line += ' ,'
            }
          }
        } else if (p & logicalArea) {
          line += '\x1b[35m'
          line += ' ?'
        } else {
          line += '  '
        }
      }
      line += '\x1b[0;30;46m ║\x1b[0m'
      result.push(line)
    }
    result.push('\x1b[0;30;46m╚═' + '══'.repeat(width) + '╝\x1b[0m')
    let line = `passes = ${this.passes} koThreats = ${this.koThreats} button = ${this.button} `
    if (this.whiteToPlay) {
      line += 'White to play'
    } else {
      line += 'Black to play'
    }
    result.push(line)
    return result
  }

  log() {
    console.log(this.displayLines().join('\n'))
  }

  // Play the single stone indicated by the bitboard
  makeMove(move: Stones): MoveResult {
    let result = MoveResult.Normal
    const oldPlayer = clone(this.player)
    // Handle pass
    if (isEmpty(move)) {
      // Award button if still available
      if (this.button === 0) {
        this.button = 1
        result = MoveResult.TakeButton
      }
      // Clear ko w/o incrementing passes
      if (isNonEmpty(this.ko)) {
        clear(this.ko)
        result = MoveResult.ClearKo
      }
      // Only count regular passes
      else if (result !== MoveResult.TakeButton) {
        this.passes++
        if (this.passes === 1) {
          result = MoveResult.Pass
        } else {
          result = MoveResult.SecondPass
        }
      }
      // Swap players
      this.player = this.opponent
      this.opponent = oldPlayer
      this.koThreats = -this.koThreats
      this.button = -this.button
      this.whiteToPlay = !this.whiteToPlay
      return result
    }

    // Handle regular move
    const oldOpponent = clone(this.opponent)
    const oldKo = clone(this.ko)
    const oldKoThreats = this.koThreats
    if (overlaps(move, this.ko)) {
      // Illegal ko move
      if (this.koThreats <= 0) {
        return MoveResult.Illegal
      }
      // Legal ko move by playing an external threat first
      this.koThreats--
      result = MoveResult.KoThreatAndRetake
    }

    // Abort if move outside empty logical area
    const nonEmpty = stonesOr(
      stonesNot(this.logicalArea),
      stonesXor(this.player, this.external),
      this.opponent,
    )
    if (overlaps(move, nonEmpty)) {
      return MoveResult.Illegal
    }

    if (overlaps(move, this.external)) {
      // Note that the C backend normalizes move placement inside the group of external liberties.
      merge(this.immortal, move)
      flip(this.external, move)
      result = MoveResult.FillExternal
    }

    merge(this.player, move)
    clear(this.ko)

    // Opponent's stones killed
    const kill = emptyStones()

    // Potential liberties for opponent's stones (visual non-logical liberties count as permanent)
    const empty = stonesAnd(this.visualArea, invertInPlace(stonesXor(this.player, this.external)))

    let chain: Stones

    function killChain_() {
      flood(chain, this.opponent)
      if (isEmpty(liberties(chain, empty)) && !overlaps(chain, this.immortal)) {
        merge(kill, chain)
        flip(this.opponent, chain)
      }
    }
    const killChain = killChain_.bind(this)
    chain = north(move)
    killChain()
    chain = east(move)
    killChain()
    chain = west(move)
    killChain()
    chain = south(move)
    killChain()

    // Check legality
    chain = clone(move)
    flood(chain, stonesAnd(this.player, stonesNot(this.external)))
    let libs = liberties(
      chain,
      stonesAnd(this.visualArea, invertInPlace(stonesXor(this.opponent, this.external))),
    )
    if (isEmpty(libs) && !overlaps(chain, this.immortal)) {
      // Oops! Revert state
      this.player = oldPlayer
      this.opponent = oldOpponent
      this.ko = oldKo
      this.koThreats = oldKoThreats
      return MoveResult.Illegal
    }

    // Check if a single stone was killed and the played stone was left alone in atari
    libs = liberties(chain, stonesAnd(this.logicalArea, stonesNot(this.opponent)))
    if (isSingle(kill) && isSingle(chain) && equals(libs, kill)) {
      this.ko = kill
    }

    // Expand immortal areas
    if (overlaps(chain, this.immortal)) {
      merge(this.immortal, chain)
      subtract(this.logicalArea, chain)
    }

    // Expand target areas
    if (overlaps(chain, this.target)) {
      merge(this.target, chain)
      subtract(this.logicalArea, chain)
    }

    // Swap players
    this.passes = 0
    ;[this.player, this.opponent] = [this.opponent, this.player]
    this.koThreats = -this.koThreats
    this.button = -this.button
    this.whiteToPlay = !this.whiteToPlay

    if (overlaps(kill, this.target)) {
      return MoveResult.TakeTarget
    }

    return result
  }

  toGrid(): GridItem[] {
    const width = this.width
    const height = this.height
    const white = this.whiteToPlay ? this.player : this.opponent
    const black = this.whiteToPlay ? this.opponent : this.player
    const empty = stonesOr(
      stonesAnd(this.visualArea, invertInPlace(stonesOr(black, white))),
      this.external,
    )
    const result: GridItem[] = []
    let id = -1
    for (let y = 0; y < height; ++y) {
      for (let x = 0; x < width; ++x) {
        id++
        const move = single(x, y)
        const r = new State(this).makeMove(move)
        if (overlaps(move, empty)) {
          let t: GridSpace['type'] = 'outside'
          if (overlaps(move, this.external)) {
            t = 'external'
          } else if (equals(move, this.ko)) {
            t = 'ko'
          } else if (overlaps(move, this.logicalArea)) {
            t = 'empty'
          }
          result.push({
            type: t,
            playable: r !== MoveResult.Illegal,
            id,
            x,
            y,
          })
        } else {
          let status: StoneStatus = 'normal'
          if (overlaps(move, this.immortal)) {
            status = 'immortal'
          } else if (overlaps(move, this.target)) {
            status = 'target'
          } else if (!overlaps(move, this.logicalArea)) {
            status = 'intangible'
          }
          if (overlaps(move, black)) {
            result.push({
              type: 'black',
              status,
              id,
              x,
              y,
            })
          } else if (overlaps(move, white)) {
            result.push({
              type: 'white',
              status,
              id,
              x,
              y,
            })
          } else {
            result.push({
              type: 'void',
              playable: false,
              id,
              x,
              y,
            })
          }
        }
      }
    }
    return result
  }

  // Area score but only adjacent area is counted
  chineseLibertyScore(): number {
    const empty = stonesOr(
      stonesAnd(this.visualArea, invertInPlace(stonesOr(this.player, this.opponent))),
      this.external,
    )

    const notExt = stonesNot(this.external)
    const playerControlled = stonesAnd(this.player, notExt)
    const opponentControlled = stonesAnd(this.opponent, notExt)

    merge(playerControlled, liberties(playerControlled, empty))
    merge(opponentControlled, liberties(opponentControlled, empty))

    return stonesCount(playerControlled) - stonesCount(opponentControlled)
  }

  // Area score without removing dead stones
  simpleAreaScore(): number {
    const empty = stonesAnd(this.visualArea, invertInPlace(stonesOr(this.player, this.opponent)))
    merge(empty, this.external)

    const notExt = stonesNot(this.external)
    const playerControlled = stonesAnd(this.player, notExt)
    const opponentControlled = stonesAnd(this.opponent, notExt)

    bleed(playerControlled, empty)
    bleed(opponentControlled, empty)

    return stonesCount(playerControlled) - stonesCount(opponentControlled)
  }

  // Area score scaled to 16-point fixed-point including bonus for button and remaining ko-threats
  scoreQ7(): number {
    return (
      this.simpleAreaScore() * SCORE_Q7_SCALE +
      this.button * BUTTON_Q7 +
      this.koThreats * KO_THREAT_Q7
    )
  }
  score(): number {
    return this.scoreQ7() / SCORE_Q7_SCALE
  }

  // Bonus for button and remaining ko-threats with a penalty for losing your target stones
  targetLostScoreQ7(): number {
    return this.button * BUTTON_Q7 + this.koThreats * KO_THREAT_Q7 - TARGET_CAPTURED_SCORE_Q7
  }
  targetLostScore(): number {
    return this.targetLostScoreQ7() / SCORE_Q7_SCALE
  }
}
