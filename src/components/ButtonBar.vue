<script setup lang="ts">
import { useTemplateRef } from 'vue'

type PlayMode = 'play' | 'black' | 'white'

defineProps<{
  whiteToPlay: boolean
}>()

const model = defineModel<PlayMode>({ default: 'play' })

const options: Array<{ value: PlayMode; label: string; tooltip: string }> = [
  {
    value: 'play',
    label: 'Play',
    tooltip: 'Analyze moves in sequence and follow turn order.',
  },
  {
    value: 'black',
    label: 'Place Black',
    tooltip: 'Edit board by placing black stones on intersections.',
  },
  {
    value: 'white',
    label: 'Place White',
    tooltip: 'Edit board by placing white stones on intersections.',
  },
]

const optionButtons = useTemplateRef<Array<HTMLButtonElement>>('optionButtons')

function setMode(value: PlayMode) {
  model.value = value
}

function focusOption(index: number) {
  const option = optionButtons.value?.[index]
  option?.focus()
}

function onOptionKeyDown(event: KeyboardEvent, index: number) {
  if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
    event.preventDefault()
    const next = (index + 1) % options.length
    setMode(options[next]!.value)
    focusOption(next)
    return
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
    event.preventDefault()
    const previous = (index - 1 + options.length) % options.length
    setMode(options[previous]!.value)
    focusOption(previous)
    return
  }
  if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault()
    setMode(options[index]!.value)
  }
}
</script>

<template>
  <div class="button-bar" role="radiogroup" aria-label="Play and editing modes">
    <button
      v-for="(option, index) of options"
      :key="option.value"
      ref="optionButtons"
      type="button"
      class="segment"
      :class="{ selected: model === option.value }"
      role="radio"
      :aria-checked="model === option.value"
      :title="option.tooltip"
      @click="setMode(option.value)"
      @keydown="onOptionKeyDown($event, index)"
    >
      <svg viewBox="0 0 1 1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
        <defs>
          <mask
            v-if="option.value === 'play'"
            :id="`top-half-${index}`"
            shape-rendering="crispEdges"
          >
            <rect x="0" y="0" width="1" height="0.5" fill="white" />
          </mask>
          <mask
            v-if="option.value === 'play'"
            :id="`bottom-half-${index}`"
            shape-rendering="crispEdges"
          >
            <rect x="0" y="0.5" width="1" height="0.5" fill="white" />
          </mask>
        </defs>

        <circle
          v-if="option.value === 'play'"
          cx="0.5"
          cy="0.5"
          r="0.4"
          fill="white"
          :mask="`url(#bottom-half-${index})`"
        />
        <circle
          v-if="option.value === 'play'"
          cx="0.5"
          cy="0.5"
          r="0.4"
          fill="black"
          :mask="`url(#top-half-${index})`"
        />
        <circle
          v-if="option.value === 'play'"
          cx="0.5"
          cy="0.5"
          r="0.23"
          :fill="whiteToPlay ? 'white' : 'black'"
          opacity="0.8"
        />

        <circle v-if="option.value === 'black'" cx="0.5" cy="0.5" r="0.4" fill="black" />
        <circle v-if="option.value === 'white'" cx="0.5" cy="0.5" r="0.4" fill="white" />
      </svg>
      <span class="segment-label">{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.button-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
  border-radius: 0.6rem;
  background: var(--color-background-mute);
}
.segment {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  align-items: center;
  justify-content: center;
  border: 0;
  padding: 0.5rem 0.35rem;
  background: transparent;
  color: var(--color-text);
  font: inherit;
  cursor: pointer;
}
.segment + .segment {
  box-shadow: -1px 0 0 0 var(--color-border) inset;
}
.segment svg {
  width: 1.5rem;
  height: 1.5rem;
}
.segment-label {
  font-size: 0.8rem;
  line-height: 1.1;
}
.segment.selected {
  background: var(--color-background-soft);
}
.segment:focus-visible {
  outline: 2px solid var(--color-link);
  outline-offset: -2px;
  z-index: 1;
}
@media (hover: hover) {
  .segment:hover {
    background: color-mix(in srgb, var(--color-background-soft) 60%, transparent);
  }
}
</style>
