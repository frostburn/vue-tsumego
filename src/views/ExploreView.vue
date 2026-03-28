<script setup lang="ts">
import('@/assets/tsumego.css')

import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { type Coords, rectangle, single, clone, emptyStones } from '../core/bitboard'
import { type StateJSON, MoveResult, State } from '../core/state'
import { type SolutionInfo } from '../core/solver'
import {
  MIN_WIDTH,
  MIN_HEIGHT,
  formatGain,
  passStyle,
  API_URL,
  fetchJson,
  getSolutionInfo,
  markDeadStones,
  encodeQuery,
  decodeQuery,
  type ExploreResponse,
} from '../util'
import TheGoban from '../components/TheGoban.vue'
import ButtonBar from '../components/ButtonBar.vue'
import NumericSlider from '../components/NumericSlider.vue'

const props = defineProps<{ collection: string }>()

const data = ref<{ title: string; state?: StateJSON }>({
  title: props.collection,
})
const error = ref<Error | null>(null)

const busy = ref(true)
const done = ref(false)

const gameState = reactive(new State())
gameState.visualArea = rectangle(MIN_WIDTH, MIN_HEIGHT)
gameState.logicalArea = rectangle(MIN_WIDTH, MIN_HEIGHT)

const undos = reactive<StateJSON[]>([])

const external = ref(emptyStones())

const maxThreats = ref(0)
const info = ref<SolutionInfo | undefined>(undefined)

const playMode = ref<'play' | 'black' | 'white'>('play')

const blackFlips = ref<Coords[]>([])
const whiteFlips = ref<Coords[]>([])

const sharedURL = ref('')

const sharedURLSplash = ref(false)

let root = new State()
const route = useRoute()
const router = useRouter()
let initRequestToken = 0

const stateJSON = computed(() => gameState.toJSON())

const passGain = computed(() => {
  if (info.value === undefined) {
    return '-0.0'
  }
  for (const move of info.value.moves) {
    if (move.x < 0) {
      return formatGain(move)
    }
  }
  return '(error)'
})

const myPassStyle = computed(() => passStyle(info.value))

const playModeLabel = computed(() => {
  if (playMode.value === 'black') {
    return 'Editing as Black'
  }
  if (playMode.value === 'white') {
    return 'Editing as White'
  }
  return 'Play mode active'
})

const playModeHelp = computed(() => {
  if (playMode.value === 'play') {
    return 'Tap intersections to play alternating moves and analyze the position naturally.'
  }
  return `Tap intersections to toggle ${playMode.value} stones without making gameplay moves.`
})

const buttonModel = computed({
  get: () => (gameState.whiteToPlay ? -gameState.button : gameState.button),
  async set(newValue: number) {
    if (gameState.whiteToPlay) {
      gameState.button = -newValue
    } else {
      gameState.button = newValue
    }
    await onStateChange()
  },
})

const buttonLabel = computed(() => {
  if (!buttonModel.value) {
    return 'Button unclaimed'
  }
  if (buttonModel.value > 0) {
    return 'Button claimed by Black'
  }
  return 'Button claimed by White'
})

async function onStateChange() {
  busy.value = true
  await clearSharedURLAndGetInfo()
  busy.value = false
}

async function incThreats(delta: number) {
  gameState.koThreats = Math.max(
    -maxThreats.value,
    Math.min(maxThreats.value, gameState.koThreats + delta),
  )
  await onStateChange()
}

async function swapPlayers() {
  gameState.swapPlayers()
  await onStateChange()
}

async function clearSharedURLAndGetInfo() {
  sharedURL.value = ''
  info.value = await getSolutionInfo(props.collection, { state: stateJSON.value })
}

async function play(x: number, y: number) {
  if (busy.value || done.value) {
    return
  }
  busy.value = true
  const undo = stateJSON.value
  if (playMode.value === 'play' || x < 0) {
    const r = gameState.makeMove(x, y)
    if (r == MoveResult.Illegal) {
      busy.value = false
      return
    }
    undos.push(undo)
    if (r == MoveResult.SecondPass) {
      await markDeadStones(props.collection, gameState)
    }
    if (r <= MoveResult.TakeTarget) {
      done.value = true
      busy.value = false
      return
    }
  } else {
    gameState.flipStones(single(x, y), external.value, playMode.value === 'white')
    undos.push(undo)
    // Trigger `reactive()`
    gameState.player = clone(gameState.player)
  }
  await clearSharedURLAndGetInfo()
  busy.value = false
}

function sharePosition(name: string) {
  const href = router.resolve({
    name,
    params: { collection: props.collection },
    query: { s: encodeQuery(root, gameState) },
  }).href
  sharedURL.value = new URL(href, window.location.origin).toString()
  if (window.navigator.clipboard) {
    window.navigator.clipboard.writeText(sharedURL.value)
    sharedURLSplash.value = true
    window.setTimeout(() => {
      sharedURLSplash.value = false
    }, 3000)
  }
}

async function doUndo() {
  const undo = undos.pop()!
  gameState.assignFromJSON(undo)
  done.value = false
  busy.value = true
  await clearSharedURLAndGetInfo()
  busy.value = false
}

function isLatestInit(token: number) {
  return token === initRequestToken
}

async function init() {
  const token = ++initRequestToken
  busy.value = true
  done.value = false
  info.value = undefined
  error.value = null
  undos.length = 0
  try {
    const json = await fetchJson<ExploreResponse>(new URL(`tsumego/${props.collection}/`, API_URL))
    if (!isLatestInit(token)) {
      return
    }
    maxThreats.value = Math.abs(json.root.koThreats)
    gameState.assignFromJSON(json.root)
    if (json.canStretch) {
      gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
    }
    blackFlips.value = gameState.availableBlackFlips()
    whiteFlips.value = gameState.availableWhiteFlips()
    external.value = clone(gameState.external)
    root = new State(gameState)
    if (route.query?.s && !Array.isArray(route.query.s)) {
      const state = decodeQuery(root, route.query.s)
      json.state = state.toJSON()
      gameState.assignFromJSON(json.state)
    } else {
      // Default to zero ko-threats
      gameState.koThreats = 0
      json.state = gameState.toJSON()
    }
    if (!isLatestInit(token)) {
      return
    }
    data.value = json

    const solution = await getSolutionInfo(props.collection, { state: json.state! })
    if (!isLatestInit(token)) {
      return
    }
    info.value = solution
    busy.value = false
  } catch (err) {
    if (!isLatestInit(token)) {
      return
    }
    error.value = err as Error
    busy.value = false
  }
}

onMounted(init)
</script>

<template>
  <main>
    <h1>{{ data.title }}</h1>
    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="tsumego-layout">
        <section class="card board-card" aria-label="Board position">
          <div class="goban-container">
            <TheGoban
              :state="gameState"
              :busy="busy || done"
              :solutionInfo="done ? undefined : info"
              :blackFlips="playMode === 'black' ? blackFlips : undefined"
              :whiteFlips="playMode === 'white' ? whiteFlips : undefined"
              @play="play"
            />
          </div>
        </section>

        <div class="sidebar">
          <section class="card" aria-labelledby="play-actions-heading">
            <h2 id="play-actions-heading">Play Actions</h2>
            <p class="section-help">Core controls for stepping through the position.</p>
            <div class="button-row">
              <button
                class="action-button button-primary"
                @click="play(-1, -1)"
                :disabled="busy || done"
                :style="myPassStyle"
              >
                pass {{ passGain }}
              </button>
              <button
                class="swap action-button button-secondary"
                @click="swapPlayers"
                :disabled="busy || done"
              >
                swap colors
              </button>
              <button
                class="undo action-button button-secondary"
                @click="doUndo"
                :disabled="!undos.length"
              >
                undo
              </button>
            </div>
          </section>

          <section class="card" aria-labelledby="edit-mode-heading">
            <h2 id="edit-mode-heading">Edit Mode</h2>
            <p class="section-help">Switch between normal play and manual stone editing.</p>
            <div class="button-bar-container">
              <ButtonBar :whiteToPlay="gameState.whiteToPlay" v-model="playMode" />
            </div>
            <p class="mode-label">{{ playModeLabel }}</p>
            <p class="section-help">{{ playModeHelp }}</p>
          </section>

          <section class="card" aria-labelledby="position-params-heading">
            <h2 id="position-params-heading">Position Params</h2>
            <p class="section-help">Tune ko-threat count and button state for this setup.</p>
            <div class="param-grid">
              <div class="param-field">
                <label for="ko-threats">Ko-threats</label>
                <div class="stepper">
                  <input
                    id="ko-threats"
                    v-model="gameState.koThreats"
                    :disabled="busy || done"
                    :min="-maxThreats"
                    :max="maxThreats"
                    @change="onStateChange"
                    type="number"
                    step="1"
                  />
                  <button
                    type="button"
                    class="stepper-button button-tertiary"
                    :disabled="busy || done || gameState.koThreats === -maxThreats"
                    @click="incThreats(-1)"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    class="stepper-button button-tertiary"
                    :disabled="busy || done || gameState.koThreats === maxThreats"
                    @click="incThreats(+1)"
                  >
                    +
                  </button>
                </div>
              </div>

              <div class="param-field">
                <label for="button">{{ buttonLabel }}</label>
                <NumericSlider
                  id="button"
                  v-model="buttonModel"
                  :disabled="busy || done"
                  :min="-1"
                  :max="1"
                  :step="1"
                  @change="onStateChange"
                />
              </div>
            </div>
          </section>

          <section class="card" aria-labelledby="session-heading">
            <h2 id="session-heading">Session</h2>
            <p class="section-help">Reset the board or copy links to share your work.</p>
            <div class="button-row">
              <button class="action-button button-secondary" @click="init" :disabled="busy">
                reset
              </button>
              <button
                class="action-button button-secondary"
                @click="sharePosition('explore')"
                :disabled="busy"
              >
                share position
              </button>
              <button
                class="action-button button-secondary"
                @click="sharePosition('custom-tsumego')"
                :disabled="busy"
              >
                share problem
              </button>
            </div>
            <input
              class="shared-url"
              v-if="sharedURL.length"
              type="text"
              v-model="sharedURL"
              readonly
            />
            <p v-if="sharedURLSplash" class="status-message">URL copied to the clipboard</p>
            <p v-if="done" class="status-message">Done</p>
          </section>
        </div>
      </div>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
.mode-label {
  color: var(--color-label-text);
  margin: 0.45rem 0 0;
  font-weight: 600;
}

.stepper-button {
  border: 1px solid var(--color-border);
  border-radius: 0.45em;
  font: inherit;
  margin: 0;
}

.button-bar-container {
  display: inline-block;
  max-width: 12em;
}

.param-grid {
  display: grid;
  gap: 0.5em;
}

.param-field {
  display: grid;
  gap: 0.25em;
}

.stepper {
  display: grid;
  grid-template-columns: minmax(4.5rem, 8rem) auto auto;
  gap: 0.32rem;
  align-items: center;
}

.stepper input {
  min-height: 2.1em;
  padding: 0.18em 0.4em;
}

.stepper-button {
  min-width: 2em;
  min-height: 2.1em;
}

#button {
  accent-color: black;
}

.shared-url {
  width: 100%;
  margin-top: 0.6em;
}

.status-message {
  margin: 0.55em 0 0;
}
</style>
