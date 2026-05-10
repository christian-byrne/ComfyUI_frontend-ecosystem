<script setup lang="ts">
import { useDataStore } from '@/stores/data'

const data = useDataStore()
const top = data.topByBlastRadius(5)
</script>

<template>
  <div>
    <h1>ComfyUI Frontend Ecosystem</h1>
    <p>Data loader online — {{ data.patterns.length }} patterns bundled.</p>
    <ol>
      <li v-for="r in top" :key="r.pattern_id">
        {{ r.pattern_id }} — {{ r.name }} (blast {{ r.blast_radius }})
      </li>
    </ol>
  </div>
</template>
