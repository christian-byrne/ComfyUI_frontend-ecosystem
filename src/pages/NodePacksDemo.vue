<script setup lang="ts">
/**
 * Storybook-style demo route for {@link NodePackCard} and {@link NodePackBanner}.
 *
 * Lives at `/__demo/node-packs`. Renders five hand-picked sample packs from
 * the top-20 dataset so designers can sanity-check the card layout without
 * spinning up the full NodePacks page (W3 territory).
 */
import NodePackBanner from '@/components/NodePackBanner.vue'
import NodePackCard from '@/components/NodePackCard.vue'
import type { RegistryNode } from '@/types/registry'

const samples: RegistryNode[] = [
  {
    id: 'comfyui-manager',
    name: 'ComfyUI Manager',
    description:
      'ComfyUI extension manager — install custom nodes, models, and updates from inside the UI.',
    author: 'Comfy-Org',
    publisher: { id: 'comfy-org', name: 'Comfy Org' },
    downloads: 1_240_000,
    github_stars: 14564,
    repository: 'https://github.com/Comfy-Org/ComfyUI-Manager',
    icon: 'https://avatars.githubusercontent.com/u/121283862?v=4'
  },
  {
    id: 'rgthree-comfy',
    name: 'rgthree-comfy',
    description:
      'Power, queue, and reroute nodes to make ComfyUI a little more comfortable.',
    author: 'rgthree',
    publisher: { id: 'rgthree', name: 'rgthree' },
    downloads: 480_000,
    github_stars: 3054,
    repository: 'https://github.com/rgthree/rgthree-comfy'
  },
  {
    id: 'comfyui-kjnodes',
    name: 'ComfyUI-KJNodes',
    description:
      'Various utility nodes for ComfyUI — string handling, image manipulation, batching helpers.',
    author: 'kijai',
    publisher: { id: 'kijai', name: 'Kijai' },
    downloads: 380_000,
    github_stars: 2569,
    repository: 'https://github.com/kijai/ComfyUI-KJNodes'
  },
  {
    id: 'comfyui-easy-use',
    name: 'ComfyUI-Easy-Use',
    description:
      'Comprehensive node collection focused on simplifying common ComfyUI workflows.',
    author: 'yolain',
    publisher: { id: 'yolain', name: 'yolain' },
    downloads: 240_000,
    github_stars: 1880
  },
  {
    id: 'mock-no-banner',
    name: 'Pack with no media',
    description:
      'Falls back to a gradient placeholder when neither banner_url nor icon are set.',
    author: 'demo',
    downloads: 42,
    github_stars: 7
  }
]
</script>

<template>
  <section>
    <header class="mb-6 prose-narrow">
      <h1 class="text-2xl font-semibold text-zinc-900">NodePackCard demo</h1>
      <p class="mt-2 text-sm text-zinc-500">
        Five sample packs rendered from in-memory fixtures. No network calls.
      </p>
    </header>

    <h2 class="mb-3 text-sm font-medium text-zinc-700">Card grid</h2>
    <div class="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <NodePackCard v-for="pack in samples" :key="pack.id" :node-pack="pack" />
    </div>

    <h2 class="mb-3 text-sm font-medium text-zinc-700">
      Banner-only (inline pattern list)
    </h2>
    <ul class="flex flex-col gap-3">
      <li
        v-for="pack in samples"
        :key="pack.id"
        class="flex items-center gap-4 rounded-md border border-zinc-200 p-2"
      >
        <div class="w-40 shrink-0">
          <NodePackBanner :node-pack="pack" />
        </div>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-zinc-900">
            {{ pack.name }}
          </div>
          <div class="truncate text-xs text-zinc-500">
            {{ pack.repository ?? pack.id }}
          </div>
        </div>
      </li>
    </ul>
  </section>
</template>
