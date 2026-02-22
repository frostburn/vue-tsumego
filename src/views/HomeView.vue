<script setup lang="ts">
import CollectionList from '../components/CollectionList.vue'
</script>

<template>
  <main>
    <p class="description">A database of completely solved tsumego i.e. go problems</p>
    <p>
      Problems have to be specially crafted for the computer. See the
      <RouterLink to="/about">About Page</RouterLink> for more details.
    </p>
    <h2>Collections</h2>
    <CollectionList />
  </main>
</template>

<style scoped>
.description {
  font-size: 1.3em;
}
</style>
