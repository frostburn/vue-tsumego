<script setup lang="ts">
import { type Coords } from '../core/bitboard'
import { type GridSpace, type GridStone, State } from '../core/state'
import { type SolutionInfo, type MoveInfo } from '../core/solver'
import { formatGain, fillGain } from '../util'
import { ref, computed } from 'vue'

const props = defineProps<{
  state: State
  busy: boolean
  solutionInfo?: SolutionInfo
  blackFlips?: Coords[]
  whiteFlips?: Coords[]
}>()
const emit = defineEmits(['play'])

const activeTouchId = ref<number | null>(null)
const guideX = ref(0)
const guideY = ref(0)

const width = computed(() => props.state.width)
const height = computed(() => props.state.height)
const guideColor = computed(() => {
  if (props.blackFlips !== undefined) {
    return 'black'
  }
  if (props.whiteFlips !== undefined) {
    return 'white'
  }
  return props.state.whiteToPlay ? 'white' : 'black'
})
const colorToPlay = computed(() => (props.state.whiteToPlay ? 'white' : 'black'))
const otherColor = computed(() => (props.state.whiteToPlay ? 'black' : 'white'))

const grid = computed(() => props.state.toGrid())

const stones = computed<GridStone[]>(
  () => grid.value.filter((item) => item.type === 'black' || item.type === 'white') as GridStone[],
)
const spaces = computed<GridSpace[]>(
  () => grid.value.filter((item) => item.type !== 'black' && item.type !== 'white') as GridSpace[],
)

const guideLegal = computed(() => {
  if (activeTouchId.value === null) {
    return false
  }
  if (props.blackFlips !== undefined) {
    for (const flip of props.blackFlips) {
      if (flip.x === guideX.value && flip.y === guideY.value) {
        return true
      }
    }
  } else if (props.whiteFlips !== undefined) {
    for (const flip of props.whiteFlips) {
      if (flip.x === guideX.value && flip.y === guideY.value) {
        return true
      }
    }
  } else {
    for (const space of spaces.value) {
      if (space.playable && space.x === guideX.value && space.y === guideY.value) {
        return true
      }
    }
  }
  return false
})

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

// Temp variables for screen coords to SVG conversion
let ctm: DOMMatrix | null = null
let pt: SVGPoint | null = null
function touchGuide(event: TouchEvent) {
  for (const touch of event.changedTouches) {
    if (touch.identifier === activeTouchId.value) {
      pt!.x = touch.clientX
      pt!.y = touch.clientY
      pt = pt!.matrixTransform(ctm!)
      guideX.value = Math.round(pt.x)
      guideY.value = Math.round(pt.y)
      return
    }
  }
  return null
}

function onTouchStart(event: TouchEvent) {
  if (props.busy) {
    return
  }
  event.preventDefault()

  const svg = (event.target as Element).closest('svg')
  if (svg === null) {
    return
  }

  if (!event.changedTouches.length) {
    return
  }
  activeTouchId.value = event.changedTouches[0]!.identifier

  ctm = svg.getScreenCTM()!.inverse()
  pt = svg.createSVGPoint()
  touchGuide(event)
}

function onTouchMove(event: TouchEvent) {
  if (props.busy) {
    return
  }
  event.preventDefault()
  touchGuide(event)
}

function onTouchEnd(event: TouchEvent) {
  if (props.busy) {
    return
  }
  event.preventDefault()
  touchGuide(event)
  if (guideLegal.value) {
    emit('play', guideX.value, guideY.value)
  }
  onTouchCancel(event)
}

function onTouchCancel(event: TouchEvent) {
  for (const touch of event.changedTouches) {
    if (touch.identifier === activeTouchId.value) {
      activeTouchId.value = null
      return
    }
  }
}
</script>

<template>
  <svg
    width="100%"
    height="100%"
    :viewBox="viewBox"
    xmlns="http://www.w3.org/2000/svg"
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
    @touchcancel="onTouchCancel"
  >
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
      v-show="guideLegal"
      :cx="guideX"
      :cy="guideY"
      r="0.4"
      :fill="guideColor"
      opacity="0.7"
    />
    <circle
      v-for="stone of stones"
      :class="stone.status"
      :key="stone.id"
      :cx="stone.x"
      :cy="stone.y"
      r="0.4"
      :fill="stone.type"
    />
    <g v-show="activeTouchId !== null">
      <line
        :class="{ guide: true, legal: guideLegal }"
        x1="-1"
        :x2="width + 1"
        :y1="guideY"
        :y2="guideY"
      />
      <line
        :class="{ guide: true, legal: guideLegal }"
        y1="-1"
        :y2="height + 1"
        :x1="guideX"
        :x2="guideX"
      />
    </g>
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
        v-if="!blackFlips && !whiteFlips"
        :class="{ 'preview-stone': space.playable && !busy }"
        :cx="space.x"
        :cy="space.y"
        r="0.4"
        opacity="0"
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
        opacity="0"
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
        opacity="0"
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
@media (hover: hover) {
  .preview-stone:hover {
    opacity: 80%;
  }
}
.flip {
  stroke-width: 0.03;
}
text {
  text-anchor: middle;
  dominant-baseline: central;
}
circle.dead {
  opacity: 60%;
}
line.guide {
  stroke-width: 0.06;
  stroke: purple;
  opacity: 90%;
}
line.guide.legal {
  stroke: red;
}
</style>
