<script setup lang="ts">
import '@/assets/tsumego.css'

defineProps<{
  title: string
  subtitle?: string
  error: Error | null
  loading: boolean
}>()
</script>

<template>
  <main>
    <h1>
      {{ title }}<template v-if="subtitle">: {{ subtitle }}</template>
    </h1>
    <slot name="header-extra" />

    <h2 v-if="error">{{ error.message }}</h2>
    <p v-else-if="loading">Loading...</p>
    <template v-else>
      <div class="tsumego-layout">
        <section class="card board-card" aria-label="Board position">
          <div class="goban-container">
            <slot name="board" />
          </div>
        </section>

        <div class="sidebar">
          <slot name="sidebar" />
        </div>
      </div>
    </template>
  </main>
</template>
