import {
  type Stones,
  WIDTH,
  HEIGHT,
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
  east,
  south,
  equals,
  isSingle,
  subtract,
  clone,
  stonesCount,
  arrayToStones,
  stonesToArray,
  chains,
  gridOf,
  coordsOf,
  toHeight,
} from './bitboard'

/**
 * Outcome classification for attempting to apply a move.
 */
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

/**
 * Semantic categories used for stones on the rendered goban.
 */
export type StoneStatus = 'normal' | 'target' | 'immortal' | 'intangible' | 'dead'

/**
 * Render-ready description of a stone on the board grid.
 */
export type GridStone = {
  type: 'black' | 'white'
  status: StoneStatus
  id: number
  x: number
  y: number
}

/**
 * Render-ready description of an empty or special grid point.
 */
export type GridSpace = {
  type: 'ko' | 'external' | 'empty' | 'outside' | 'void'
  playable: boolean
  id: number
  x: number
  y: number
}

/**
 * Render-ready union of stone and non-stone grid cells.
 */
export type GridItem = GridStone | GridSpace

/**
 * JSON wire format for a {@link State}.
 */
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

/**
 * Scale factor used for Q7 fixed-point score representation.
 */
export const SCORE_Q7_SCALE = 128

/**
 * Score awarded when the target is captured.
 */
export const TARGET_CAPTURED_SCORE = 200
const TARGET_CAPTURED_SCORE_Q7 = TARGET_CAPTURED_SCORE * SCORE_Q7_SCALE

// Taking the button is worth a quarter point
const BUTTON_Q7 = SCORE_Q7_SCALE / 4
/**
 * Area-score bonus for owning the button.
 */
export const BUTTON_BONUS = BUTTON_Q7 / SCORE_Q7_SCALE

// Saving up abstract "external" ko-threats is incentivized
const KO_THREAT_Q7 = SCORE_Q7_SCALE / 32
/**
 * Area-score bonus applied per ko threat.
 */
export const KO_THREAT_BONUS = KO_THREAT_Q7 / SCORE_Q7_SCALE

/**
 * A 16x16 goban of go stones suitable for navigating tsumego (go problems)
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

  // External liberties. Usually adjacent to the target. Always counts as empty space.
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

  // Client-specific bitboard for stones marked for automatic capture
  // Not sent to the backend server. Obtained from the server
  dead: Stones

  /**
   * Construct a new empty 16x16 goban, a 16xheight goban or clone an existing state
   * @param state Optional source state or requested board height.
   */
  constructor(state?: State | number) {
    if (state === undefined || typeof state === 'number') {
      const height = state ?? HEIGHT
      this.visualArea = emptyStones(height)
      this.logicalArea = emptyStones(height)
      this.player = emptyStones(height)
      this.opponent = emptyStones(height)
      this.ko = emptyStones(height)
      this.target = emptyStones(height)
      this.immortal = emptyStones(height)
      this.external = emptyStones(height)
      this.passes = 0
      this.koThreats = 0
      this.button = 0
      this.whiteToPlay = false
      this.dead = emptyStones(height)
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
      this.dead = clone(state.dead)
    }
  }

  /**
   * Update game state from serialized data.
   * @param obj Serialized state payload.
   * @returns Nothing.
   */
  assignFromJSON(obj: StateJSON) {
    this.visualArea = arrayToStones(obj.visualArea)
    const height = this.height

    this.visualArea = toHeight(this.visualArea, height)

    this.logicalArea = arrayToStones(obj.logicalArea, height)
    this.player = arrayToStones(obj.player, height)
    this.opponent = arrayToStones(obj.opponent, height)
    this.ko = arrayToStones(obj.ko, height)
    this.target = arrayToStones(obj.target, height)
    this.immortal = arrayToStones(obj.immortal, height)
    this.external = arrayToStones(obj.external, height)
    this.passes = obj.passes
    this.koThreats = obj.koThreats
    this.button = obj.button
    this.whiteToPlay = obj.whiteToPlay
    this.dead = emptyStones(height)
  }

  /**
   * Serialize game state.
   * @returns Serializable state payload.
   */
  toJSON() {
    return {
      visualArea: stonesToArray(this.visualArea),
      logicalArea: stonesToArray(this.logicalArea),
      player: stonesToArray(this.player),
      opponent: stonesToArray(this.opponent),
      ko: stonesToArray(this.ko),
      target: stonesToArray(this.target),
      immortal: stonesToArray(this.immortal),
      external: stonesToArray(this.external),
      passes: this.passes,
      koThreats: this.koThreats,
      button: this.button,
      whiteToPlay: this.whiteToPlay,
    }
    // Dead stones intentionally left out
  }

  /**
   * Current occupied board width implied by `visualArea`.
   * @returns Width required to contain the board shape.
   */
  get width(): number {
    return widthOf(this.visualArea)
  }

  /**
   * Current occupied board height implied by `visualArea`.
   * @returns Height required to contain the board shape.
   */
  get height(): number {
    return heightOf(this.visualArea)
  }

  /**
   * Trims all bitboards to the state's current logical height.
   * @returns The same state for chaining.
   */
  trim(): this {
    const height = this.height

    this.visualArea = toHeight(this.visualArea, height)
    this.logicalArea = toHeight(this.logicalArea, height)
    this.player = toHeight(this.player, height)
    this.opponent = toHeight(this.opponent, height)
    this.ko = toHeight(this.ko, height)
    this.target = toHeight(this.target, height)
    this.immortal = toHeight(this.immortal, height)
    this.external = toHeight(this.external, height)
    this.dead = toHeight(this.dead, height)

    return this
  }

  /**
   * Returns the canonical pass move bitboard for this state.
   * @returns Empty move bitboard representing pass.
   */
  passMove(): Stones {
    return emptyStones(this.height)
  }

  /**
   * An array of strings suitable for rendering the goban in the console.
   * @returns ANSI-rendered board rows.
   */
  displayLines(): string[] {
    const black = this.whiteToPlay ? this.opponent : this.player
    const white = this.whiteToPlay ? this.player : this.opponent

    const width = this.width
    const height = this.height
    const result = ['\x1b[0;30;46m╔═' + '══'.repeat(width) + '╗\x1b[0m']
    for (let y = 0; y < height; ++y) {
      const visualArea = this.visualArea[y]!
      const logicalArea = this.logicalArea[y]!
      const target = this.target[y]!
      const immortal = this.immortal[y]!
      const external = this.external[y]!
      const ko = this.ko[y]!
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
        if (p & black[y]!) {
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
          } else if (p & white[y]!) {
            line += ' #'
          } else {
            line += ' @'
          }
        } else if (p & white[y]!) {
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

  /**
   * Logs an ANSI-rendered board snapshot to the console.
   * @returns Nothing.
   */
  log() {
    console.log(this.displayLines().join('\n'))
  }

  /**
   * Plays a move by bitboard or coordinates.
   * @param move Bitboard containing one move point.
   * @returns Result classification of the attempted move.
   */
  makeMove(move: Stones): MoveResult
  /**
   * Plays a move by coordinates.
   * @param x X coordinate.
   * @param y Y coordinate.
   * @returns Result classification of the attempted move.
   */
  makeMove(x: number, y: number): MoveResult
  makeMove(moveOrX: Stones | number, y?: number): MoveResult {
    const height = this.height
    let move: Stones | undefined = undefined
    let x = -1
    if (typeof moveOrX === 'number') {
      x = moveOrX
      if (y === undefined) {
        throw new Error('Y-coordinate must be given with x-coordinate')
      }
      if (x >= 0) {
        move = single(x, y, height)
      }
    } else {
      move = toHeight(moveOrX, height)
      ;({ x, y } = coordsOf(move))
    }
    let result = MoveResult.Normal
    const oldPlayer = clone(this.player)
    // Handle pass
    if (move === undefined || y === undefined || x < 0) {
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
      stonesNot(this.logicalArea, height),
      stonesXor(this.player, this.external),
      this.opponent,
    )
    if (overlaps(move, nonEmpty)) {
      return MoveResult.Illegal
    }

    if (overlaps(move, this.external)) {
      merge(this.immortal, move)
      flip(this.external, move)
      result = MoveResult.FillExternal
    }

    merge(this.player, move)
    clear(this.ko)

    // Opponent's stones killed
    const kill = emptyStones(height)

    // Potential liberties for opponent's stones (visual non-logical liberties count as permanent)
    const empty = stonesAnd(this.visualArea, invertInPlace(stonesXor(this.player, this.external)))

    let chain: Stones

    function killChain_(this: State) {
      flood(chain, this.opponent)
      if (isEmpty(liberties(chain, empty)) && !overlaps(chain, this.immortal)) {
        merge(kill, chain)
        // Note that you'd need to do `flip(this.opponent, chain)` here and count the prisoners for Japanse-style scoring
      }
    }
    const killChain = killChain_.bind(this)
    chain = single(x, y - 1, height)
    killChain()
    chain = single(x + 1, y, height)
    killChain()
    chain = single(x - 1, y, height)
    killChain()
    chain = single(x, y + 1, height)
    killChain()

    // Chinese-style scoring only
    flip(this.opponent, kill)

    // Check legality
    chain = clone(move)
    flood(chain, stonesAnd(this.player, stonesNot(this.external, height)))
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
    libs = liberties(chain, stonesAnd(this.logicalArea, stonesNot(this.opponent, height)))
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
    ;[this.player, this.opponent] = [this.opponent, this.player]
    this.passes = 0
    this.koThreats = -this.koThreats
    this.button = -this.button
    this.whiteToPlay = !this.whiteToPlay

    if (overlaps(kill, this.target)) {
      return MoveResult.TakeTarget
    }

    return result
  }

  /**
   * Swaps `player` and `opponent`, flipping perspective state fields.
   * @returns Nothing.
   */
  swapPlayers() {
    ;[this.player, this.opponent] = [this.opponent, this.player]
    clear(this.ko)
    this.koThreats = -this.koThreats
    this.button = -this.button
    this.whiteToPlay = !this.whiteToPlay
  }

  /**
   * Re-colors selected stones and updates dependent target/immortal/external masks.
   * @param stones Stones to flip ownership/state for.
   * @param external External-mask hints for converted stones.
   * @param flipWhite Whether the provided mask is white-oriented.
   * @returns Nothing.
   */
  flipStones(stones: Stones, external: Stones, flipWhite: boolean) {
    const height = this.height
    stones = toHeight(stones, height)
    const player = this.whiteToPlay === flipWhite ? this.player : this.opponent
    const opponent = this.whiteToPlay === flipWhite ? this.opponent : this.player

    const newImmortal = stonesAnd(this.external, stones)
    const newExternal = stonesAnd(this.immortal, external, stones)

    subtract(opponent, stones)
    subtract(this.target, stones)
    subtract(this.immortal, stones)
    subtract(this.external, stones)
    merge(this.logicalArea, stones)
    merge(this.immortal, newImmortal)
    merge(this.external, newExternal)
    flip(player, stones, newExternal, newImmortal)
    for (const chain of chains(stonesAnd(player, stonesNot(this.external, height)))) {
      if (overlaps(chain, this.immortal)) {
        merge(this.immortal, chain)
      }
      if (overlaps(chain, this.target)) {
        merge(this.target, chain)
      }
    }
    subtract(this.logicalArea, this.immortal, this.target)
  }

  /**
   * Returns coordinates available for flipping to black.
   * @returns Coordinates that can be toggled into black ownership.
   */
  availableBlackFlips() {
    const white = this.whiteToPlay ? this.player : this.opponent
    return gridOf(stonesXor(this.logicalArea, stonesAnd(this.external, white)))
  }

  /**
   * Returns coordinates available for flipping to white.
   * @returns Coordinates that can be toggled into white ownership.
   */
  availableWhiteFlips() {
    const black = this.whiteToPlay ? this.opponent : this.player
    return gridOf(stonesXor(this.logicalArea, stonesAnd(this.external, black)))
  }

  /**
   * Converts internal bitboards into a flat, render-ready grid model.
   * @returns Flattened grid cells for UI rendering.
   */
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
        const r = new State(this).makeMove(x, y)
        const move = single(x, y, height)
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
          } else if (overlaps(move, this.dead)) {
            status = 'dead'
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

  /**
   * Computes area-like control score without removing dead stones.
   * @returns Liberty-based score from current player's perspective.
   */
  chineseLibertyScore(): number {
    const empty = stonesOr(
      stonesAnd(this.visualArea, invertInPlace(stonesOr(this.player, this.opponent))),
      this.external,
    )

    const notExt = stonesNot(this.external, this.height)
    const playerControlled = stonesAnd(this.player, notExt)
    const opponentControlled = stonesAnd(this.opponent, notExt)

    merge(playerControlled, liberties(playerControlled, empty))
    merge(opponentControlled, liberties(opponentControlled, empty))

    return stonesCount(playerControlled) - stonesCount(opponentControlled)
  }

  /**
   * Computes area score including dead/external adjustments.
   * @returns Area score from current player's perspective.
   */
  areaScore(): number {
    const height = this.height
    const empty = stonesAnd(this.visualArea, invertInPlace(stonesOr(this.player, this.opponent)))
    merge(empty, this.external, this.dead)

    const notExt = stonesNot(this.external, height)
    const notDead = stonesNot(this.dead, height)
    const playerControlled = stonesAnd(this.player, notExt, notDead)
    const opponentControlled = stonesAnd(this.opponent, notExt, notDead)

    bleed(playerControlled, empty)
    bleed(opponentControlled, empty)

    return stonesCount(playerControlled) - stonesCount(opponentControlled)
  }

  /**
   * Computes score in Q7 fixed-point, including button and ko-threat bonuses.
   * @returns Score in Q7 fixed-point format.
   */
  scoreQ7(): number {
    return (
      this.areaScore() * SCORE_Q7_SCALE + this.button * BUTTON_Q7 + this.koThreats * KO_THREAT_Q7
    )
  }
  /**
   * Computes score as floating-point points.
   * @returns Score in points.
   */
  score(): number {
    return this.scoreQ7() / SCORE_Q7_SCALE
  }

  /**
   * Computes Q7 score for terminal target-loss outcomes.
   * @returns Terminal target-loss score in Q7 fixed-point.
   */
  targetLostScoreQ7(): number {
    return this.button * BUTTON_Q7 + this.koThreats * KO_THREAT_Q7 - TARGET_CAPTURED_SCORE_Q7
  }
  /**
   * Computes floating-point score for terminal target-loss outcomes.
   * @returns Terminal target-loss score in points.
   */
  targetLostScore(): number {
    return this.targetLostScoreQ7() / SCORE_Q7_SCALE
  }

  /**
   * Expands the visual board up to the requested dimensions.
   * @param width Minimum width to stretch to.
   * @param height Minimum height to stretch to.
   * @returns Nothing.
   */
  stretchTo(width: number, height: number) {
    if ((width || height) && isEmpty(this.visualArea)) {
      this.visualArea = single(0, 0, 1)
    }
    if (width > WIDTH) {
      throw new Error(`Cannot stretch width beyond implementation limit ${WIDTH}`)
    }
    while (this.width < width) {
      merge(this.visualArea, east(this.visualArea))
    }
    if (this.height < height) {
      this.visualArea = toHeight(this.visualArea, height)
      while (this.height < height) {
        merge(this.visualArea, south(this.visualArea))
      }
      this.trim()
    }
  }

  /**
   * Tests deep equality across all serialized gameplay fields.
   * @param other State to compare with.
   * @returns `true` when all gameplay fields are equal.
   */
  equals(other: State): boolean {
    return (
      equals(this.visualArea, other.visualArea) &&
      equals(this.logicalArea, other.logicalArea) &&
      equals(this.player, other.player) &&
      equals(this.opponent, other.opponent) &&
      equals(this.ko, other.ko) &&
      equals(this.target, other.target) &&
      equals(this.immortal, other.immortal) &&
      equals(this.external, other.external) &&
      this.passes === other.passes &&
      this.koThreats === other.koThreats &&
      this.whiteToPlay === other.whiteToPlay
    )
  }
}
