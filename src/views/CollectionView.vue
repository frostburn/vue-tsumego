<script setup lang="ts">
import { ref, reactive } from 'vue'
import TheGoban from '../components/TheGoban.vue'
import { type StateJSON, State } from '../core/state'
import { rectangle } from '../core/bitboard'

type CollectionResponse = {
  title: string
  root: StateJSON
  tsumegos: { slug: string; subtitle: string }[]
}
const props = defineProps<{ collection: string }>()

const API_URL = import.meta.env.VITE_API_URL

const data = ref<CollectionResponse | null>(null)
const error = ref<Error | null>(null)

const gameState = reactive(new State())
gameState.visualArea = rectangle(5, 4)
gameState.logicalArea = rectangle(5, 4)

fetch(API_URL + `/tsumego/${props.collection}`)
  .then((res) => res.json())
  .then((json) => {
    gameState.assignFromJSON(json.root)
    data.value = json
  })
  .catch((err) => (error.value = err))
</script>

<template>
  <main>
    <div v-if="error">Error: {{ error.message }}</div>
    <div v-else-if="data">
      <h1>{{ data.title }}</h1>
      <RouterLink
        class="goban-container"
        :to="{ name: 'explore', params: { collection: props.collection } }"
      >
        <TheGoban :state="gameState" :busy="true" />
      </RouterLink>
      <RouterLink
        class="explore"
        :to="{ name: 'explore', params: { collection: props.collection } }"
        ><i>(explore)</i></RouterLink
      >
      <ul>
        <li v-for="tsumego of data.tsumegos" :key="tsumego.slug">
          <RouterLink
            :to="{
              name: 'tsumego',
              params: { collection: props.collection, tsumego: tsumego.slug },
            }"
          >
            {{ tsumego.subtitle }}
          </RouterLink>
        </li>
      </ul>
    </div>
    <div v-else>Loading...</div>
  </main>
</template>

<style scoped>
a.goban-container {
  display: block;
  width: 20em;
  padding-bottom: 0;
}
a.explore {
  padding-top: 0;
}
</style>
