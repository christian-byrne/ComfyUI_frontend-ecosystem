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
    <!--
      Sticky header so navigation stays reachable from anywhere in a long
      table or detail view (DASH-FB-7). `backdrop-blur` keeps the chrome
      readable when content scrolls underneath.
    -->
    <header
      class="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-6 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
    >
      <div class="flex flex-wrap items-center gap-x-6 gap-y-2">
        <RouterLink
          to="/"
          class="text-sm font-semibold text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300"
        >
          ComfyUI Frontend Ecosystem
        </RouterLink>
        <nav
          class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400"
          aria-label="Primary"
          data-testid="primary-nav"
        >
          <RouterLink
            v-for="route in navRoutes"
            :key="route.path"
            :to="route.path"
            active-class="!bg-zinc-900 !text-white dark:!bg-zinc-100 dark:!text-zinc-900"
            class="rounded px-2 py-1 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
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
      </div>
    </header>
    <main class="px-6 py-8">
      <RouterView />
    </main>
  </div>
</template>
