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

async function onStateChange() {
  busy.value = true
  await getInfo()
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

async function getInfo() {
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
  await getInfo()
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
  await getInfo()
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
        // The root is unstretched but it shouldn't affect getSolutionInfo()
        json.state = json.root
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
      <div>
        <button @click="play(-1, -1)" :disabled="busy || done" :style="myPassStyle">
          pass {{ passGain }}
        </button>
        <button @click="swapPlayers" :disabled="busy || done">swap players</button>
      </div>
      <div class="controls">
        <div class="button-bar-container">
          <ButtonBar :whiteToPlay="gameState.whiteToPlay" v-model="playMode" />
        </div>
        <button class="undo" @click="doUndo" :disabled="!undos.length" />
      </div>
      <div>
        <label for="ko-threats">Ko-threats: </label>
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
          class="inline-control"
          :disabled="busy || done || gameState.koThreats === -maxThreats"
          @click="incThreats(-1)"
        >
          -
        </button>
        <button
          type="button"
          class="inline-control"
          :disabled="busy || done || gameState.koThreats === maxThreats"
          @click="incThreats(+1)"
        >
          +
        </button>
        <label for="button"> Button: </label>
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
          class="inline-control"
          :disabled="busy || done || gameState.button === -1"
          @click="incButton(-1)"
        >
          -
        </button>
        <button
          type="button"
          class="inline-control"
          :disabled="busy || done || gameState.button === 1"
          @click="incButton(+1)"
        >
          +
        </button>
      </div>
      <div>
        <button @click="init" :disabled="busy">reset</button>
        <button @click="sharePosition('explore')" :disabled="busy">share position</button>
        <button @click="sharePosition('custom-tsumego')" :disabled="busy">share problem</button>
      </div>
      <div>
        <input
          class="shared-url"
          v-if="sharedURL.length"
          type="text"
          v-model="sharedURL"
          readonly
        />
      </div>
      <p v-if="sharedURLSplash">URL copied to the clipboard</p>
      <p v-if="done">Done</p>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
.button-bar-container {
  display: inline-block;
  max-width: 12em;
}
input.shared-url {
  width: 33em;
}
button.inline-control {
  min-width: 0;
  height: auto;
  margin: 0 0.3em;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-link);
  font: inherit;
  cursor: pointer;
}
button.inline-control:disabled {
  color: var(--color-link-disabled);
  cursor: default;
}
@media (hover: hover) {
  button.inline-control:not(:disabled):hover {
    background-color: var(--color-link-hover-bg);
  }
}
</style>
