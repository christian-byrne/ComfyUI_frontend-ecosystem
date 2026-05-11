<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import { routes } from './router'

const navRoutes = routes.filter((r) => r.meta?.nav)
</script>

<template>
  <div class="min-h-screen bg-white text-zinc-900">
    <header
      class="border-b border-zinc-200 px-6 py-4 flex flex-wrap gap-x-6 gap-y-2 items-baseline"
    >
      <RouterLink
        to="/"
        class="font-semibold text-zinc-900 hover:text-zinc-600"
      >
        ComfyUI Frontend Ecosystem
      </RouterLink>
      <nav class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
        <RouterLink
          v-for="route in navRoutes"
          :key="route.path"
          :to="route.path"
          active-class="text-zinc-900 font-medium"
          class="hover:text-zinc-900"
        >
          {{ route.meta?.title }}
        </RouterLink>
      </nav>
    </header>
    <main class="px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
