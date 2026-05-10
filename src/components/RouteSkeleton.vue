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
      {{ title ?? (route.meta?.title as string | undefined) ?? route.name }}
    </h1>
    <p class="mt-2 text-sm text-zinc-500">
      Placeholder route. Real implementation lands in W3.*.
    </p>
    <p class="mt-4 text-xs text-zinc-400 font-mono">{{ route.fullPath }}</p>
  </section>
</template>
