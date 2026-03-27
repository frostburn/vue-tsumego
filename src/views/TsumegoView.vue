<script setup lang="ts">
import('@/assets/tsumego.css')

import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { rectangle } from '../core/bitboard'
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
  decodeQuery,
  type CollectionRootResponse,
  type TsumegoResponse,
} from '../util'
import { useTsumegoStore } from '../stores/tsumego'
import TheGoban from '../components/TheGoban.vue'
import PlayerIndicator from '../components/PlayerIndicator.vue'

const props = defineProps<{ collection: string; tsumego?: string }>()

const data = ref<{ title: string; subtitle: string; state?: StateJSON; botToPlay?: boolean }>({
  title: props.collection,
  subtitle: props.tsumego ?? 'Custom Study',
})
const error = ref<Error | null>(null)

const done = ref(false)
const success = ref(false)
const fail = ref(false)

const busy = ref(true)

const whiteToPlay = ref(false)
const koThreats = ref(0)

const gameState = reactive(new State())
gameState.visualArea = rectangle(MIN_WIDTH, MIN_HEIGHT)
gameState.logicalArea = rectangle(MIN_WIDTH, MIN_HEIGHT)

const undos = reactive<StateJSON[]>([])

// Info is used for grading player moves and making bot moves
const info = ref<SolutionInfo | undefined>(undefined)

// Player info is displayed in the UI
const playerInfo = ref<SolutionInfo | undefined>(undefined)

const previous = ref<{ collection: string; tsumego: string } | null>(null)
const next = ref<{ collection: string; tsumego: string } | null>(null)

let root = new State()
const route = useRoute()

const tsumegoStore = useTsumegoStore()

const stateJSON = computed(() => gameState.toJSON())

const showInfo = computed(() => !done.value && (success.value || fail.value))

const passGain = computed(() => {
  if (!showInfo.value) {
    return ''
  }
  if (playerInfo.value === undefined) {
    return '-0.0'
  }
  for (const move of playerInfo.value.moves) {
    if (move.x < 0) {
      return formatGain(move)
    }
  }
  return '(error)'
})

const myPassStyle = computed(() => {
  if (!showInfo.value) {
    return {}
  }
  return passStyle(playerInfo.value)
})

const playerToMoveLabel = computed(() => (whiteToPlay.value ? 'White to play' : 'Black to play'))

async function getInfo() {
  const json = await getSolutionInfo(props.collection, { state: stateJSON.value })
  info.value = json
  return json
}

async function playForcingMove(json: SolutionInfo) {
  const forcingMoves = []
  for (const move of json.moves) {
    if (move.forcing) {
      forcingMoves.push(move)
    }
  }
  if (!forcingMoves.length) {
    for (const move of json.moves) {
      if (!move.highGain) {
        forcingMoves.push(move)
      }
    }
  }
  const { x, y } = forcingMoves[Math.floor(Math.random() * forcingMoves.length)]!
  if (x < 0) {
    success.value = true
  }
  const r = gameState.makeMove(x, y)
  if (r == MoveResult.SecondPass) {
    await markDeadStones(props.collection, gameState)
  }
  if (r <= MoveResult.TakeTarget) {
    return false
  }
  await getInfo()
  return true
}

async function play(x: number, y: number) {
  if (busy.value || done.value || info.value === undefined) {
    return
  }
  busy.value = true
  for (const move of info.value.moves) {
    if (move.x === x && move.y === y && move.lowGain !== 0) {
      fail.value = true
    }
  }
  const undo = stateJSON.value
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
    success.value = true
    busy.value = false
    return
  }
  const json = await getInfo()
  const keepGoing = await playForcingMove(json)
  if (!keepGoing) {
    done.value = true
  }
  for (const move of info.value.moves) {
    if (move.x === -1 && move.lowGain === 0) {
      success.value = true
    }
  }
  if (fail.value || success.value) {
    playerInfo.value = info.value
  }
  busy.value = false
  koThreats.value = gameState.koThreats
}

async function doUndo() {
  const undo = undos.pop()!
  gameState.assignFromJSON(undo)
  fail.value = false
  success.value = false
  done.value = false
  busy.value = true
  await getInfo()
  busy.value = false
}

function init() {
  done.value = false
  success.value = false
  fail.value = false
  busy.value = true
  info.value = undefined
  playerInfo.value = undefined
  undos.length = 0
  if (props.tsumego === undefined) {
    fetchJson<CollectionRootResponse>(new URL(`tsumego/${props.collection}/`, API_URL))
      .then((json) => {
        gameState.assignFromJSON(json.root)
        if (json.canStretch) {
          gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
        }
        root = new State(gameState)
        if (route.query?.s && !Array.isArray(route.query.s)) {
          const queryState = decodeQuery(root, route.query.s)
          const state = queryState.toJSON()
          data.value = { title: json.title, subtitle: 'Custom Study', state }
          gameState.assignFromJSON(state)
          return { state }
        } else {
          throw new Error('No custom position found')
        }
      })
      .then((json) => getSolutionInfo(props.collection, json))
      .then((json) => {
        info.value = json
        busy.value = false
        whiteToPlay.value = gameState.whiteToPlay
        koThreats.value = gameState.koThreats
      })
      .catch((err) => (error.value = err))
  } else {
    fetchJson<TsumegoResponse>(new URL(`tsumego/${props.collection}/${props.tsumego}/`, API_URL))
      .then((json) => {
        data.value = json
        gameState.assignFromJSON(json.state)
        if (json.canStretch) {
          gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
        }
        return json
      })
      .then((json) => getSolutionInfo(props.collection, json))
      .then((json) => {
        info.value = json
        if (data.value.botToPlay) {
          playForcingMove(json)
        }
      })
      .then(() => {
        busy.value = false
        whiteToPlay.value = gameState.whiteToPlay
        koThreats.value = gameState.koThreats
      })
      .catch((err) => (error.value = err))
  }
}

async function updateSisterLinks() {
  if (props.tsumego !== undefined) {
    previous.value = await tsumegoStore.previous(props.collection, props.tsumego)
    next.value = await tsumegoStore.next(props.collection, props.tsumego)
  } else {
    previous.value = null
    next.value = null
  }
}

onMounted(init)
onMounted(updateSisterLinks)

watch(() => [props.collection, props.tsumego], init)
watch(() => [props.collection, props.tsumego], updateSisterLinks)
</script>

<template>
  <main>
    <h1>{{ data.title }}: {{ data.subtitle }}</h1>

    <RouterLink v-if="previous" class="sister-tsumego" :to="{ name: 'tsumego', params: previous }"
      >&#10094;</RouterLink
    >
    <span v-else class="sister-tsumego disabled start">|&#10094;</span>
    <RouterLink v-if="next" class="sister-tsumego" :to="{ name: 'tsumego', params: next }"
      >&#10095;</RouterLink
    >
    <span v-else class="sister-tsumego disabled">&#10095;|</span>

    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="tsumego-layout">
        <section class="mode-card board-card" aria-label="Board position">
          <div class="goban-container">
            <TheGoban
              :state="gameState"
              :busy="busy || done"
              :solutionInfo="showInfo ? playerInfo : undefined"
              @play="play"
            />
          </div>
        </section>

        <section class="mode-card controls-card" aria-labelledby="tsumego-controls-heading">
          <h2 id="tsumego-controls-heading">Play Actions</h2>
          <p class="section-help">Solve the problem by choosing local forcing and winning moves.</p>
          <div class="button-row">
            <button
              class="action-button button-primary"
              @click="play(-1, -1)"
              :disabled="busy || done"
              :style="myPassStyle"
            >
              pass {{ passGain }}
            </button>
            <span class="indicator-container">
              <PlayerIndicator :whiteToPlay="whiteToPlay" />
            </span>
            <button
              class="action-button button-secondary undo"
              @click="doUndo"
              :disabled="!undos.length"
            >
              undo
            </button>
          </div>
        </section>

        <section class="mode-card session-card" aria-labelledby="tsumego-session-heading">
          <h2 id="tsumego-session-heading">Session</h2>
          <p class="section-help">Current turn information and board reset controls.</p>
          <div class="session-row">
            <span class="indicator-container" aria-hidden="true">
              <PlayerIndicator :whiteToPlay="whiteToPlay" />
            </span>
            <p class="turn-label">{{ playerToMoveLabel }}</p>
          </div>
          <div class="button-row">
            <button class="action-button button-secondary" :disabled="busy" @click="init">
              reset
            </button>
          </div>
        </section>

        <section class="mode-card status-card" aria-labelledby="tsumego-status-heading">
          <h2 id="tsumego-status-heading">Status</h2>
          <p class="section-help">Track the current result and threat context for this problem.</p>
          <p class="ko-threats-line">
            <span class="ko-threats-label">Ko-threats</span>
            <span class="ko-threats-value">{{ koThreats }}</span>
          </p>
          <p v-if="fail" class="status-line">Failed</p>
          <p v-else-if="success" class="status-line">Success</p>
          <p v-if="done" class="status-line">Done</p>
        </section>
      </div>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
.tsumego-layout {
  display: grid;
  gap: 0.6rem;
  grid-template-columns: 1fr;
  grid-template-areas:
    'board'
    'actions'
    'session'
    'status';
}

.board-card {
  padding: 0.75rem;
  grid-area: board;
}

.controls-card {
  grid-area: actions;
}

.session-card {
  grid-area: session;
}

.status-card {
  grid-area: status;
}

.sister-tsumego {
  font-size: 2.5em;
  font-weight: bold;
  margin-left: 1em;
  margin-right: 1em;
}
.sister-tsumego.disabled {
  color: var(--color-link-disabled);
  cursor: default;
}
.sister-tsumego.disabled.start {
  margin-left: 0.75em;
}
.indicator-container {
  display: inline-block;
  width: 3.9em;
}
.session-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.35rem;
}

.turn-label {
  color: var(--color-label-text);
  font-weight: 600;
}

.ko-threats-line {
  display: flex;
  align-items: baseline;
  gap: 0.45rem;
  margin-top: 0.2rem;
}

.ko-threats-label {
  color: var(--color-label-text);
  font-weight: 600;
}

.ko-threats-value {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-heading);
}

.status-line {
  margin: 0.3em 0 0;
}

@media (min-width: 62rem) {
  .tsumego-layout {
    grid-template-columns: minmax(24rem, 1.9fr) minmax(17rem, 1fr);
    grid-template-areas:
      'board actions'
      'board session'
      'board status';
    align-items: start;
  }
}
</style>
