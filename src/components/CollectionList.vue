<script setup lang="ts">
import { ref } from 'vue'
import { API_URL } from '../util'

type CollectionsResponse = {
  collections: { slug: string; title: string }[]
}

const data = ref<CollectionsResponse | null>(null)
const error = ref<Error | null>(null)

fetch(new URL('tsumego/', API_URL))
  .then((res) => res.json())
  .then((json) => (data.value = json))
  .catch((err) => (error.value = err))
</script>

<template>
  <div v-if="error">Error: {{ error.message }}</div>
  <div v-else-if="data">
    <ul>
      <li v-for="collection of data.collections" :key="collection.slug">
        <RouterLink :to="{ name: 'collection', params: { collection: collection.slug } }">
          {{ collection.title }}
        </RouterLink>
      </li>
    </ul>
  </div>
  <div v-else>Loading...</div>
</template>
