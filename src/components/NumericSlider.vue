<script setup lang="ts">
import { computed } from 'vue'

// eslint-disable-next-line: eslint-plugin-vue(valid-define-props)
const props = defineProps()

const model = defineModel<number>()
const wrapper = computed({
  get: () => model.value,
  set(newValue: number | string) {
    if (typeof newValue !== 'number') {
      newValue = parseFloat(newValue)
    }
    if (!isNaN(newValue)) {
      model.value = newValue
    }
  },
})
</script>
<template>
  <input v-bind="props" type="range" v-model="wrapper" />
</template>
