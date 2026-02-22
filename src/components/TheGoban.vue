<script setup lang="ts">
import { type Coords } from '../core/bitboard'
import { type GridSpace, type GridStone, State } from '../core/state'
import { type SolutionInfo, type MoveInfo } from '../core/solver'
import { formatGain, fillGain } from '../util'
import { computed } from 'vue'

const props = defineProps<{
  state: State
  busy: boolean
  solutionInfo?: SolutionInfo
  blackFlips?: Coords[]
  whiteFlips?: Coords[]
}>()
defineEmits(['play'])

const width = computed(() => props.state.width)
const height = computed(() => props.state.height)
const colorToPlay = computed(() => (props.state.whiteToPlay ? 'white' : 'black'))
const otherColor = computed(() => (props.state.whiteToPlay ? 'black' : 'white'))

const grid = computed(() => props.state.toGrid())

const stones = computed<GridStone[]>(
  () => grid.value.filter((item) => item.type === 'black' || item.type === 'white') as GridStone[],
)
const spaces = computed<GridSpace[]>(
  () => grid.value.filter((item) => item.type !== 'black' && item.type !== 'white') as GridSpace[],
)

const viewBox = computed(() => {
  return `-0.7 -0.7 ${width.value + 0.4} ${height.value + 0.4}`
})

function fontSize(info: MoveInfo) {
  const contents = formatGain(info)
  if (contents.length < 3) {
    return '0.4px'
  }
  return `${(1.2 / contents.length).toFixed(4)}px`
}
</script>

<template>
  <svg width="100%" height="100%" :viewBox="viewBox" xmlns="http://www.w3.org/2000/svg">
    <rect
      class="wood"
      x="-0.6"
      y="-0.6"
      :width="width + 0.2"
      :height="height + 0.2"
      rx="0.2"
      ry="0.2"
    />
    <rect class="border" x="0" y="0" :width="width - 1" :height="height - 1" rx="0.02" ry="0.02" />
    <line v-for="i in height - 2" :key="i" x1="0" :x2="width - 1" :y1="i" :y2="i" />
    <line v-for="i in width - 2" :key="i" :x1="i" :x2="i" y1="0" :y2="height - 1" />
    <template v-for="(info, i) of solutionInfo?.moves || []" :key="i">
      <circle
        :cx="info.x"
        :cy="info.y"
        r="0.35"
        :fill="fillGain(info)"
        stroke-width="0.04"
        :stroke="info.lowIdeal ? 'dodgerblue' : 'none'"
      />
      <text :x="info.x" :y="info.y" :font-size="fontSize(info)">{{ formatGain(info) }}</text>
    </template>
    <circle
      v-for="stone of stones"
      :key="stone.id"
      :cx="stone.x"
      :cy="stone.y"
      r="0.4"
      :fill="stone.type"
    />
    <template v-for="space of spaces" :key="space.id">
      <rect
        v-if="space.type === 'ko'"
        class="ko"
        :x="space.x - 0.25"
        :y="space.y - 0.25"
        width="0.5"
        height="0.5"
      />
      <rect
        v-if="space.type === 'ko' && space.playable"
        class="ko-threat"
        :x="space.x - 0.3"
        :y="space.y - 0.3"
        width="0.6"
        height="0.6"
      />
      <rect
        v-if="space.type === 'void'"
        class="void"
        :x="space.x - 0.5"
        :y="space.y - 0.5"
        width="1"
        height="1"
      />
      <circle
        v-if="space.type === 'external'"
        :cx="space.x"
        :cy="space.y"
        r="0.25"
        :fill="space.playable ? colorToPlay : otherColor"
        opacity="0.6"
      />
      <circle
        v-if="space.playable && !busy && !blackFlips && !whiteFlips"
        class="preview-stone"
        :cx="space.x"
        :cy="space.y"
        r="0.4"
        :fill="colorToPlay"
        @click="$emit('play', space.x, space.y)"
      />
    </template>
    <g opacity="0.5" shape-rendering="crispEdges">
      <template v-for="space of spaces" :key="space.id">
        <rect
          v-if="space.type === 'outside'"
          class="outside"
          :x="space.x - 0.5"
          :y="space.y - 0.5"
          width="1"
          height="1"
        />
      </template>
      <template v-for="stone of stones" :key="stone.id">
        <rect
          v-if="stone.status === 'immortal'"
          class="outside"
          :x="stone.x - 0.5"
          :y="stone.y - 0.5"
          width="1"
          height="1"
        />
      </template>
    </g>
    <template v-if="!busy">
      <circle
        v-for="(flip, i) of blackFlips || []"
        class="preview-stone flip"
        :key="i"
        :cx="flip.x"
        :cy="flip.y"
        r="0.4"
        fill="black"
        stroke="darkgray"
        @click="$emit('play', flip.x, flip.y)"
      />
      <circle
        v-for="(flip, i) of whiteFlips || []"
        class="preview-stone flip"
        :key="i"
        :cx="flip.x"
        :cy="flip.y"
        r="0.4"
        fill="white"
        stroke="lightgray"
        @click="$emit('play', flip.x, flip.y)"
      />
    </template>
  </svg>
</template>

<style scoped>
svg {
  user-select: none;
}
.wood {
  fill: peachpuff;
}
.border {
  fill: none;
  stroke-width: 0.06;
  stroke: black;
}
line {
  stroke-width: 0.05;
  stroke: black;
}
.ko {
  fill: none;
  stroke-width: 0.04;
  stroke: #111;
}
.ko-threat {
  fill: none;
  stroke-width: 0.03;
  stroke: #931;
}
.void {
  shape-rendering: crispEdges;
  fill: black;
}
.outside {
  fill: black;
}
.preview-stone {
  opacity: 0%;
}
.preview-stone:hover {
  opacity: 80%;
}
.flip {
  stroke-width: 0.03;
}
text {
  text-anchor: middle;
  dominant-baseline: middle;
}
</style>
