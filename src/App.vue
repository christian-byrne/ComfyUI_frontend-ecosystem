<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

import { useDarkMode } from './composables/useDarkMode'
import { routes } from './router'

const navRoutes = routes.filter((r) => r.meta?.nav)
const { isDark, toggleDark } = useDarkMode()
</script>

<template>
  <div
    class="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"
  >
    <header
      class="border-b border-zinc-200 px-6 py-4 flex flex-wrap gap-x-6 gap-y-2 items-baseline dark:border-zinc-800"
    >
      <RouterLink
        to="/"
        class="font-semibold text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
      >
        ComfyUI Frontend Ecosystem
      </RouterLink>
      <nav
        class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400"
      >
        <RouterLink
          v-for="route in navRoutes"
          :key="route.path"
          :to="route.path"
          active-class="text-zinc-900 font-medium dark:text-zinc-100"
          class="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          {{ route.meta?.title }}
        </RouterLink>
      </nav>
      <button
        type="button"
        class="ml-auto rounded border border-zinc-300 px-2 py-1 text-xs text-zinc-600 hover:border-zinc-500 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-zinc-100"
        :aria-pressed="isDark"
        :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        data-testid="dark-mode-toggle"
        @click="toggleDark()"
      >
        {{ isDark ? '☀ light' : '☾ dark' }}
      </button>
    </header>
    <main class="px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
