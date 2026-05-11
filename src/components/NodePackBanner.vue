<script setup lang="ts">
/**
 * Banner-only variant of {@link NodePackCard}.
 *
 * Mirrors the upstream `PackBanner.vue` layout (blurred backdrop + contained
 * primary image) but strips PrimeVue. Aspect ratio matches upstream (7:3).
 *
 * Use this in inline pattern lists where we want the visual identifier of a
 * pack without the full card chrome.
 */
import { computed, ref } from 'vue'

import type { RegistryNode } from '@/types/registry'

const FALLBACK_GRADIENT =
  'linear-gradient(135deg, #4f46e5 0%, #ec4899 50%, #f59e0b 100%)'

const { nodePack } = defineProps<{ nodePack: RegistryNode }>()

const isImageError = ref(false)
const imgSrc = computed(() => nodePack.banner_url || nodePack.icon || '')
const showFallback = computed(() => !imgSrc.value || isImageError.value)
</script>

<template>
  <div class="aspect-[7/3] w-full overflow-hidden">
    <div
      v-if="showFallback"
      class="size-full"
      :style="{ background: FALLBACK_GRADIENT }"
      :aria-label="`${nodePack.name ?? 'Pack'} banner placeholder`"
    />
    <div v-else class="relative size-full">
      <div
        class="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        :style="{ backgroundImage: `url(${imgSrc})`, filter: 'blur(10px)' }"
      />
      <img
        :src="imgSrc"
        :alt="`${nodePack.name ?? 'Pack'} banner`"
        class="relative z-10 size-full object-contain"
        @error="isImageError = true"
      />
    </div>
  </div>
</template>
