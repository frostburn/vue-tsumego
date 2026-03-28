<script setup lang="ts">
defineProps<{
  whiteToPlay: boolean
}>()
const model = defineModel<'play' | 'black' | 'white'>()

const modes = ['play', 'black', 'white'] as const

function onKeyDown(event: KeyboardEvent) {
  const currentIndex = modes.indexOf(model.value!)
  if (currentIndex < 0) {
    return
  }

  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    model.value = modes[(currentIndex + 1) % modes.length]
    return
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    model.value = modes[(currentIndex - 1 + modes.length) % modes.length]
    return
  }
}
</script>

<template>
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 3 1"
    xmlns="http://www.w3.org/2000/svg"
    role="radiogroup"
    aria-label="Play and editing modes"
    tabindex="0"
    @keydown="onKeyDown"
  >
    <defs>
      <mask id="button-bar-mask">
        <rect x="0" y="0" width="3" height="1" rx="0.1" ry="0.1" fill="white" />
      </mask>
      <mask id="top-half" shape-rendering="crispEdges">
        <rect x="0" y="0" width="1" height="0.5" fill="white" />
      </mask>
      <mask id="bottom-half" shape-rendering="crispEdges">
        <rect x="0" y="0.5" width="1" height="0.5" fill="white" />
      </mask>
    </defs>
    <g mask="url(#button-bar-mask)">
      <rect class="background" x="0" y="0" width="3" height="1" />

      <rect v-show="model === 'play'" class="selected" x="0" y="0" width="1" height="1" />
      <circle cx="0.5" cy="0.5" r="0.4" fill="white" mask="url(#bottom-half)" />
      <circle cx="0.5" cy="0.5" r="0.4" fill="black" mask="url(#top-half)" />

      <circle cx="0.5" cy="0.5" r="0.23" :fill="whiteToPlay ? 'white' : 'black'" opacity="0.8" />

      <rect v-show="model === 'black'" class="selected" x="1" y="0" width="1" height="1" />
      <circle cx="1.5" cy="0.5" r="0.4" fill="black" />

      <rect v-show="model === 'white'" class="selected" x="2" y="0" width="1" height="1" />
      <circle cx="2.5" cy="0.5" r="0.4" fill="white" />

      <rect
        @click="model = 'play'"
        class="overlay"
        x="0"
        y="0"
        width="1"
        height="1"
        role="radio"
        :aria-checked="model === 'play'"
      >
        <title>Analyze moves in sequence and follow turn order.</title>
      </rect>
      <rect
        @click="model = 'black'"
        class="overlay"
        x="1"
        y="0"
        width="1"
        height="1"
        role="radio"
        :aria-checked="model === 'black'"
      >
        <title>Edit board by toggling black stones on intersections.</title>
      </rect>
      <rect
        @click="model = 'white'"
        class="overlay"
        x="2"
        y="0"
        width="1"
        height="1"
        role="radio"
        :aria-checked="model === 'white'"
      >
        <title>Edit board by toggling white stones on intersections.</title>
      </rect>
    </g>
  </svg>
</template>

<style scoped>
.background {
  fill: var(--color-background-mute);
}
.selected {
  fill: var(--color-background-soft);
}
.overlay {
  fill: white;
  opacity: 0;
}
@media (hover: hover) {
  .overlay:hover {
    opacity: 0.2;
  }
}
</style>
