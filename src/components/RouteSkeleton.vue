<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()

defineProps<{
  /** Optional override; falls back to route meta.title or route name. */
  title?: string
}>()
</script>

<template>
  <section class="prose-narrow">
    <h1 class="text-2xl font-semibold text-zinc-900">
<<<<<<< HEAD
      {{ title ?? route.meta.title ?? route.name }}
=======
      {{ title ?? (route.meta?.title as string | undefined) ?? route.name }}
>>>>>>> 2fd61da (chore(scaffold): vite + vue 3 + ts + pinia + vue-router)
    </h1>
    <p class="mt-2 text-sm text-zinc-500">
      Placeholder route. Real implementation lands in W3.*.
    </p>
    <p class="mt-4 text-xs text-zinc-400 font-mono">{{ route.fullPath }}</p>
  </section>
</template>
