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
  getSolutionInfo,
  markDeadStones,
  decodeQuery,
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

// Info is used for grading player moves and making bot moves
const info = ref<SolutionInfo | undefined>(undefined)

// Player info is displayed in the UI
const playerInfo = ref<SolutionInfo | undefined>(undefined)

const previous = ref<{ collection: string; tsumego: string } | null>(null)
const next = ref<{ collection: string; tsumego: string } | null>(null)

let root = new State()
const route = useRoute()

const tsumegoStore = useTsumegoStore()

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

async function getInfo() {
  const json = await getSolutionInfo(props.collection, gameState)
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
  const r = gameState.makeMove(x, y)
  if (r == MoveResult.Illegal) {
    busy.value = false
    return
  }
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

function init() {
  done.value = false
  success.value = false
  fail.value = false
  busy.value = true
  info.value = undefined
  playerInfo.value = undefined
  if (props.tsumego === undefined) {
    fetch(new URL(`tsumego/${props.collection}/`, API_URL))
      .then((res) => res.json())
      .then((json) => {
        gameState.assignFromJSON(json.root)
        if (json.canStretch) {
          gameState.stretchTo(MIN_WIDTH, MIN_HEIGHT)
        }
        root = new State(gameState)
        if (route.query?.s && !Array.isArray(route.query.s)) {
          const state = decodeQuery(root, route.query.s)
          const stateJSON = state.toJSON()
          data.value = { title: json.title, subtitle: 'Custom Study', state: stateJSON }
          gameState.assignFromJSON(stateJSON)
          return { state: stateJSON }
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
    fetch(new URL(`tsumego/${props.collection}/${props.tsumego}/`, API_URL))
      .then((res) => res.json())
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

watch(props, init)
watch(props, updateSisterLinks)
</script>

<template>
  <main>
    <h1>{{ data.title }}: {{ data.subtitle }}</h1>
    <RouterLink class="sister-tsumego" v-if="previous" :to="{ name: 'tsumego', params: previous }"
      >&#10094;</RouterLink
    >
    <RouterLink class="sister-tsumego" v-if="next" :to="{ name: 'tsumego', params: next }"
      >&#10095;</RouterLink
    >
    <p v-if="!data.state">Loading...</p>
    <template v-else>
      <div class="goban-container">
        <TheGoban
          :state="gameState"
          :busy="busy || done"
          :solutionInfo="showInfo ? playerInfo : undefined"
          @play="play"
        />
      </div>
      <div class="controls">
        <button @click="play(-1, -1)" :disabled="busy || done" :style="myPassStyle">
          pass {{ passGain }}
        </button>
        <span class="indicator-container">
          <PlayerIndicator :whiteToPlay="whiteToPlay" />
        </span>

        <button v-if="fail || success || done" :disabled="busy" @click="init">reset</button>
      </div>
      <p>Ko-threats: {{ koThreats }}</p>
      <p v-if="fail">Failed</p>
      <p v-else-if="success">Success</p>
      <p v-if="done">Done</p>
    </template>
    <h2 v-if="error">{{ error.message }}</h2>
  </main>
</template>

<style scoped>
.sister-tsumego {
  font-size: 2.5em;
  font-weight: bold;
  magin-left: 1em;
  margin-right: 1em;
}
.controls {
  display: flex;
}
.indicator-container {
  display: inline-block;
  width: 3.9em;
  margin-left: 0.5em;
  margin-right: 0.5em;
}
</style>
