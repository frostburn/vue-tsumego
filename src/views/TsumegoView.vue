<script setup lang="ts">
import('@/assets/tsumego.css')

import { ref, reactive, computed } from 'vue'
import { rectangle, single } from '../core/bitboard'
import { type StateJSON, MoveResult, State } from '../core/state'
import { type SolutionInfo } from '../core/solver'
import { MIN_WIDTH, MIN_HEIGHT, formatGain, passStyle } from '../util'
import TheGoban from '../components/TheGoban.vue'

const props = defineProps<{ collection: string; tsumego: string }>()

const API_URL = import.meta.env.VITE_API_URL

const data = ref<{ title: string; subtitle: string; state?: StateJSON; botToPlay?: boolean }>({
  title: props.collection,
  subtitle: props.tsumego,
})
const error = ref<Error | null>(null)

const done = ref(false)
const success = ref(false)
const fail = ref(false)

const busy = ref(true)

const gameState = reactive(new State())
gameState.visualArea = rectangle(MIN_WIDTH, MIN_HEIGHT)
gameState.logicalArea = rectangle(MIN_WIDTH, MIN_HEIGHT)

// Info is used for grading player moves and making bot moves
const info = ref<SolutionInfo | undefined>(undefined)

// Player info is displayed in the UI
const playerInfo = ref<SolutionInfo | undefined>(undefined)

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
  const r = gameState.makeMove(single(x, y))
  if (r <= MoveResult.TakeTarget) {
    return false
  }
  await getInfo({ state: gameState.toJSON() })
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
  const r = gameState.makeMove(single(x, y))
  if (r <= MoveResult.TakeTarget) {
    done.value = true
    success.value = true
    return
  }
  const json = await getInfo({ state: gameState.toJSON() })
  const keepGoing = await playForcingMove(json)
  if (keepGoing) {
    busy.value = false
  } else {
    done.value = true
    success.value = true
  }
  for (const move of info.value.moves) {
    if (move.x == -1 && move.lowGain === 0) {
      success.value = true
    }
  }
  if (fail.value || success.value) {
    playerInfo.value = info.value
  }
}

function init() {
  done.value = false
  success.value = false
  fail.value = false
  busy.value = true
  info.value = undefined
  playerInfo.value = undefined
  fetch(`${API_URL}/tsumego/${props.collection}/${props.tsumego}/`)
    .then((res) => res.json())
    .then((json) => {
      data.value = json
      gameState.assignFromJSON(json.state)
      gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
      return json
    })
    .then(getInfo)
    .then((json) => {
      if (data.value.botToPlay) {
        playForcingMove(json)
      }
    })
    .then(() => {
      busy.value = false
    })
    .catch((err) => (error.value = err))
}

init()
</script>

<template>
  <main>
    <h1>{{ data.title }}: {{ data.subtitle }}</h1>
    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="goban-container">
        <TheGoban
          :state="gameState"
          :busy="busy"
          :solutionInfo="showInfo ? playerInfo : undefined"
          @play="play"
        />
      </div>
      <button @click="play(-1, -1)" :disabled="busy" :style="myPassStyle">
        pass {{ passGain }}
      </button>
      <p v-if="fail">Failed</p>
      <p v-else-if="success">Success</p>
      <p v-if="done">Done</p>
      <button v-if="fail || success || done" @click="init">reset</button>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>
