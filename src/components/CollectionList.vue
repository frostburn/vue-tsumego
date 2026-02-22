<script setup lang="ts">
import { ref } from 'vue'

type CollectionsResponse = {
  collections: { slug: string; title: string }[]
}

const API_URL = import.meta.env.VITE_API_URL

const data = ref<CollectionsResponse | null>(null)
const error = ref<Error | null>(null)

fetch(API_URL + '/tsumego/')
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
