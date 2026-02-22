<script setup lang="ts">
import('@/assets/tsumego.css')

import { ref, reactive, computed } from 'vue'
import { type Coords, rectangle, single, clone } from '../core/bitboard'
import { type StateJSON, MoveResult, State } from '../core/state'
import { type SolutionInfo } from '../core/solver'
import { MIN_WIDTH, MIN_HEIGHT, formatGain, passStyle } from '../util'
import TheGoban from '../components/TheGoban.vue'
import ButtonBar from '../components/ButtonBar.vue'

const props = defineProps<{ collection: string }>()

const API_URL = import.meta.env.VITE_API_URL

const data = ref<{ title: string; state?: StateJSON }>({
  title: props.collection,
})
const error = ref<Error | null>(null)

const busy = ref(true)
const done = ref(false)

const gameState = reactive(new State())
gameState.visualArea = rectangle(MIN_WIDTH, MIN_HEIGHT)
gameState.logicalArea = rectangle(MIN_WIDTH, MIN_HEIGHT)

const maxThreats = ref(0)
const info = ref<SolutionInfo | undefined>(undefined)

const playMode = ref<'play' | 'black' | 'white'>('play')

const blackFlips = ref<Coords[]>([])
const whiteFlips = ref<Coords[]>([])

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
  await getInfo({ state: gameState.toJSON() })
}

async function swapPlayers() {
  gameState.swapPlayers()
  await getInfo({ state: gameState.toJSON() })
}

async function getInfo(query: { state: StateJSON }) {
  const response = await fetch(`${API_URL}/tsumego/${props.collection}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(query),
  })
  const json = await response.json()
  info.value = json
  return json
}

async function play(x: number, y: number) {
  if (busy.value || done.value) {
    return
  }
  busy.value = true
  if (playMode.value === 'play') {
    const r = gameState.makeMove(single(x, y))
    if (r <= MoveResult.TakeTarget) {
      done.value = true
      return
    }
  } else {
    gameState.flipStones(single(x, y), playMode.value === 'white')

    // Trigger `reactive()`
    gameState.player = clone(gameState.player)
  }
  await getInfo({ state: gameState.toJSON() })
  busy.value = false
}

function init() {
  busy.value = true
  done.value = false
  info.value = undefined
  fetch(`${API_URL}/tsumego/${props.collection}/`)
    .then((res) => res.json())
    .then((json) => {
      maxThreats.value = Math.abs(json.root.koThreats)
      json.state = json.root
      data.value = json
      gameState.assignFromJSON(json.state)
      gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
      blackFlips.value = gameState.availableBlackFlips()
      whiteFlips.value = gameState.availableWhiteFlips()
      return json
    })
    .then(getInfo)
    .then(() => {
      busy.value = false
    })
    .catch((err) => (error.value = err))
}

init()
</script>

<template>
  <main>
    <h1>{{ data.title }}</h1>
    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="goban-container">
        <TheGoban
          :state="gameState"
          :busy="busy"
          :solutionInfo="done ? undefined : info"
          :blackFlips="playMode === 'black' ? blackFlips : undefined"
          :whiteFlips="playMode === 'white' ? whiteFlips : undefined"
          @play="play"
        />
      </div>
      <div>
        <button @click="play(-1, -1)" :disabled="busy" :style="myPassStyle">
          pass {{ passGain }}
        </button>
        <button @click="swapPlayers">swap players</button>
      </div>
      <div class="button-bar-container">
        <ButtonBar v-model="playMode" />
      </div>
      <div>
        <label for="ko-threats">Ko-threats: </label>
        <input
          id="ko-threats"
          v-model="gameState.koThreats"
          :min="-maxThreats"
          :max="maxThreats"
          @change="onStateChange"
          type="number"
        />
        <label for="button"> Button: </label>
        <input
          id="button"
          v-model="gameState.button"
          :min="-1"
          :max="1"
          @change="onStateChange"
          type="number"
        />
      </div>
      <p v-if="done">Done</p>
      <div>
        <button @click="init">reset</button>
      </div>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
.button-bar-container {
  max-width: 12em;
}
</style>
