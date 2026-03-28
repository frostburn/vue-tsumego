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
  formatLoss,
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
import StatusIndicator from '../components/StatusIndicator.vue'

const props = defineProps<{ collection: string; tsumego?: string }>()

const data = ref<{ title: string; subtitle: string; state?: StateJSON; botToPlay?: boolean }>({
  title: props.collection,
  subtitle: props.tsumego ?? 'Custom Study',
})
const error = ref<Error | null>(null)

const done = ref(false)
const success = ref(false)
const totalLoss = ref(0)

const busy = ref(true)

const whiteToPlay = ref(false)
const koThreats = ref(0)

const gameState = reactive(new State())
gameState.visualArea = rectangle(MIN_WIDTH, MIN_HEIGHT)
gameState.logicalArea = rectangle(MIN_WIDTH, MIN_HEIGHT)

const undos = reactive<[StateJSON, number][]>([])

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

const showInfo = computed(() => !done.value && (success.value || totalLoss.value > 0))

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
  const undo: [StateJSON, number] = [stateJSON.value, totalLoss.value]
  for (const move of info.value.moves) {
    if (move.x === x && move.y === y && move.lowGain !== 0) {
      totalLoss.value -= move.lowGain
    }
  }
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
  if (totalLoss.value > 0 || success.value) {
    playerInfo.value = info.value
  }
  busy.value = false
  koThreats.value = gameState.koThreats
}

async function doUndo() {
  const [undo, loss] = undos.pop()!
  gameState.assignFromJSON(undo)
  totalLoss.value = loss
  success.value = false
  done.value = false
  busy.value = true
  await getInfo()
  busy.value = false
}

function init() {
  done.value = false
  success.value = false
  totalLoss.value = 0
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

    <div class="status-container">
      <StatusIndicator :fail="totalLoss > 0" :success="success" />
    </div>

    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="tsumego-layout">
        <section class="card board-card" aria-label="Board position">
          <div class="goban-container">
            <TheGoban
              :state="gameState"
              :busy="busy || done"
              :solutionInfo="showInfo ? playerInfo : undefined"
              @play="play"
            />
          </div>
        </section>

        <div class="sidebar">
          <section class="card" aria-labelledby="tsumego-controls-heading">
            <h2 id="tsumego-controls-heading">Play Actions</h2>
            <p class="section-help">Solve the problem by choosing local winning moves.</p>
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
                class="action-button button-secondary undo"
                @click="doUndo"
                :disabled="!undos.length"
              >
                undo
              </button>
            </div>
          </section>

          <section class="card" aria-labelledby="tsumego-session-heading">
            <h2 id="tsumego-session-heading">Session</h2>
            <p class="section-help">Color to play and threat context for this problem.</p>
            <div class="session-row">
              <span class="indicator-container" aria-hidden="true">
                <PlayerIndicator :whiteToPlay="whiteToPlay" />
              </span>
              <p class="turn-label">{{ playerToMoveLabel }}</p>
            </div>
            <p class="ko-threats-line">Ko-threats: {{ koThreats }}</p>
          </section>

          <section class="card" aria-labelledby="tsumego-status-heading">
            <h2 id="tsumego-status-heading">Status</h2>
            <p class="section-help">Track the current result and board reset controls.</p>
            <p v-if="totalLoss" class="status-line">
              <b>Failed:</b> {{ formatLoss(totalLoss) }} score lost in total
            </p>
            <p v-else-if="success" class="status-line">Success</p>
            <p v-if="done" class="status-line">Done</p>
            <div class="button-row">
              <button class="action-button button-secondary" :disabled="busy" @click="init">
                reset
              </button>
            </div>
          </section>
        </div>
      </div>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
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
.status-container {
  display: inline-block;
  margin-left: 5em;
  height: 3em;
  width: 3em;
  vertical-align: bottom;
  padding-bottom: 0.4em;
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
  margin-left: 0.5em;
  color: var(--color-label-text);
  font-weight: 600;
}

.ko-threats-line {
  font-size: 1.2em;
  font-weight: 600;
}

.status-line {
  margin: 0.3em 0 0;
}
</style>
