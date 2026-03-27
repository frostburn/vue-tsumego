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
    return 'Tap intersections to play moves and analyze the position naturally.'
  }
  return `Tap intersections to toggle ${playMode.value} stones without making gameplay moves.`
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

async function incButton(delta: number) {
  gameState.button = Math.max(-1, Math.min(1, gameState.button + delta))
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

function init() {
  busy.value = true
  done.value = false
  info.value = undefined
  undos.length = 0
  fetchJson<ExploreResponse>(new URL(`tsumego/${props.collection}/`, API_URL))
    .then((json) => {
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
      data.value = json
      return json
    })
    .then((json) => getSolutionInfo(props.collection, { state: json.state! }))
    .then((json) => {
      info.value = json
      busy.value = false
    })
    .catch((err) => (error.value = err))
}

onMounted(init)
</script>

<template>
  <main>
    <h1>{{ data.title }}</h1>
    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="explore-layout">
        <section class="explore-card board-card" aria-label="Board position">
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

        <div class="explore-sidebar">
          <section class="explore-card" aria-labelledby="play-actions-heading">
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

          <section class="explore-card" aria-labelledby="edit-mode-heading">
            <h2 id="edit-mode-heading">Edit Mode</h2>
            <p class="section-help">Switch between normal play and manual stone editing.</p>
            <div class="button-bar-container">
              <ButtonBar :whiteToPlay="gameState.whiteToPlay" v-model="playMode" />
            </div>
            <p class="mode-label">{{ playModeLabel }}</p>
            <p class="section-help">{{ playModeHelp }}</p>
          </section>

          <section class="explore-card" aria-labelledby="position-params-heading">
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
                <label for="button">Button</label>
                <div class="stepper">
                  <input
                    id="button"
                    v-model="gameState.button"
                    :disabled="busy || done"
                    :min="-1"
                    :max="1"
                    @change="onStateChange"
                    type="number"
                    step="1"
                  />
                  <button
                    type="button"
                    class="stepper-button button-tertiary"
                    :disabled="busy || done || gameState.button === -1"
                    @click="incButton(-1)"
                  >
                    -
                  </button>
                  <button
                    type="button"
                    class="stepper-button button-tertiary"
                    :disabled="busy || done || gameState.button === 1"
                    @click="incButton(+1)"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section class="explore-card" aria-labelledby="session-heading">
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
.explore-layout {
  --explore-gap: 0.6rem;
  --explore-card-padding: 0.75rem;
  --explore-card-radius: 0.6rem;
  display: grid;
  gap: var(--explore-gap);
  grid-template-columns: 1fr;
  align-items: start;
}

.board-card {
  padding: var(--explore-card-padding);
}

.explore-sidebar {
  display: grid;
  gap: var(--explore-gap);
}

.explore-card {
  background: var(--color-card-background);
  border: 1px solid var(--color-border);
  border-radius: var(--explore-card-radius);
  padding: var(--explore-card-padding);
  margin: 0;
}

.explore-card h2 {
  color: var(--color-label-text);
  font-size: 0.95em;
  margin: 0;
}

.section-help {
  margin: 0.22rem 0 0.5rem;
  color: var(--color-help-text);
  opacity: 0.85;
  font-size: 0.84em;
  line-height: 1.45;
}

.mode-label {
  color: var(--color-label-text);
  margin: 0.45rem 0 0;
  font-weight: 600;
}

.goban-container {
  max-width: 46em;
}

.button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em;
}

.action-button,
.stepper-button {
  border: 1px solid var(--color-border);
  border-radius: 0.45em;
  font: inherit;
  margin: 0;
}

.action-button {
  min-width: 6.6em;
  min-height: 2.3em;
}

.button-primary {
  background: var(--color-background-mute);
  font-weight: 600;
}

.button-secondary {
  background: var(--color-button-background);
  border-color: var(--color-button-border);
  color: var(--color-button-text);
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

.shared-url {
  width: 100%;
  margin-top: 0.6em;
}

.status-message {
  margin: 0.55em 0 0;
}

:where(button, input, [tabindex]):focus-visible {
  outline: 3px solid var(--color-link);
  outline-offset: 2px;
}

@media (min-width: 62rem) {
  .explore-layout {
    grid-template-columns: minmax(24rem, 1.9fr) minmax(17rem, 1fr);
    gap: 1rem;
  }
}
</style>
