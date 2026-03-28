<script setup lang="ts">
defineProps<{
  success: boolean
  fail: boolean
}>()
</script>

<template>
  <svg width="100%" height="100%" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
    <template v-if="fail">
      <path d="M2,2 L8,8 M2,8 L8,2" stroke="red">
        <title>Failed to solve problem.</title>
      </path>
    </template>
    <template v-else-if="success">
      <polyline points="2,5 5,8, 9,1" stroke="var(--color-link)">
        <title>Problem solved successfully.</title>
      </polyline>
    </template>
    <template v-else>
      <path d="M3,3 A 2 2 1 1 1 5 5 L5,7 M5,9 L5,9" stroke="gray">
        <title>Problem unsolved. No mistakes yet.</title>
      </path>
    </template>
  </svg>
</template>

<style scoped>
svg {
  fill: none;
  stroke-width: 1;
  stroke-linecap: round;
}
</style>
