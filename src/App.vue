<template>
  <header>
    <h1>Life & Death Index</h1>
    <div class="wrapper">
      <nav>
        <RouterLink to="/">Home</RouterLink>
        <template v-if="$route.params.collection">
          <span>&gt;</span>
          <RouterLink
            class="breadcrumb"
            :to="{ name: 'collection', params: { collection: $route.params.collection } }"
            >Collection</RouterLink
          >
        </template>
        <template v-if="$route.params.tsumego">
          <span>&gt;</span>
          <RouterLink
            class="breadcrumb"
            :to="{
              name: 'tsumego',
              params: { collection: $route.params.collection, tsumego: $route.params.tsumego },
            }"
            >Tsumego</RouterLink
          >
        </template>
        <template v-if="$route.name === 'explore'">
          <span>&gt;</span>
          <RouterLink
            class="breadcrumb"
            :to="{ name: 'explore', params: { collection: $route.params.collection } }"
            >Explore</RouterLink
          >
        </template>
        <RouterLink to="/about">About</RouterLink>
      </nav>
    </div>
  </header>
  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

nav a.router-link-exact-active {
  color: var(--color-text);
}

nav a.router-link-exact-active:hover {
  background-color: transparent;
}

nav a {
  display: inline-block;
  padding: 0 1rem;
  border-left: 1px solid var(--color-border);
}

nav a.breadcrumb {
  border-left: none;
}

nav a:first-of-type {
  border: 0;
}
</style>
