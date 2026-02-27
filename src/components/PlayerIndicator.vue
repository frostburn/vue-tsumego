<script setup lang="ts">
defineProps<{
  whiteToPlay: boolean
}>()
</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 1.5 1" xmlns="http://www.w3.org/2000/svg">
    <template v-if="whiteToPlay">
      <circle cx="0.5" cy="0.5" r="0.49" fill="black" />
      <circle cx="1" cy="0.5" r="0.47" fill="white" />
    </template>
    <template v-else>
      <circle cx="1" cy="0.5" r="0.47" fill="white" />
      <circle cx="0.5" cy="0.5" r="0.49" fill="black" />
    </template>
  </svg>
</template>
